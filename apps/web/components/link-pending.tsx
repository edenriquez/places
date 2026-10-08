"use client";

import { useLinkStatus } from "next/link";
import clsx from "clsx";

/**
 * Confirma el toque mientras responde el servidor (rutas sin loading.tsx: Explorar con filtros, /mapa).
 * Va dentro de un <Link>. Aparece con 100 ms de retraso para no parpadear cuando la navegación es rápida.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={clsx(
        "pointer-events-none absolute transition-opacity duration-150",
        pending ? "opacity-100 delay-100 motion-safe:animate-pulse" : "opacity-0",
        className,
      )}
    />
  );
}

/** Para pestañas: el ícono toma el color de activo en cuanto lo tocan. */
export function usePendingLink() {
  return useLinkStatus().pending;
}
