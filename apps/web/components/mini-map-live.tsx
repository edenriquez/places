"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { MAP_STYLE, maplibregl } from "@/lib/maplibre";
import { STATIC_MAP } from "@/lib/static-map";

/** Mapa movible del detalle; se monta encima de la imagen cuando la tocan. `onReady`: ya pintó el estilo. */
export function MiniMapLive({ lat, lng, className, onReady }: { lat: number; lng: number; className?: string; onReady?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ready = useEffectEvent(() => onReady?.());
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current, style: MAP_STYLE, center: [lng, lat], zoom: STATIC_MAP.zoom - 1,
      // dentro del scroll de la página: con un dedo se sigue desplazando la página, con dos se mueve el mapa
      cooperativeGestures: true, dragRotate: false, pitchWithRotate: false,
      attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    map.on("error", (e: { error?: { message?: string } }) => console.error("maplibre:", e.error?.message ?? e));
    map.once("load", () => {
      map.resize();
      // la atribución compacta arranca abierta y tapa medio mapa; queda el botón (i) para verla
      map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      ready();
    });
    const el = document.createElement("div");
    el.style.cssText = "width:14px;height:14px;border-radius:9999px;background:#FF385C;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)";
    new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    return () => map.remove();
  }, [lat, lng]);
  return <div ref={ref} className={className} />;
}
