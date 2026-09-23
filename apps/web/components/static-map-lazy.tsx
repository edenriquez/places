"use client";

import dynamic from "next/dynamic";
import clsx from "clsx";

const Inner = dynamic(() => import("./static-map").then((m) => m.StaticMap), { ssr: false });

/** StaticMap diferido: el marco (tamaño, borde) se pinta de inmediato y maplibre llega después. */
export function StaticMap({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
  return (
    <div className={clsx(className, "bg-bg-2")}>
      <Inner lat={lat} lng={lng} className="h-full w-full" />
    </div>
  );
}
