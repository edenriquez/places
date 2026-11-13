"use client";

import type { MouseEvent } from "react";
import { ArrowRight, ArrowUpRight, Route } from "lucide-react";
import clsx from "clsx";

/** Brecha: app (PWA) de rutas y salidas de hiking. Allá se planea la ruta; aquí solo la recomendamos. */
const HOST = "brecha-web.vercel.app";
const PATH = "/?utm_source=entrelugares&utm_medium=referral";
const BRECHA_URL = `https://${HOST}${PATH}`;

/**
 * Saca al usuario del navegador embebido para que Brecha abra como app:
 * - Android: un intent sin paquete abre la PWA instalada y, si no la hay, el navegador predeterminado (Chrome).
 * - iOS (Safari o dentro de una app): intenta Chrome; si no está instalado, sigue al enlace normal.
 *   En Safari sin Chrome aparece antes un aviso de "dirección no válida"; es un costo aceptado.
 * En cualquier otro caso (escritorio, Chrome en iOS) el enlace se comporta como siempre (pestaña nueva).
 */
function openBrecha(e: MouseEvent<HTMLAnchorElement>) {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    e.preventDefault();
    window.location.href = `intent://${HOST}${PATH}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(BRECHA_URL)};end`;
  } else if (/iPhone|iPad|iPod/i.test(ua) && !/CriOS/i.test(ua)) {
    e.preventDefault();
    window.location.href = `googlechromes://${HOST}${PATH}`;
    window.setTimeout(() => { if (!document.hidden) window.location.href = BRECHA_URL; }, 1500);
  }
}

const GREEN = "bg-[linear-gradient(110deg,#0c4a2e,#17734a_55%,#1f9d63)] text-white";

/**
 * Promoción de Brecha para planear la ruta. `bar` es la franja del footer fijo del teléfono;
 * `card` es la tarjeta de la columna lateral de escritorio.
 * `label` identifica la página de origen en analítica; se registra como salida a sitio web.
 */
export function BrechaPromo({ label, variant = "card", className }: { label: string; variant?: "card" | "bar"; className?: string }) {
  const link = {
    href: BRECHA_URL,
    target: "_blank",
    rel: "noopener",
    onClick: openBrecha,
    "data-track": "website",
    "data-label": `${label}:brecha`,
  };

  if (variant === "bar") {
    return (
      <a {...link} className={clsx("brecha-shine relative flex items-center gap-3 overflow-hidden rounded-card px-3.5 py-3 shadow-float", GREEN, className)}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-white/15"><Route size={22} aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold leading-tight">¿Ya sabes por dónde subir?</span>
          <span className="block truncate text-[13px] text-white/85">Planea tu ruta en la app Brecha</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3.5 py-2 text-[14px] font-bold text-[#0c4a2e]">Abrir <ArrowRight size={15} aria-hidden /></span>
      </a>
    );
  }

  return (
    <section className={clsx("brecha-shine relative overflow-hidden rounded-card p-5", GREEN, className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/80"><Route size={13} aria-hidden /> App para planear tu ruta</p>
      <p className="mt-2 text-[20px] font-bold leading-tight">¿Ya sabes por dónde subir?</p>
      <p className="mt-1.5 text-[14px] leading-snug text-white/85">Traza el camino en Brecha antes de salir: mapa, distancia y desnivel de cada ruta, y salidas en grupo para no ir solo.</p>
      <a {...link} className="mt-4 flex w-full items-center justify-center gap-2 rounded-control bg-white px-5 py-3 text-[15px] font-bold text-[#0c4a2e]">
        Planear mi ruta en Brecha <ArrowUpRight size={16} aria-hidden />
      </a>
    </section>
  );
}
