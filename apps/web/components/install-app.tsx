"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { Check, Download, EllipsisVertical, Share, SquarePlus } from "lucide-react";
import { SITE_NAME } from "@/lib/site";

type Platform = "ios" | "android" | "desktop";
/** Chrome y Edge: el aviso nativo de instalar, guardado para lanzarlo con un botón */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const TABS: { key: Platform; label: string }[] = [
  { key: "ios", label: "iPhone" },
  { key: "android", label: "Android" },
  { key: "desktop", label: "Computadora" },
];

const steps = (host: string): Record<Platform, { text: React.ReactNode; icon?: React.ReactNode }[]> => ({
  ios: [
    { text: <>Abre <b>{host}</b> en Safari</> },
    { text: <>Toca <b>Compartir</b> en la barra de abajo</>, icon: <Share size={16} /> },
    { text: <>Desliza y elige <b>Agregar a inicio</b></>, icon: <SquarePlus size={16} /> },
    { text: <>Toca <b>Agregar</b>: el ícono aparece junto a tus apps</> },
  ],
  android: [
    { text: <>Abre <b>{host}</b> en Chrome</> },
    { text: <>Toca el menú <b>⋮</b> arriba a la derecha</>, icon: <EllipsisVertical size={16} /> },
    { text: <>Elige <b>Instalar app</b> o <b>Agregar a la pantalla principal</b></>, icon: <Download size={16} /> },
    { text: <>Confirma con <b>Instalar</b></> },
  ],
  desktop: [
    { text: <>Abre <b>{host}</b> en Chrome o Edge</> },
    { text: <>Haz clic en el ícono de instalar al final de la barra de direcciones</>, icon: <Download size={16} /> },
    { text: <>O abre el menú <b>⋮</b> y elige <b>Instalar {SITE_NAME}</b></>, icon: <EllipsisVertical size={16} /> },
    { text: <>En Safari para Mac: <b>Archivo → Agregar al Dock</b></> },
  ],
});

function detect(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const installed = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const noop = () => () => {};

/**
 * Perfil: cómo agregar la app a la pantalla de inicio, con los pasos del dispositivo en que se abre.
 * `host` viene del servidor: en el navegador SITE_URL no ve la URL de producción de Vercel.
 */
export function InstallApp({ host }: { host: string }) {
  // en el servidor no se sabe el dispositivo: se elige al hidratar
  const detected = useSyncExternalStore(noop, detect, () => null);
  const isInstalled = useSyncExternalStore(noop, installed, () => false);
  const [picked, setPicked] = useState<Platform | null>(null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [done, setDone] = useState(false);
  const platform = picked ?? detected ?? "ios";

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => { setDone(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setDone(true);
    setPrompt(null);
  }

  if (isInstalled || done) {
    return (
      <section className="flex items-center gap-3 rounded-card border border-line bg-white p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-free-bg text-free"><Check size={18} /></span>
        <div>
          <h2 className="text-[16px] font-bold">Ya tienes la app</h2>
          <p className="text-[13px] text-ink-2">{SITE_NAME} está en tu pantalla de inicio.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- ícono estático de la app */}
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-[12px] shadow-soft" />
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold">Instala la app</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">Ten {SITE_NAME} en tu pantalla de inicio: abre a pantalla completa, sin buscarla en el navegador.</p>
        </div>
      </div>

      {prompt && (
        <button type="button" onClick={install} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-semibold text-white">
          <Download size={16} /> Instalar {SITE_NAME}
        </button>
      )}

      <div role="tablist" aria-label="Dispositivo" className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-bg-2 p-1 text-[13px] font-semibold">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={platform === t.key} onClick={() => setPicked(t.key)}
            className={clsx("rounded-full py-1.5 transition-colors", platform === t.key ? "bg-white text-ink shadow-soft" : "text-ink-2")}>
            {t.label}
          </button>
        ))}
      </div>

      <ol className="mt-4 space-y-3" role="tabpanel">
        {steps(host)[platform].map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-[14px]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-white">{i + 1}</span>
            <span className="min-w-0 flex-1">{s.text}</span>
            {s.icon && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-bg-2 text-ink">{s.icon}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
