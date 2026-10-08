"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { Move } from "lucide-react";
import { STATIC_MAP, staticMapSrc } from "@/lib/static-map";

const Live = dynamic(() => import("./mini-map-live").then((m) => m.MiniMapLive), { ssr: false });

/**
 * Mini mapa del detalle: una imagen ya cortada a 1:1 (sin JS ni teselas vectoriales) con el pin al centro.
 * maplibre (~430 KB con su worker, más teselas) solo se baja si lo tocan; mientras carga sigue la imagen.
 * La imagen es lazy: en el layout que CSS esconde (teléfono o escritorio) no se descarga.
 */
export function MiniMap({ slug, lat, lng, className }: { slug: string; lat: number; lng: number; className?: string }) {
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  return (
    <div className={clsx(className, "relative bg-bg-2")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ya sale del servidor en webp y del tamaño final */}
      <img
        src={staticMapSrc(slug, { lat, lng })}
        alt=""
        width={STATIC_MAP.w}
        height={STATIC_MAP.h}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-none"
      />
      {/* maplibre le pone position: relative a su contenedor: el absoluto va en un div aparte */}
      {live && (
        <div className="absolute inset-0">
          <Live lat={lat} lng={lng} onReady={() => setReady(true)} className="h-full w-full" />
        </div>
      )}
      {!ready && (
        <>
          <span aria-hidden className="absolute left-1/2 top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-accent shadow-[0_1px_4px_rgba(0,0,0,.3)]" />
          <button
            type="button"
            onClick={() => setLive(true)}
            disabled={live}
            aria-label="Mover el mapa"
            className="absolute inset-0 flex items-end justify-end p-2"
          >
            <span className="flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold shadow-soft">
              <Move size={13} /> {live ? "Cargando mapa…" : "Mover mapa"}
            </span>
          </button>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-1 left-2 text-[10px] text-ink-2 underline-offset-2 hover:underline"
          >
            © OpenStreetMap
          </a>
        </>
      )}
    </div>
  );
}
