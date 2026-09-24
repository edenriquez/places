"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { Info, Loader2, LocateFixed } from "lucide-react";
import { EXPLORE, RADII, radiusLabel, type Loc } from "@/lib/location";
import { RadiusSlider } from "./radius-slider";
import { setLocation } from "@/app/actions";
import { MAP_STYLE, maplibregl } from "@/lib/maplibre";
import type { NearRow } from "@/lib/types";
import { fmtDistance, fmtPrice } from "@/lib/format";
import { CompactCard } from "./event-card";
import { track } from "@/lib/track";


type BBox = [[number, number], [number, number]];
const DEM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
/** overlay: mapa a pantalla completa con tarjetas encima (móvil). panel: columna derecha del split de escritorio; la lista vive a la izquierda. */
/** focus: evento abierto en el panel; el mapa se centra en él. nearest: lo más cercano fuera del radio, para sugerirlo cuando no hay nada dentro. */
type Props = { events: (NearRow & { lat: number; lng: number })[]; loc: Loc; stateBounds?: BBox; variant?: "overlay" | "panel"; focus?: { id: string; lat: number; lng: number } | null; nearest?: NearRow | null };

/** Polígono del área cubierta (círculo de `km` alrededor del centro) para dibujarla en el mapa. */
type Area = { type: "Feature"; properties: object; geometry: { type: "Polygon"; coordinates: [number, number][][] } };
function circleGeo(lat: number, lng: number, km: number): Area {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    pts.push([lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (km / 111.32) * Math.sin(a)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [pts] } };
}
const EMPTY_GEO = { type: "FeatureCollection" as const, features: [] };

/** Caja que contiene el círculo del radio (grados aprox., suficiente a esta escala). */
function circleBox(lat: number, lng: number, km: number): BBox {
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [[lng - dLng, lat - dLat], [lng + dLng, lat + dLat]];
}


export function EventMap({ events, loc, stateBounds, variant = "overlay", focus, nearest }: Props) {
  const panel = variant === "panel";
  const { lat, lng, radiusKm, stateCve } = loc;
  // el mapa no deja alejarse ni moverse más allá del radio elegido (o del estado); acercarse, sin límite
  // Explorar (radiusKm = 0): sin límites; arranca mostrando ~30 km alrededor
  const explore = !stateCve && radiusKm === EXPLORE;
  const limit = useMemo<BBox>(() => (stateCve && stateBounds ? stateBounds : circleBox(lat, lng, radiusKm || 30)), [stateCve, stateBounds, lat, lng, radiusKm]);
  const limitKey = JSON.stringify(limit);
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const detailHref = (slug: string) => {
    const q = new URLSearchParams(search.toString());
    q.set("e", slug);
    return `${pathname}?${q.toString()}`;
  };
  // tocar un pin abre su detalle (escritorio: panel izquierdo; móvil: hoja inferior) en el panel izquierdo (?e=slug); ref para no recrear los pines
  const openRef = useRef<(slug: string) => void>(() => {});
  useEffect(() => {
    openRef.current = (slug: string) => {
      const q = new URLSearchParams(search.toString());
      q.set("e", slug);
      router.push(`${pathname}?${q.toString()}`, { scroll: false });
    };
  }, [router, pathname, search]);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // límite del radio (base) y límite vigente: al abrir un evento fuera del radio se amplía para incluirlo
  const baseRef = useRef<BBox | null>(null);
  const limitRef = useRef<BBox | null>(null);
  const syncRef = useRef<() => void>(() => {});
  const [activeId, setActiveId] = useState<string | null>(events[0]?.event_id ?? null);
  const listRef = useRef<HTMLDivElement>(null);

  // un pin por evento (aunque tenga varias ocurrencias)
  const pins = useMemo(() => {
    const seen = new Set<string>();
    return events.filter((e) => (seen.has(e.event_id) ? false : (seen.add(e.event_id), true)));
  }, [events]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    // en pantallas altas se estira la caja a lo alto para que el círculo completo quepa a lo ancho
    const [[w, s], [e, n]] = JSON.parse(limitKey) as BBox;
    const aspect = ref.current.clientHeight / Math.max(ref.current.clientWidth, 1);
    const extra = Math.max(0, ((e - w) * Math.cos((((s + n) / 2) * Math.PI) / 180) * aspect - (n - s)) / 2);
    const box: BBox = [[w, s - extra], [e, n + extra]];
    baseRef.current = box;
    limitRef.current = box;
    const map = new maplibregl.Map({
      container: ref.current,
      style: MAP_STYLE,
      bounds: box,
      maxBounds: explore ? undefined : box,
      pitch: 45,
      maxPitch: 65,
      attributionControl: { compact: true },
    });
    // relieve: modelo de elevación abierto (Terrarium de Mapzen/AWS, sin llave) para terreno 3D y sombreado
    map.once("load", () => {
      map.addSource("dem", { type: "raster-dem", tiles: [DEM_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 14, attribution: "Elevación: Mapzen, AWS Terrain Tiles" });
      map.addSource("dem-shade", { type: "raster-dem", tiles: [DEM_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 14 });
      const firstLabel = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
      map.addLayer({ id: "hillshade", type: "hillshade", source: "dem-shade", paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#5b5b52", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#8a8a7a" } }, firstLabel);
      map.setTerrain({ source: "dem", exaggeration: 1.4 });
      // área cubierta por el radio elegido (el deslizador la redibuja al arrastrar)
      map.addSource("radius", { type: "geojson", data: explore || stateCve ? EMPTY_GEO : circleGeo(lat, lng, radiusKm) });
      map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#ff385c", "fill-opacity": 0.06 } }, firstLabel);
      map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#ff385c", "line-width": 2, "line-opacity": 0.55, "line-dasharray": [2, 1.5] } }, firstLabel);
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // el límite real de alejamiento es la caja (maxBounds), no minZoom; se iguala para que el control
    // "−" se deshabilite justo cuando ya no se puede alejar (y "+" en el zoom máximo)
    const syncMinZoom = () => {
      if (explore || !limitRef.current) return;
      const z = map.cameraForBounds(limitRef.current)?.zoom;
      if (z == null) return;
      map.setMinZoom(z);
      if (map.getZoom() - z < 0.01) map.setZoom(z);
    };
    syncRef.current = syncMinZoom;
    map.once("load", syncMinZoom);
    map.on("resize", syncMinZoom);
    map.on("error", (e: { error?: { message?: string } }) => console.error("maplibre:", e.error?.message ?? e));
    map.once("load", () => map.resize());
    if (process.env.NODE_ENV === "development") (window as unknown as { __map?: maplibregl.Map }).__map = map;
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [limitKey, lat, lng, radiusKm, stateCve, explore]);

  // pines: se crean cuando cambia la lista (y se encuadran); el activo solo cambia de clase, sin mover el mapa
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = pins.map((e) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "el-pin";
      el.dataset.pin = e.event_id;
      el.textContent = fmtPrice(e.is_free, e.price_min, e.price_max);
      el.addEventListener("click", () => {
        setActiveId(e.event_id);
        return openRef.current(e.slug);
        // móvil: la tarjeta del carrusel; escritorio: la tarjeta de la lista de la izquierda
        const card = panel
          ? document.querySelector<HTMLElement>(`[data-event-id="${e.event_id}"]`)
          : listRef.current?.querySelector<HTMLElement>(`[data-id="${e.event_id}"]`);
        card?.scrollIntoView({ behavior: "smooth", inline: "center", block: panel ? "center" : "nearest" });
      });
      return new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([e.lng, e.lat]).addTo(map);
    });
    if (pins.length > 1) {
      const b = new maplibregl.LngLatBounds();
      pins.forEach((e) => b.extend([e.lng, e.lat]));
      map.fitBounds(b, { padding: panel ? 80 : { top: 120, bottom: 240, left: 40, right: 40 }, maxZoom: 13, duration: 0 });
    }
  }, [pins, panel]);

  const shownActive = focus?.id ?? activeId;
  useEffect(() => {
    markersRef.current.forEach((m) => {
      const el = m.getElement();
      el.classList.toggle("is-active", el.dataset.pin === shownActive);
    });
  }, [shownActive, pins]);

  // evento abierto: centrarlo (acercando si hace falta) y resaltar su pin
  const focusKey = focus ? `${focus.id}:${focus.lat}:${focus.lng}` : "";
  useEffect(() => {
    const map = mapRef.current;
    const base = baseRef.current;
    if (!map || !base) return;
    const setLimit = (b: BBox) => {
      limitRef.current = b;
      if (explore) return;
      map.setMaxBounds(b);
      syncRef.current();
    };
    if (!focus) {
      // de vuelta a la lista: regresar al radio elegido (animado, y luego se vuelve a fijar el límite)
      if (limitRef.current !== base) {
        map.setMaxBounds(null);
        map.setMinZoom(0);
        map.fitBounds(base, { duration: 600 });
        map.once("moveend", () => setLimit(base));
      }
      return;
    }
    const [[w, s], [e, n]] = base;
    const inside = focus.lng >= w && focus.lng <= e && focus.lat >= s && focus.lat <= n;
    if (!inside) {
      // evento sugerido fuera del radio: el límite se amplía lo justo para incluirlo
      const [[fw, fs], [fe, fn]] = circleBox(focus.lat, focus.lng, 5);
      setLimit([[Math.min(w, fw), Math.min(s, fs)], [Math.max(e, fe), Math.max(n, fn)]]);
    } else if (limitRef.current !== base) {
      setLimit(base);
    }
    // flyTo funciona aunque el estilo siga cargando; loaded() queda en false mientras bajan teselas
    map.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 12.5), duration: 900, essential: true, offset: panel ? [0, 0] : [0, -Math.round(map.getContainer().clientHeight * 0.25)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, limitKey]);

  // "estás aquí" cuando la ubicación viene del GPS
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loc.gps) return;
    const el = document.createElement("div");
    el.className = "el-me";
    el.title = "Estás aquí";
    const m = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    return () => { m.remove(); };
  }, [loc.gps, lat, lng, limitKey, stateCve, explore]);

  // escritorio: pasar el mouse por una tarjeta de la lista resalta su pin
  useEffect(() => {
    if (!panel) return;
    const over = (ev: MouseEvent) => {
      const id = (ev.target as HTMLElement).closest<HTMLElement>("[data-event-id]")?.dataset.eventId;
      if (id) setActiveId(id);
    };
    document.addEventListener("mouseover", over);
    return () => document.removeEventListener("mouseover", over);
  }, [panel]);

  // deslizador: mientras arrastra solo se redibuja el área y se mueve la cámara; al soltar se busca
  function previewRadius(km: number) {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource("radius") as maplibregl.GeoJSONSource | undefined)?.setData(km === EXPLORE ? EMPTY_GEO : circleGeo(lat, lng, km));
    map.setMaxBounds(null);
    map.setMinZoom(0);
    map.fitBounds(circleBox(lat, lng, km === EXPLORE ? 150 : km), { padding: panel ? 60 : { top: 260, bottom: 200, left: 24, right: 24 }, duration: 350 });
  }

  function apply(next: Loc) {
    start(async () => { await setLocation(next); track("search", { props: { label: next.label, mode: "mapa" } }); router.refresh(); });
  }
  // "mi ubicación": centra el mapa ahí de inmediato y guarda la búsqueda al radio más corto (1 h)
  function locate() {
    navigator.geolocation?.getCurrentPosition((p) => {
      const { latitude: la, longitude: lo } = p.coords;
      const map = mapRef.current;
      if (map) {
        map.setMaxBounds(null);
        map.setMinZoom(0);
        map.fitBounds(circleBox(la, lo, RADII[0]), { padding: panel ? 40 : 24, duration: 600 });
      }
      apply({ lat: la, lng: lo, radiusKm: RADII[0], label: "Tu ubicación", gps: true });
    });
  }

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="h-full w-full" />
      <style>{`
        .el-pin{background:#fff;color:#222;border:1px solid #ddd;border-radius:9999px;padding:6px 12px;font:600 13px var(--font-inter),system-ui;box-shadow:0 2px 8px rgba(0,0,0,.15);cursor:pointer;transform:translateY(-4px)}
        .el-me{width:18px;height:18px;border-radius:9999px;background:#1a73e8;border:3px solid #fff;box-shadow:0 0 0 6px rgba(26,115,232,.2),0 1px 4px rgba(0,0,0,.3)}
        .maplibregl-ctrl-group button:disabled{cursor:not-allowed;background:#fafafa}
        .maplibregl-ctrl-group button:disabled .maplibregl-ctrl-icon{opacity:.25}
        .el-pin.is-active{background:#222;color:#fff;border-color:#222;z-index:2}
        .maplibregl-ctrl-top-right{top:${panel ? 64 : 180}px;right:${panel ? 12 : 8}px}
      `}</style>
      <button type="button" onClick={locate} aria-label="Mi ubicación" className={clsx("absolute grid h-10 w-10 place-items-center rounded-full bg-white shadow-float", panel ? "right-4 top-4" : "right-5 top-[132px]")}>
        {pending ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
      </button>
      {!stateCve && (
        <div className={clsx("absolute left-1/2 z-10 -translate-x-1/2", panel ? "top-4" : "top-[84px]")}>
          <RadiusSlider
            value={radiusKm}
            steps={[...RADII, EXPLORE]}
            place={loc.label === "Tu ubicación" ? "tu ubicación" : loc.label}
            onPreview={previewRadius}
            onCommit={(km) => apply({ ...loc, radiusKm: km })}
            pending={pending}
            defaultOpen={panel}
            closeOnCommit={!panel}
          />
        </div>
      )}
      {pins.length === 0 && (
        <div role="status" className={clsx("absolute left-1/2 z-10 flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-full bg-white py-1.5 pl-3 pr-1.5 text-[13px] shadow-float", panel ? "top-[68px]" : "bottom-[calc(146px+env(safe-area-inset-bottom))]")}>
          <Info size={15} className="shrink-0 text-ink-2" />
          {nearest && !explore ? (
            <>
              <span className="min-w-0 truncate text-ink-2">
                {stateCve ? `Nada en ${loc.label}` : `Nada a ${radiusLabel(radiusKm)}`} · lo más cercano: <span className="font-semibold text-ink">{nearest.title}</span> · {fmtDistance(nearest.distance_m)}
              </span>
              <Link href={detailHref(nearest.slug)} scroll={false} className="shrink-0 rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-white">Ver</Link>
            </>
          ) : (
            <span className="truncate text-ink-2">{stateCve ? `Sin eventos en ${loc.label} por ahora` : explore ? "Sin eventos por ahora" : `Nada a ${radiusLabel(radiusKm)} por ahora`}</span>
          )}
          {!nearest && !stateCve && !explore && (
            <button type="button" disabled={pending} onClick={() => apply({ ...loc, radiusKm: RADII.find((r) => r > radiusKm) ?? EXPLORE })} className="shrink-0 rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-60">
              {RADII.find((r) => r > radiusKm) ? `Ver a ${radiusLabel(RADII.find((r) => r > radiusKm)!)}` : "Explorar"}
            </button>
          )}
        </div>
      )}
      <div ref={listRef} className={clsx(panel && "hidden", "no-scrollbar absolute inset-x-0 bottom-[calc(142px+env(safe-area-inset-bottom))] flex snap-x gap-3 overflow-x-auto px-5 pb-1")}>
        {pins.map((e) => (
          <div key={e.event_id} data-id={e.event_id} onMouseEnter={() => setActiveId(e.event_id)} onClick={() => setActiveId(e.event_id)}>
            <CompactCard e={e} active={e.event_id === shownActive} href={detailHref(e.slug)} />
          </div>
        ))}
      </div>
    </div>
  );
}
