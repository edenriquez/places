"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, MapPin, Plus, Users } from "lucide-react";
import { getClient, useSession } from "@/components/auth/session-provider";
import { fmtWhenShort } from "@/lib/format";
import { spotsLeft, whoGoes, withWhom, type GroupPlan } from "@/lib/group-plans";
import { Avatars } from "./avatars";
import { JoinButton } from "./join-button";
import { PlanShare } from "./plan-share";
import { PlanSheet, type PlanSheetTarget } from "./plan-sheet";

// teléfono y escritorio montan el detalle a la vez: una sola consulta por evento y cuenta
const cache = new Map<string, Promise<GroupPlan[]>>();
function plansFor(target: PlanSheetTarget, uid: string | undefined, fresh = false) {
  const key = `${target.kind}:${target.id}:${uid ?? ""}`;
  if (fresh) cache.delete(key);
  if (!cache.has(key)) {
    cache.set(key, getClient()
      .then((sb) => sb.rpc("plans_for", target.kind === "event" ? { p_event: target.id } : { p_experience: target.id }))
      .then(({ data }) => (data ?? []) as GroupPlan[]));
  }
  return cache.get(key)!;
}

function MyPlan({ p, meId }: { p: GroupPlan; meId?: string }) {
  return (
    <li className="rounded-control bg-bg-2 p-3">
      <Link href={`/plan/${p.code}`} className="flex items-center gap-3">
        <Avatars people={p.people} total={p.going} size={30} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">Tu plan · {fmtWhenShort(p.starts_at, p.is_all_day)}</span>
          <span className="block truncate text-[13px] text-ink-2">{withWhom(p.people, meId)}{p.is_open ? " · abierto" : ""}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden />
      </Link>
      {p.code && <PlanShare p={{ ...p, code: p.code }} compact className="mt-3" />}
    </li>
  );
}

function OpenPlan({ p, eventId, onJoined }: { p: GroupPlan; eventId?: string; onJoined: () => void }) {
  const left = spotsLeft(p);
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatars people={p.people} total={p.going} size={30} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{p.host ? whoGoes(p) : `${p.going} ${p.going === 1 ? "persona va" : "personas van"}`}</span>
        <span className="block truncate text-[13px] text-ink-2">
          {fmtWhenShort(p.starts_at, p.is_all_day)}{left <= 3 ? ` · ${left === 1 ? "queda 1 lugar" : `quedan ${left} lugares`}` : ""}
        </span>
        {p.meeting_point && <span className="flex items-center gap-1 truncate text-[12px] text-ink-3"><MapPin size={12} className="shrink-0" /> {p.meeting_point}</span>}
      </span>
      <JoinButton planId={p.id} eventId={eventId} onJoined={onJoined} className="shrink-0" />
    </li>
  );
}

/**
 * "Ve con alguien" en el detalle de un evento o experiencia: tus planes (para invitar), los planes abiertos de
 * otras personas (para sumarte) y armar uno nuevo. Llegar con #plan abre el formulario (vuelta del login).
 */
export function PlanBox({ target, className }: { target: PlanSheetTarget; className?: string }) {
  const { user, ready, counts, interested, openLogin } = useSession();
  const uid = user?.id;
  const [plans, setPlans] = useState<GroupPlan[] | null>(null);
  const [sheet, setSheet] = useState(false);

  const load = useCallback((fresh = false) => {
    let live = true;
    plansFor(target, uid, fresh).then((rows) => live && setPlans(rows));
    return () => { live = false; };
  }, [target, uid]);

  useEffect(() => {
    if (!ready) return;
    return load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || !uid || location.hash !== "#plan") return;
    history.replaceState(null, "", location.pathname + location.search);
    queueMicrotask(() => setSheet(true));
  }, [ready, uid]);

  const mine = (plans ?? []).filter((p) => p.role);
  const others = (plans ?? []).filter((p) => !p.role);
  const eventId = target.kind === "event" ? target.id : undefined;
  const othersInterested = eventId && counts[eventId] !== undefined ? counts[eventId] - (interested.has(eventId) ? 1 : 0) : 0;
  const crowd = !mine.length && !others.length && othersInterested >= 2;

  const subtitle = others.length
    ? "Súmate a un grupo o arma el tuyo."
    : crowd
      ? `${othersInterested} personas más están interesadas. Abre un grupo y que se sumen.`
      : target.kind === "event"
        ? "Arma un plan con tus conocidos o ábrelo para que se sume gente cerca."
        : "¿Ya sabes qué día vas? Arma el plan e invita a quien quieras, o ábrelo a gente cerca.";

  if (target.kind === "event" && !target.occurrences.length) return null;

  return (
    <section className={clsx("rounded-card border border-line p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Users size={19} /></span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold leading-tight">Ve con alguien</h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{subtitle}</p>
        </div>
      </div>

      {mine.length > 0 && <ul className="mt-3 space-y-2">{mine.map((p) => <MyPlan key={p.id} p={p} meId={uid} />)}</ul>}
      {others.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {others.slice(0, 4).map((p) => <OpenPlan key={p.id} p={p} eventId={eventId} onJoined={() => load(true)} />)}
        </ul>
      )}

      <button type="button" onClick={() => (uid ? setSheet(true) : openLogin({ do: "plan" }))}
        className={clsx("mt-3 flex w-full items-center justify-center gap-2 rounded-control py-2.5 text-[14px] font-semibold",
          mine.length || others.length ? "border border-ink text-ink hover:bg-bg-2" : "bg-ink text-white")}>
        <Plus size={16} /> {mine.length ? "Armar otro plan" : crowd ? "Abrir un grupo" : "Armar un plan"}
      </button>

      {sheet && (
        <PlanSheet target={target} defaultOpen={crowd} onClose={() => setSheet(false)} onCreated={() => load(true)} />
      )}
    </section>
  );
}
