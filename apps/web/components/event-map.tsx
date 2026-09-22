"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { MAP_STYLE, maplibregl } from "@/lib/maplibre";
import type { NearRow } from "@/lib/types";
import { fmtPrice } from "@/lib/format";
import { CompactCard } from "./event-card";


type Props = { events: (NearRow & { lat: number; lng: number })[]; center: { lat: number; lng: number }; radiusKm: number };

export function EventMap({ events, center, radiusKm }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [activeId, setActiveId] = useState<string | null>(events[0]?.event_id ?? null);
  const listRef = useRef<HTMLDivElement>(null);

  // un pin por evento (aunque tenga varias ocurrencias)
  const pins = useMemo(() => {
    const seen = new Set<string>();
    return events.filter((e) => (seen.has(e.event_id) ? false : (seen.add(e.event_id), true)));
  }, [events]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: MAP_STYLE,
      center: [center.lng, center.lat],
      zoom: radiusKm <= 10 ? 12 : radiusKm <= 30 ? 10.3 : 9.3,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (e: { error?: { message?: string } }) => console.error("maplibre:", e.error?.message ?? e));
    map.once("load", () => map.resize());
    if (process.env.NODE_ENV === "development") (window as unknown as { __map?: maplibregl.Map }).__map = map;
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [center.lat, center.lng, radiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = pins.map((e) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `el-pin${e.event_id === activeId ? " is-active" : ""}`;
      el.textContent = fmtPrice(e.is_free, e.price_min, e.price_max);
      el.addEventListener("click", () => {
        setActiveId(e.event_id);
        const card = listRef.current?.querySelector<HTMLElement>(`[data-id="${e.event_id}"]`);
        card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      });
      return new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([e.lng, e.lat]).addTo(map);
    });
    if (pins.length > 1) {
      const b = new maplibregl.LngLatBounds();
      pins.forEach((e) => b.extend([e.lng, e.lat]));
      map.fitBounds(b, { padding: { top: 120, bottom: 240, left: 40, right: 40 }, maxZoom: 13, duration: 0 });
    }
  }, [pins, activeId]);

  function locate() {
    navigator.geolocation?.getCurrentPosition((p) => mapRef.current?.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 12 }));
  }

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="h-full w-full" />
      <style>{`
        .el-pin{background:#fff;color:#222;border:1px solid #ddd;border-radius:9999px;padding:6px 12px;font:600 13px var(--font-inter),system-ui;box-shadow:0 2px 8px rgba(0,0,0,.15);cursor:pointer;transform:translateY(-4px)}
        .el-pin.is-active{background:#222;color:#fff;border-color:#222;z-index:2}
      `}</style>
      <button type="button" onClick={locate} aria-label="Mi ubicación" className="absolute right-3 top-[104px] grid h-10 w-10 place-items-center rounded-full bg-white shadow-float">
        <LocateFixed size={18} />
      </button>
      <div ref={listRef} className="no-scrollbar absolute inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] flex snap-x gap-3 overflow-x-auto px-5 pb-1">
        {pins.map((e) => (
          <div key={e.event_id} data-id={e.event_id} onMouseEnter={() => setActiveId(e.event_id)} onClick={() => setActiveId(e.event_id)}>
            <CompactCard e={e} active={e.event_id === activeId} />
          </div>
        ))}
      </div>
    </div>
  );
}
