"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import clsx from "clsx";
import { useSession } from "./auth/session-provider";

/** Corazón de guardar. `card`: sobre el flyer; `icon`: botón redondo; `label`: "Guardar" con texto. */
export function SaveButton({ eventId, variant, className }: { eventId: string; variant: "card" | "icon" | "label"; className?: string }) {
  const { saved, pending, toggleSave } = useSession();
  // sin cuenta se ve guardado mientras decide si entra; si cierra el login, vuelve a como estaba
  const on = saved.has(eventId) || (pending?.do === "save" && pending.eventId === eventId);
  // cada toque vuelve a montar el ícono para repetir la animación
  const [taps, setTaps] = useState(0);
  const animate = taps > 0;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Quitar de guardados" : "Guardar"}
      onClick={(e) => {
        // dentro de la tarjeta (un Link): no navegar
        e.preventDefault();
        e.stopPropagation();
        setTaps((t) => t + 1);
        toggleSave(eventId);
      }}
      className={clsx(
        "transition-colors duration-300",
        variant === "card" && "grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink",
        variant === "icon" && "grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft",
        variant === "label" && "flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-semibold underline-offset-2 hover:bg-bg-2 hover:underline",
        on && variant === "label" && "text-accent",
        className,
      )}
    >
      <span key={taps} className={clsx("relative grid place-items-center", animate && (on ? "anim-heart-pop" : "anim-shrink"))}>
        <Heart size={variant === "label" ? 16 : 18} className={clsx("transition-[fill,color] duration-300", on && "fill-accent text-accent")} />
        {animate && on && <><span className="anim-ring -m-2" /><span className="anim-sparks" /></>}
      </span>
      {variant === "label" && <span key={`t${taps}`} className={clsx(animate && "anim-text-in")}>{on ? "Guardado" : "Guardar"}</span>}
    </button>
  );
}
