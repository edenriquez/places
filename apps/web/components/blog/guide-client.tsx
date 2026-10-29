"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { CalendarDays, Check, Link2 } from "lucide-react";

/**
 * Píldora flotante "Ver N eventos" mientras se lee: aparece cuando el carrusel de arriba ya salió de pantalla
 * y se esconde al llegar al bloque de eventos, para que el evento siempre quede a un toque.
 */
export function EventsPill({ label }: { label: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const rail = document.getElementById("eventos-arriba");
    const block = document.getElementById("eventos");
    if (!rail || !block) return;
    let railGone = false;
    let blockSeen = false;
    const update = () => setShow(railGone && !blockSeen);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === rail) railGone = !e.isIntersecting && e.boundingClientRect.top < 0;
        // pasado el bloque tampoco: ya se vio
        else blockSeen = e.isIntersecting || e.boundingClientRect.top < 0;
      }
      update();
    });
    io.observe(rail);
    io.observe(block);
    return () => io.disconnect();
  }, []);

  return (
    <a
      href="#eventos"
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      className={clsx(
        "fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-semibold text-on-ink shadow-float transition duration-300",
        "bottom-[calc(76px+env(safe-area-inset-bottom))] lg:bottom-8",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <CalendarDays size={16} aria-hidden />
      {label}
    </a>
  );
}

export function CopyLink({ url, label, done }: { url: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {})}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-line-2 bg-surface px-4 text-[14px] font-semibold text-ink transition hover:border-ink"
    >
      {copied ? <Check size={16} className="text-free" /> : <Link2 size={16} />}
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
