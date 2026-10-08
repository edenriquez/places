import Link from "next/link";
import clsx from "clsx";

/**
 * Piezas de los loading.tsx. Next precarga el esqueleto de las rutas dinámicas que lo tienen y lo pinta en
 * cuanto tocan el link; sin él, la pantalla se queda quieta hasta que responde el servidor.
 */
export function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("rounded-md bg-line/70 motion-safe:animate-pulse", className)} />;
}

/** Mismo marco que DesktopHeader; el buscador y la sesión llegan con la página. */
export function DesktopHeaderSkeleton() {
  return (
    <header className="sticky top-0 z-40 hidden h-[76px] grid-cols-[minmax(max-content,1fr)_minmax(0,560px)_minmax(max-content,1fr)] items-center gap-6 border-b border-line bg-white/95 px-8 lg:grid">
      <Link href="/" className="justify-self-start font-[family-name:var(--font-jakarta)] text-[20px] font-extrabold tracking-tight text-accent">entrelugares</Link>
      <Bone className="h-12 w-full rounded-full" />
      <Bone className="h-9 w-[360px] justify-self-end rounded-full" />
    </header>
  );
}

/** Tarjeta de lista (EventCard) en espera. */
export function CardSkeleton() {
  return (
    <div className="px-5 py-3">
      <Bone className="aspect-[4/3] rounded-card" />
      <Bone className="mt-3 h-5 w-3/4" />
      <Bone className="mt-2 h-4 w-1/3" />
      <Bone className="mt-1.5 h-4 w-1/2" />
    </div>
  );
}
