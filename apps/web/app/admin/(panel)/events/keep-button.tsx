"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pin, PinOff } from "lucide-react";
import { setEventKeep } from "../actions";

/** Saca el evento de la purga (o lo regresa): sin esto, una semana después de su última fecha pierde flyer y contacto. */
export function EventKeepButton({ id, keep }: { id: string; keep: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const label = keep ? "Dejar que se purgue" : "Conservar (no purgar)";
  const toggle = () => start(async () => {
    const r = await setEventKeep(id, !keep);
    if (!r.ok) alert(r.error);
    router.refresh();
  });
  return (
    <button disabled={pending} onClick={toggle} aria-label={label} title={label} aria-pressed={keep}
      className={`grid h-8 w-8 place-items-center rounded-control border disabled:opacity-40 ${keep ? "border-ink text-ink" : "border-line-2 text-ink-2 hover:text-ink"}`}>
      {keep ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />}
    </button>
  );
}
