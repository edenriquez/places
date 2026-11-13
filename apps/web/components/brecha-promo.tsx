import { ArrowUpRight, Route } from "lucide-react";
import clsx from "clsx";

/** Brecha: rutas y salidas de hiking. Allá se planea la ruta; aquí solo la recomendamos. */
const BRECHA_URL = "https://brecha-web.vercel.app/?utm_source=entrelugares&utm_medium=referral";

/**
 * Promoción de Brecha para planear la ruta. `button` es el CTA solo (barra fija del teléfono);
 * `card` lo acompaña de una explicación (columna lateral de escritorio).
 * `label` identifica la página de origen en analítica; se registra como salida a sitio web.
 */
export function BrechaPromo({ label, variant = "card", className }: { label: string; variant?: "card" | "button"; className?: string }) {
  const cta = (
    <a
      href={BRECHA_URL}
      target="_blank"
      rel="noopener"
      data-track="website"
      data-label={`${label}:brecha`}
      className={clsx(
        "flex items-center justify-center gap-2 rounded-control bg-ink px-5 py-3 text-[15px] font-semibold text-on-ink",
        variant === "button" ? className : "w-full",
      )}
    >
      <Route size={18} aria-hidden /> Planear ruta{variant === "card" && " en Brecha"}
      {variant === "card" && <ArrowUpRight size={16} aria-hidden />}
    </a>
  );
  if (variant === "button") return cta;
  return (
    <section className={clsx("rounded-control bg-accent-soft p-4", className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-accent"><Route size={12} aria-hidden /> Planea tu ruta</p>
      <p className="mt-1 text-[15px] font-semibold leading-snug">Arma el recorrido en Brecha</p>
      <p className="mt-1 mb-3 text-[13px] text-ink-2">Rutas de hiking con mapa, distancia y desnivel, y salidas en grupo a las que te puedes unir.</p>
      {cta}
    </section>
  );
}
