"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Lock, Minus, PartyPopper, Plus, Users, X } from "lucide-react";
import { getClient, useSession } from "@/components/auth/session-provider";
import { fmtWhenShort } from "@/lib/format";
import type { GroupPlan } from "@/lib/group-plans";
import { track } from "@/lib/track";
import type { Occurrence } from "@/lib/types";
import { PlanShare } from "./plan-share";

export type PlanSheetTarget =
  | { kind: "event"; id: string; title: string; occurrences: Pick<Occurrence, "id" | "starts_at" | "ends_at" | "is_all_day" | "note">[] }
  | { kind: "experience"; id: string; title: string; hours: { days: string; time: string }[] };

const TZ = "America/Mexico_City";
const todayYmd = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dayLabel = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", weekday: "short", day: "numeric" });

/** Los próximos 14 días en hora del centro: "Hoy", "Mañana", "sáb 11"… */
function nextDays() {
  const [y, m, d] = todayYmd().split("-").map(Number);
  return Array.from({ length: 14 }, (_, i) => {
    const at = new Date(Date.UTC(y, m - 1, d + i, 12));
    return { ymd: at.toISOString().slice(0, 10), label: i === 0 ? "Hoy" : i === 1 ? "Mañana" : dayLabel.format(at).replace(".", "") };
  });
}

function Choice({ on, onClick, icon, title, body }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={clsx("flex w-full items-start gap-3 rounded-card border p-3.5 text-left transition", on ? "border-ink bg-bg-2 ring-1 ring-ink" : "border-line-2 hover:border-ink")}>
      <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full", on ? "bg-ink text-white" : "bg-bg-2 text-ink-2")}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[13px] leading-snug text-ink-2">{body}</span>
      </span>
    </button>
  );
}

const label = "text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2";
const input = "mt-2 w-full rounded-control border border-line-2 px-3.5 py-2.5 text-[15px] outline-none focus:border-ink";

/**
 * Armar un plan: cuándo (una fecha del evento, o día y hora para una experiencia), con quién (conocidos con link,
 * o abierto a gente cerca) y, opcional, dónde se ven. Al terminar, invitar.
 */
export function PlanSheet({ target, defaultOpen = false, onClose, onCreated }: {
  target: PlanSheetTarget;
  defaultOpen?: boolean;
  onClose: () => void;
  onCreated?: (p: GroupPlan) => void;
}) {
  const { noteInterest } = useSession();
  const [days] = useState(nextDays);
  const [occ, setOcc] = useState(target.kind === "event" ? target.occurrences[0]?.id : undefined);
  const [day, setDay] = useState(days[1].ymd);
  const [time, setTime] = useState("09:00");
  const [open, setOpen] = useState(defaultOpen);
  const [max, setMax] = useState(6);
  const [meeting, setMeeting] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<GroupPlan | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    // el centro de México no tiene horario de verano desde 2022: siempre UTC−6
    const startsAt = `${day}T${time}:00-06:00`;
    if (target.kind === "experience" && new Date(startsAt).getTime() < Date.now()) return setError("Esa hora ya pasó; elige otra.");
    setBusy(true);
    setError(null);
    const sb = await getClient();
    const { data, error } = await sb.rpc("create_plan", {
      ...(target.kind === "event" ? { p_occurrence: occ } : { p_experience: target.id, p_starts_at: startsAt }),
      p_is_open: open,
      p_max_people: open ? max : 30,
      p_meeting_point: meeting || null,
      p_note: note || null,
    });
    setBusy(false);
    if (error) return setError(error.message || "No pudimos armar el plan. Intenta de nuevo.");
    const plan = data as GroupPlan;
    track("plan_create", { event: target.kind === "event" ? target.id : undefined, props: { kind: target.kind, open } });
    if (target.kind === "event") noteInterest(target.id);
    setDone(plan);
    onCreated?.(plan);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 lg:items-center" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-title"
        onClick={(e) => e.stopPropagation()}
        className="sheet-in relative flex max-h-[92dvh] w-full max-w-screen-sm flex-col rounded-t-[20px] bg-white shadow-float lg:max-w-[480px] lg:rounded-card"
      >
        <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-bg-2">
          <X size={18} />
        </button>

        {done?.code ? (
          <div className="px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-7">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-free-bg text-free"><PartyPopper size={22} /></span>
            <h2 id="plan-title" className="mt-4 pr-10 text-[22px] font-bold leading-tight">¡Plan armado!</h2>
            <p className="mt-1 text-[14px] text-ink-2">
              {target.title} · {fmtWhenShort(done.starts_at, done.is_all_day)}.{" "}
              {done.is_open
                ? "Ya lo ven las personas cerca y quienes están interesadas. Invita también a tus conocidos:"
                : "Invita a tus conocidos: cuando se unan, les aparece a todos en sus planes y en su calendario."}
            </p>
            <PlanShare p={{ ...done, code: done.code }} className="mt-5" />
            <Link href={`/plan/${done.code}`} className="mt-5 block text-center text-[14px] font-semibold underline">Ver el plan</Link>
          </div>
        ) : (
          <>
            <div className="shrink-0 px-6 pb-3 pt-7">
              <h2 id="plan-title" className="pr-10 text-[22px] font-bold leading-tight">Arma un plan</h2>
              <p className="mt-1 truncate text-[14px] text-ink-2">{target.title}</p>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 pb-4 pt-2">
              <fieldset>
                <legend className={label}>¿Cuándo?</legend>
                {target.kind === "event" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {target.occurrences.slice(0, 8).map((o) => (
                      <button key={o.id} type="button" aria-pressed={occ === o.id} onClick={() => setOcc(o.id)}
                        className={clsx("rounded-full border px-3.5 py-2 text-[14px] font-medium", occ === o.id ? "border-ink bg-ink text-white" : "border-line-2 hover:border-ink")}>
                        {fmtWhenShort(o.starts_at, o.is_all_day)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="no-scrollbar -mx-6 mt-2 flex gap-2 overflow-x-auto px-6">
                      {days.map((d) => (
                        <button key={d.ymd} type="button" aria-pressed={day === d.ymd} onClick={() => setDay(d.ymd)}
                          className={clsx("shrink-0 rounded-full border px-3.5 py-2 text-[14px] font-medium capitalize", day === d.ymd ? "border-ink bg-ink text-white" : "border-line-2 hover:border-ink")}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                    <label className="mt-3 flex items-center gap-3 text-[14px]">
                      <span className="text-ink-2">Hora</span>
                      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-control border border-line-2 px-3 py-2 text-[15px] outline-none focus:border-ink" />
                    </label>
                    {target.hours.length > 0 && (
                      <p className="mt-2 text-[12px] text-ink-3">Horario: {target.hours.map((h) => `${h.days} ${h.time}`).join(" · ")}</p>
                    )}
                  </>
                )}
              </fieldset>

              <fieldset>
                <legend className={label}>¿Con quién?</legend>
                <div className="mt-2 space-y-2">
                  <Choice on={!open} onClick={() => setOpen(false)} icon={<Lock size={17} />} title="Con conocidos"
                    body="Te damos un link para invitar. Solo entra quien lo tenga." />
                  <Choice on={open} onClick={() => setOpen(true)} icon={<Users size={17} />} title="Abierto a gente cerca"
                    body="Además lo ven personas cerca y quienes marcaron que les interesa. Se verá tu nombre y tu foto." />
                </div>
              </fieldset>

              {open && (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[15px] font-semibold">¿Cuántos van, contándote?</p>
                    <p className="text-[13px] text-ink-2">Cuando se llene, deja de aparecer.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" aria-label="Menos" disabled={max <= 2} onClick={() => setMax((n) => n - 1)} className="grid h-9 w-9 place-items-center rounded-full border border-line-2 disabled:opacity-40"><Minus size={16} /></button>
                    <span className="w-6 text-center text-[17px] font-bold tabular-nums">{max}</span>
                    <button type="button" aria-label="Más" disabled={max >= 30} onClick={() => setMax((n) => n + 1)} className="grid h-9 w-9 place-items-center rounded-full border border-line-2 disabled:opacity-40"><Plus size={16} /></button>
                  </div>
                </div>
              )}

              <label className="block">
                <span className={label}>Punto de encuentro <span className="font-normal normal-case tracking-normal text-ink-3">(opcional)</span></span>
                <input value={meeting} onChange={(e) => setMeeting(e.target.value)} maxLength={140} placeholder="Ej. en el kiosko a las 17:30" className={input} />
              </label>
              <label className="block">
                <span className={label}>Nota <span className="font-normal normal-case tracking-normal text-ink-3">(opcional)</span></span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2} placeholder="Ej. salgo de Cuernavaca, tengo 2 lugares en el coche" className={clsx(input, "resize-none")} />
              </label>
            </div>

            <div className="shrink-0 border-t border-line px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
              {error && <p className="mb-2 text-[13px] text-error">{error}</p>}
              <button type="button" disabled={busy || (target.kind === "event" && !occ)} onClick={submit}
                className="w-full rounded-control bg-ink py-3 text-[15px] font-semibold text-white disabled:opacity-60">
                {busy ? "Armando…" : "Armar plan"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
