"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import clsx from "clsx";
import { useSession } from "./auth/session-provider";

function socialText(n: number, mine: boolean) {
  if (mine) {
    const others = n - 1;
    if (others <= 0) return "Te interesa este evento";
    return `Tú y ${others} ${others === 1 ? "persona más están interesadas" : "personas más están interesadas"}`;
  }
  if (n === 0) return "Sé la primera persona en mostrar interés";
  return n === 1 ? "1 persona también está interesada en asistir" : `${n} personas también están interesadas en asistir`;
}

/** "Me interesa": marcar requiere cuenta; el conteo lo ve cualquiera (se pide en el cliente para no romper la caché). */
export function InterestButton({ eventId, className }: { eventId: string; className?: string }) {
  const { interested, counts, pending, loadCounts, toggleInterest } = useSession();
  useEffect(() => loadCounts([eventId]), [eventId, loadCounts]);
  // sin cuenta se ve marcado (y suma uno) mientras decide si entra
  const preview = pending?.do === "interest" && pending.eventId === eventId && !interested.has(eventId);
  const mine = interested.has(eventId) || preview;
  const n = counts[eventId] === undefined ? undefined : counts[eventId] + (preview ? 1 : 0);
  const [taps, setTaps] = useState(0);
  const animate = taps > 0;
  const text = n === undefined ? " " : socialText(Math.max(n, mine ? 1 : 0), mine);
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <button
        type="button"
        aria-pressed={mine}
        onClick={() => {
          setTaps((t) => t + 1);
          toggleInterest(eventId);
        }}
        className={clsx(
          "flex shrink-0 items-center gap-2 border px-4 py-2.5 text-[14px] font-semibold",
          "transition-[background-color,color,border-color,border-radius,box-shadow] duration-300 ease-out active:scale-95",
          mine ? "rounded-[22px] border-ink bg-ink text-white shadow-soft" : "rounded-control border-ink text-ink hover:bg-bg-2",
        )}
      >
        <span key={taps} className={clsx("relative grid place-items-center", animate && (mine ? "anim-star-spin" : "anim-shrink"))}>
          <Star size={16} className={clsx("transition-[fill,color] duration-300", mine && "fill-[#ffb400] text-[#ffb400]")} />
          {animate && mine && <><span className="anim-ring -m-2 [--burst:#ffb400]" /><span className="anim-sparks [--burst:#ffffff]" /></>}
        </span>
        <span key={`t${taps}`} className={clsx(animate && "anim-text-in")}>{mine ? "¡Me interesa!" : "Me interesa"}</span>
      </button>
      <p key={text} className="anim-text-in min-w-0 text-[13px] leading-snug text-ink-2" aria-live="polite">{text}</p>
    </div>
  );
}
