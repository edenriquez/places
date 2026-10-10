"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { LogOut, X } from "lucide-react";
import { getClient } from "@/components/auth/session-provider";
import type { GroupPlan, Person } from "@/lib/group-plans";

function useRpc() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: string, args: Record<string, unknown>, then?: () => void) {
    setBusy(true);
    setError(null);
    const { error } = await (await getClient()).rpc(fn, args);
    setBusy(false);
    if (error) return setError(error.message || "Algo falló. Intenta de nuevo.");
    if (then) then();
    else router.refresh();
  }
  return { busy, error, run, router };
}

/** Quien armó el plan decide si es abierto (lo ven personas cerca e interesadas) o solo con link. */
export function OpenToggle({ p }: { p: Pick<GroupPlan, "id" | "is_open"> }) {
  const { busy, error, run } = useRpc();
  return (
    <div>
      <button type="button" role="switch" aria-checked={p.is_open} disabled={busy}
        onClick={() => run("update_plan", { p_plan: p.id, p_is_open: !p.is_open })}
        className="flex w-full items-center justify-between gap-4 text-left disabled:opacity-60">
        <span>
          <span className="block text-[15px] font-semibold">Abierto a gente cerca</span>
          <span className="block text-[13px] text-ink-2">
            {p.is_open ? "Lo ven personas cerca y quienes marcaron que les interesa." : "Solo entra quien tenga el link."}
          </span>
        </span>
        <span className={clsx("relative h-7 w-12 shrink-0 rounded-full transition-colors", p.is_open ? "bg-free" : "bg-line-2")}>
          <span className={clsx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]", p.is_open ? "left-[22px]" : "left-0.5")} />
        </span>
      </button>
      {error && <p className="mt-1 text-[12px] text-error">{error}</p>}
    </div>
  );
}

/** Salir. Si sale quien lo armó, pasa a quien se unió primero; si no queda nadie, el plan se cancela. */
export function LeaveButton({ p, heir }: { p: Pick<GroupPlan, "id" | "role">; heir?: string }) {
  const { busy, error, run, router } = useRpc();
  const host = p.role === "host";
  const label = host && !heir ? "Cancelar plan" : "Salir del plan";
  const confirmText = host && !heir
    ? "¿Cancelar el plan?"
    : host ? `¿Salir del plan? ${heir} queda a cargo.` : "¿Salir del plan? Ya no aparecerá en tus planes.";
  return (
    <div className="text-center">
      <button type="button" disabled={busy}
        onClick={() => confirm(confirmText) && run("leave_plan", { p_plan: p.id }, () => { router.push("/guardados"); router.refresh(); })}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 underline disabled:opacity-60">
        <LogOut size={14} /> {busy ? "Un momento…" : label}
      </button>
      {error && <p className="mt-1 text-[12px] text-error">{error}</p>}
    </div>
  );
}

/** En planes abiertos, quien lo armó puede sacar a alguien. */
export function RemovePerson({ planId, person }: { planId: string; person: Person }) {
  const { busy, run } = useRpc();
  return (
    <button type="button" disabled={busy} aria-label={`Sacar a ${person.name} del plan`}
      onClick={() => confirm(`¿Sacar a ${person.name} del plan?`) && run("remove_from_plan", { p_plan: planId, p_user: person.id })}
      className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-bg-2 hover:text-ink disabled:opacity-50">
      <X size={16} />
    </button>
  );
}
