"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { afterLoad } from "@/lib/idle";

const Inner = dynamic(() => import("./static-map").then((m) => m.StaticMap), { ssr: false });

/**
 * StaticMap diferido: el marco (tamaño, borde) se pinta de inmediato y maplibre (~430 KB con su worker,
 * más teselas) llega cuando la página ya cargó y el mapa está cerca del viewport. Evaluarlo tarda >1 s en
 * un teléfono de gama media y antes retrasaba el flyer.
 */
export function StaticMap({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let io: IntersectionObserver | undefined;
    const cancel = afterLoad(() => {
      io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        setShow(true);
        io?.disconnect();
      }, { rootMargin: "200px" });
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
    };
  }, []);
  return (
    <div ref={ref} className={clsx(className, "bg-bg-2")}>
      {show && <Inner lat={lat} lng={lng} className="h-full w-full" />}
    </div>
  );
}
