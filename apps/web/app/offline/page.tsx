import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { SITE_NAME } from "@/lib/site";
import { RetryButton } from "./retry-button";

// el service worker la guarda al instalarse y la muestra cuando una página no carga por falta de red
export const dynamic = "force-static";
export const metadata: Metadata = { title: "Sin conexión", robots: { index: false, follow: false } };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-bg-2">
        <WifiOff size={24} className="text-ink-2" />
      </span>
      <h1 className="mt-4 text-[22px] font-bold">Sin conexión</h1>
      <p className="mt-1 text-[14px] text-ink-2">
        {SITE_NAME} necesita internet para mostrarte qué hay cerca. Revisa tu señal y vuelve a intentar.
      </p>
      <RetryButton />
    </main>
  );
}
