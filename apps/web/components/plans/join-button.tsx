"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { UserPlus } from "lucide-react";
import { getClient, useSession } from "@/components/auth/session-provider";
import type { GroupPlan } from "@/lib/group-plans";
import { track } from "@/lib/track";

/** Unirse a un plan: con el link de invitación (`code`) o, si es abierto, por su id. Sin cuenta, primero entra. */
export function JoinButton({ planId, code, eventId, label = "Unirme", className, onJoined }: {
  planId?: string;
  code?: string;
  /** si el plan es de un evento: queda marcado con "Me interesa" */
  eventId?: string;
  label?: string;
  className?: string;
  onJoined?: (p: GroupPlan) => void;
}) {
  const { user, openLogin, noteInterest } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    if (!user) return openLogin({ do: "join", planId, code });
    setBusy(true);
    setError(null);
    const { data, error } = await (await getClient()).rpc("join_plan", code ? { p_code: code } : { p_plan: planId });
    setBusy(false);
    if (error) return setError(error.message || "No pudimos unirte. Intenta de nuevo.");
    track("plan_join", { event: eventId, props: { via: code ? "link" : "open" } });
    if (eventId) noteInterest(eventId);
    onJoined?.(data as GroupPlan);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-stretch">
      <button type="button" disabled={busy} onClick={join}
        className={clsx("flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-60", className)}>
        <UserPlus size={16} /> {busy ? "Uniéndote…" : label}
      </button>
      {error && <span className="mt-1 text-[12px] text-error">{error}</span>}
    </span>
  );
}
