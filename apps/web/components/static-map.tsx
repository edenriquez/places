"use client";

import { useEffect, useRef } from "react";
import { MAP_STYLE, maplibregl } from "@/lib/maplibre";

/** Mini mapa no interactivo para el detalle de evento. */
export function StaticMap({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current, style: MAP_STYLE, center: [lng, lat], zoom: 14,
      interactive: false, attributionControl: false,
    });
    map.on("error", (e: { error?: { message?: string } }) => console.error("maplibre:", e.error?.message ?? e));
    map.once("load", () => map.resize());
    const el = document.createElement("div");
    el.style.cssText = "width:14px;height:14px;border-radius:9999px;background:#FF385C;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)";
    new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    return () => map.remove();
  }, [lat, lng]);
  return <div ref={ref} className={className} />;
}
