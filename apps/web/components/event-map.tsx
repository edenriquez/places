"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { Info, Loader2, LocateFixed, Users } from "lucide-react";
import { EXPLORE, RADII, radiusLabel, type Loc } from "@/lib/location";
import { RadiusSlider } from "./radius-slider";
import { setLocation } from "@/app/actions";
import { MAP_STYLE, maplibregl } from "@/lib/maplibre";
import type { NearRow } from "@/lib/types";
import { fmtDistance, fmtPrice } from "@/lib/format";
import type { GroupPlan } from "@/lib/group-plans";
import { CompactCard } from "./event-card";
import { PlanMapCard } from "./plans/plan-map-card";
import { ReachChip } from "./reach-chip";
import { track } from "@/lib/track";


type BBox = [[number, number], [number, number]];
const DEM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
/** overlay: mapa a pantalla completa con tarjetas encima (móvil). panel: columna derecha del split de escritorio; la lista vive a la izquierda. */
/** focus: evento abierto en el panel; el mapa se centra en él. nearest: lo más cercano fuera del radio, para sugerirlo cuando no hay nada dentro. */
/** plans: planes abiertos de la comunidad; con ellos, el mapa móvil puede cambiar a verlos solo a ellos (?ver=planes). */
/** searchBar: el buscador de lugar; en móvil comparte píldora con "Mi ubicación". */
type Props = { events: (NearRow & { lat: number; lng: number })[]; plans?: GroupPlan[]; searchBar?: React.ReactNode; loc: Loc; stateBounds?: BBox; variant?: "overlay" | "panel"; focus?: { id: string; lat: number; lng: number } | null; nearest?: NearRow | null };

/** Un punto en el mapa: un evento o un plan. `target`: el evento o experiencia al que lleva (para resaltar el abierto). */
type Pin = { id: string; target: string; lat: number; lng: number; label: string; slug: string; experience?: boolean };
const USERS_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

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

/** alto del chip de precio sobre su punto (anchor bottom + translateY(-4px)) */
const PIN_H = 36;

/**
 * Móvil: franja del mapa que no tapan los controles de arriba ni el carrusel de abajo,
 * en px del contenedor. Ahí debe quedar el pin del evento activo.
 */
function visibleBand(map: maplibregl.Map, tops: (HTMLElement | null)[], list: HTMLElement | null) {
  const c = map.getContainer().getBoundingClientRect();
  const t = Math.max(84, ...tops.map((el) => { const r = el?.getBoundingClientRect(); return r?.height ? r.bottom - c.top : 0; }));
  const l = list?.getBoundingClientRect();
  return {
    top: t + 8,
    bottom: (l?.height ? l.top - c.top : c.height - 260) - 8,
    width: c.width,
    height: c.height,
  };
}

/** Distancia en km entre dos puntos (haversine). */
function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** Pasos del alcance del mapa móvil; después de 3 h, toda la región. */
const STEPS = [...RADII, EXPLORE];
/** Paso que cubre `km` (con holgura, para que el encuadre inicial de 30 min no cuente ya como 1 h). */
const stepFor = (km: number) => RADII.find((r) => km <= r * 1.2) ?? EXPLORE;
/** Paso más chico que incluye algo a `km`. */
const stepCovering = (km: number) => RADII.find((r) => km <= r) ?? EXPLORE;
const stepIdx = (km: number) => STEPS.indexOf(km);
/** Media pantalla a lo ancho, en km, a este zoom (teselas de 512 px). */
const halfWidthKm = (map: maplibregl.Map, lat: number) =>
  ((40075.016686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom())) * (map.getContainer().clientWidth / 2);


export function EventMap({ events, plans, searchBar, loc, stateBounds, variant = "overlay", focus, nearest }: Props) {
  const panel = variant === "panel";
  const { lat, lng, radiusKm, stateCve } = loc;
  // escritorio: el mapa no deja alejarse ni moverse más allá del radio elegido (o del estado); acercarse, sin límite.
  // Explorar (radiusKm = 0) y móvil: sin límites
  const explore = !stateCve && radiusKm === EXPLORE;
  const free = explore || !panel;
  // móvil con radio: el alcance lo decide el zoom (arranca en 30 min) y solo se ve lo que queda dentro
  const dynamic = !panel && !stateCve;
  const [reachKm, setReachKm] = useState<number>(RADII[0]);
  const [reachFor, setReachFor] = useState(`${lat},${lng}`);
  if (reachFor !== `${lat},${lng}`) {
    setReachFor(`${lat},${lng}`);
    setReachKm(RADII[0]);
  }
  // un evento abierto más lejos del alcance lo amplía hasta incluirlo
  const focusStep = dynamic && focus ? stepCovering(distKm(lat, lng, focus.lat, focus.lng)) : null;
  const [seenFocus, setSeenFocus] = useState(focus?.id);
  if (seenFocus !== focus?.id) {
    setSeenFocus(focus?.id);
    if (focusStep != null && stepIdx(focusStep) > stepIdx(reachKm)) setReachKm(focusStep);
  }
  const reachLimit = dynamic && reachKm !== EXPLORE ? reachKm : Infinity;
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
  // tocar un pin abre su detalle (escritorio: panel izquierdo; móvil: hoja inferior) con ?e=slug; las experiencias,
  // en su página. Ref para no recrear los pines
  const openRef = useRef<(pin: Pin) => void>(() => {});
  useEffect(() => {
    openRef.current = (pin: Pin) => {
      if (pin.experience) return router.push(`/experiencia/${pin.slug}`);
      const q = new URLSearchParams(search.toString());
      q.set("e", pin.slug);
      router.push(`${pathname}?${q.toString()}`, { scroll: false });
    };
  }, [router, pathname, search]);
  const showPlans = !panel && !!plans && search.get("ver") === "planes";
  function setShowPlans(on: boolean) {
    const url = new URL(window.location.href);
    if (on) url.searchParams.set("ver", "planes");
    else url.searchParams.delete("ver");
    window.history.replaceState(null, "", url);
    if (on) track("filter", { props: { map: "comunidades", count: plans?.length ?? 0 } });
  }
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // límite del radio (base) y límite vigente: al abrir un evento fuera del radio se amplía para incluirlo
  const baseRef = useRef<BBox | null>(null);
  const limitRef = useRef<BBox | null>(null);
  const syncRef = useRef<() => void>(() => {});
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  // lo que tapa el mapa por arriba: el deslizador (escritorio) o el selector y el alcance (móvil)
  const tops = () => [topRef.current, modeRef.current, chipRef.current];

  // un pin por evento (aunque tenga varias ocurrencias)
  const allEvents = useMemo(() => {
    const seen = new Set<string>();
    return events.filter((e) => (seen.has(e.event_id) ? false : (seen.add(e.event_id), true)));
  }, [events]);
  const allPlans = useMemo(() => (plans ?? []).map((p) => ({ p, km: distKm(lat, lng, p.target.lat!, p.target.lng!) })), [plans, lat, lng]);
  const eventList = useMemo(() => allEvents.filter((e) => e.distance_m / 1000 <= reachLimit), [allEvents, reachLimit]);
  const planList = useMemo(() => allPlans.filter((x) => x.km <= reachLimit).map((x) => x.p), [allPlans, reachLimit]);
  // paso que alcanza lo más cercano que queda fuera, para sugerir alejar el mapa
  const nextOut = useMemo(() => {
    const out = (showPlans ? allPlans.map((x) => x.km) : allEvents.map((e) => e.distance_m / 1000)).filter((km) => km > reachLimit);
    return out.length ? stepCovering(Math.min(...out)) : null;
  }, [reachLimit, showPlans, allPlans, allEvents]);
  const pins = useMemo<Pin[]>(() => showPlans
    ? planList.map((p) => ({ id: p.id, target: p.target.id, lat: p.target.lat!, lng: p.target.lng!, label: String(p.going), slug: p.target.slug, experience: p.target.kind === "experience" }))
    : eventList.map((e) => ({ id: e.event_id, target: e.event_id, lat: e.lat, lng: e.lng, label: fmtPrice(e.is_free, e.price_min, e.price_max), slug: e.slug })),
  [showPlans, planList, eventList]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    // en pantallas altas se estira la caja a lo alto para que el círculo completo quepa a lo ancho
    const [[w, s], [e, n]] = JSON.parse(limitKey) as BBox;
    const aspect = ref.current.clientHeight / Math.max(ref.current.clientWidth, 1);
    const extra = Math.max(0, ((e - w) * Math.cos((((s + n) / 2) * Math.PI) / 180) * aspect - (n - s)) / 2);
    const box: BBox = [[w, s - extra], [e, n + extra]];
    baseRef.current = box;
    limitRef.current = box;
    // móvil con radio: arranca encuadrando 30 min en la franja que no tapan los controles ni el carrusel
    const c = ref.current.getBoundingClientRect();
    const below = (el: HTMLElement | null) => { const r = el?.getBoundingClientRect(); return r?.height ? r.bottom - c.top : 0; };
    const listTop = listRef.current?.getBoundingClientRect();
    const map = new maplibregl.Map({
      container: ref.current,
      style: MAP_STYLE,
      bounds: dynamic ? circleBox(lat, lng, RADII[0]) : box,
      fitBoundsOptions: dynamic ? {
        padding: {
          top: Math.max(84, below(modeRef.current)) + 8,
          bottom: listTop?.height ? c.bottom - listTop.top + 8 : 268,
          left: 16,
          right: 16,
        },
      } : undefined,
      maxBounds: free ? undefined : box,
      pitch: 45,
      maxPitch: 65,
      attributionControl: { compact: true },
    });
    // móvil: al terminar de mover o hacer zoom a mano se recalcula hasta dónde se ve; los movimientos
    // del propio mapa (carrusel, evento abierto) no lo cambian
    if (dynamic) {
      // (maplibre también manda originalEvent al redimensionar la ventana: eso no cuenta)
      const isUser = (ev: { originalEvent?: Event }) => !!ev.originalEvent && ev.originalEvent.type !== "resize";
      // alcance: lo que abarca el zoom (el encuadre inicial vale 30 min) o, si se desplazó lejos, lo que dista
      // el centro de la franja visible; el mismo zoom da siempre el mismo paso, al acercar o al alejar
      const scale = RADII[0] / halfWidthKm(map, lat);
      const fromCenter = () => {
        const b = visibleBand(map, [modeRef.current], listRef.current);
        const mid = map.unproject([b.width / 2, (b.top + b.bottom) / 2]);
        return distKm(lat, lng, mid.lat, mid.lng);
      };
      let byUser = false;
      map.on("movestart", (ev: { originalEvent?: Event }) => { if (isUser(ev)) byUser = true; });
      map.on("moveend", (ev: { originalEvent?: Event }) => {
        if (!byUser && !isUser(ev)) return;
        byUser = false;
        setReachKm(stepFor(Math.max(halfWidthKm(map, lat) * scale, fromCenter())));
      });
    }
    // relieve: modelo de elevación abierto (Terrarium de Mapzen/AWS, sin llave) para terreno 3D y sombreado
    map.once("load", () => {
      map.addSource("dem-shade", { type: "raster-dem", tiles: [DEM_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 14, attribution: "Elevación: Mapzen, AWS Terrain Tiles" });
      const firstLabel = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
      map.addLayer({ id: "hillshade", type: "hillshade", source: "dem-shade", paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#5b5b52", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#8a8a7a" } }, firstLabel);
      // terreno 3D solo en escritorio: en un teléfono de gama media es la mitad de las teselas de elevación
      // y una malla 3D que redibujar en cada cuadro; el sombreado ya da el relieve
      if (panel) {
        map.addSource("dem", { type: "raster-dem", tiles: [DEM_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 14 });
        map.setTerrain({ source: "dem", exaggeration: 1.4 });
      }
      // área cubierta por el radio elegido (el deslizador la redibuja al arrastrar)
      map.addSource("radius", { type: "geojson", data: dynamic ? circleGeo(lat, lng, RADII[0]) : explore || stateCve ? EMPTY_GEO : circleGeo(lat, lng, radiusKm) });
      map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#ff385c", "fill-opacity": 0.06 } }, firstLabel);
      map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#ff385c", "line-width": 2, "line-opacity": 0.55, "line-dasharray": [2, 1.5] } }, firstLabel);
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // el límite real de alejamiento es la caja (maxBounds), no minZoom; se iguala para que el control
    // "−" se deshabilite justo cuando ya no se puede alejar (y "+" en el zoom máximo)
    const syncMinZoom = () => {
      if (free || !limitRef.current) return;
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
  }, [limitKey, lat, lng, radiusKm, stateCve, explore, panel, free, dynamic]);

  // móvil: el círculo punteado marca el alcance vigente
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dynamic) return;
    const draw = () => (map.getSource("radius") as maplibregl.GeoJSONSource | undefined)?.setData(reachKm === EXPLORE ? EMPTY_GEO : circleGeo(lat, lng, reachKm));
    if (map.getSource("radius")) draw();
    else map.once("load", draw);
    return () => { map.off("load", draw); };
  }, [reachKm, dynamic, lat, lng, limitKey]);

  // tocar un paso del alcance: el mapa se acerca o aleja hasta encuadrarlo
  function goToReach(km: number) {
    const map = mapRef.current;
    if (!map) return;
    setReachKm(km);
    const b = visibleBand(map, tops(), listRef.current);
    map.fitBounds(circleBox(lat, lng, km === EXPLORE ? 150 : km), { padding: { top: b.top, bottom: b.height - b.bottom, left: 16, right: 16 }, duration: 600 });
  }

  // pines: se crean cuando cambia la lista (y se encuadran); el activo solo cambia de clase, sin mover el mapa
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = pins.map((e) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = showPlans ? "el-pin el-plan" : "el-pin";
      el.dataset.pin = e.id;
      if (showPlans) {
        el.innerHTML = USERS_ICON;
        el.append(e.label);
        el.setAttribute("aria-label", `Plan: ${e.label} ${e.label === "1" ? "persona va" : "personas van"}`);
      } else {
        el.textContent = e.label;
      }
      el.addEventListener("click", () => {
        setActiveId(e.id);
        openRef.current(e);
      });
      return new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([e.lng, e.lat]).addTo(map);
    });
    // móvil con radio: la cámara la mueve la persona (los pines aparecen o se van con el alcance)
    if (pins.length > 1 && !dynamic) {
      const b = new maplibregl.LngLatBounds();
      pins.forEach((e) => b.extend([e.lng, e.lat]));
      const band = visibleBand(map, tops(), listRef.current);
      map.fitBounds(b, { padding: panel ? 80 : { top: band.top + PIN_H, bottom: band.height - band.bottom, left: 40, right: 40 }, maxZoom: 13, duration: 0 });
    }
  }, [pins, panel, showPlans, dynamic]);

  // con un evento abierto se resalta su pin (o el de su plan); si no, el de la tarjeta activa del carrusel
  const current = pins.some((p) => p.id === activeId) ? activeId : pins[0]?.id ?? null;
  const shownActive = focus ? pins.find((p) => p.target === focus.id)?.id ?? focus.id : current;
  useEffect(() => { listRef.current?.scrollTo({ left: 0 }); }, [showPlans]);
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
      if (free) return;
      map.setMaxBounds(b);
      syncRef.current();
    };
    // móvil: cerrar el evento deja la cámara donde está
    if (!focus && !panel) return;
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
    const offset: [number, number] = panel ? [0, 0] : [0, -Math.round(map.getContainer().clientHeight * 0.19)];
    map.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 12.5), duration: 900, essential: true, offset });
    // con relieve 3D el punto sube al cargar la elevación y el pin se sale de cuadro: recentrar cuando termina
    let tries = 0;
    const settle = () => {
      const c = map.getContainer();
      const at = map.project([focus.lng, focus.lat]);
      const dx = at.x - c.clientWidth / 2 - offset[0];
      const dy = at.y - c.clientHeight / 2 - offset[1];
      if ((Math.abs(dx) > 4 || Math.abs(dy) > 4) && ++tries <= 3) map.panBy([dx, dy], { duration: 300 });
      else map.off("idle", settle);
    };
    map.on("idle", settle);
    return () => { map.off("idle", settle); };
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

  // móvil: la tarjeta que cruza el centro del carrusel pasa a ser la activa y el mapa se mueve a su evento
  useEffect(() => {
    const list = listRef.current;
    if (panel || !list) return;
    let frame = 0;
    let last: string | null = null;
    let token = 0;
    // centra el pin en la franja visible; si el límite del radio frena la cámara (pin cerca del borde)
    // y queda bajo el carrusel o los controles, acerca un nivel y reintenta
    const show = (e: (typeof pins)[number]) => {
      const map = mapRef.current;
      if (!map) return;
      const mine = ++token;
      let tries = 0;
      const go = (zoom: number) => {
        const b = visibleBand(map, [topRef.current, modeRef.current, chipRef.current], list);
        const y = Math.round((b.top + PIN_H + b.bottom) / 2 - b.height / 2);
        map.easeTo({ center: [e.lng, e.lat], zoom, offset: [0, y], duration: 450, essential: true });
        map.once("moveend", check);
      };
      const check = () => {
        if (mine !== token) return;
        if (map.isMoving()) { map.once("moveend", check); return; }
        const b = visibleBand(map, [topRef.current, modeRef.current, chipRef.current], list);
        const p = map.project([e.lng, e.lat]);
        const fits = p.y - PIN_H >= b.top && p.y <= b.bottom && p.x >= 32 && p.x <= b.width - 32;
        if (!fits && ++tries <= 3) go(Math.min(map.getZoom() + 1, map.getMaxZoom()));
      };
      go(map.getZoom());
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mid = list.scrollLeft + list.clientWidth / 2;
        let id: string | undefined;
        let best = Infinity;
        for (const el of Array.from(list.children) as HTMLElement[]) {
          const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
          if (d < best) { best = d; id = el.dataset.id; }
        }
        const e = pins.find((p) => p.id === id);
        if (!e || e.id === last) return;
        last = e.id;
        setActiveId(e.id);
        show(e);
      });
    };
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => { token++; cancelAnimationFrame(frame); list.removeEventListener("scroll", onScroll); };
  }, [panel, pins]);

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
      {/* isolate: el z-index del pin activo no debe ganarle al carrusel ni a los controles */}
      <div ref={ref} className="isolate h-full w-full" />
      <style>{`
        .el-pin{background:#fff;color:#222;border:1px solid #ddd;border-radius:9999px;padding:6px 12px;font:600 13px var(--font-inter),system-ui;box-shadow:0 2px 8px rgba(0,0,0,.15);cursor:pointer;transform:translateY(-4px)}
        .el-me{width:18px;height:18px;border-radius:9999px;background:#1a73e8;border:3px solid #fff;box-shadow:0 0 0 6px rgba(26,115,232,.2),0 1px 4px rgba(0,0,0,.3)}
        .maplibregl-ctrl-group button:disabled{cursor:not-allowed;background:#fafafa}
        .maplibregl-ctrl-group button:disabled .maplibregl-ctrl-icon{opacity:.25}
        .el-plan{display:flex;align-items:center;gap:5px;padding:6px 11px 6px 9px;background:#ff385c;color:#fff;border-color:#ff385c}
        .el-pin.is-active{background:#222;color:#fff;border-color:#222;z-index:2}
        .maplibregl-ctrl-top-right{top:${panel || searchBar ? 64 : 168}px;right:${panel ? 12 : 8}px}
      `}</style>
      {searchBar && !panel ? (
        <div className="absolute left-1/2 top-3 z-20 flex h-10 w-[256px] max-w-[calc(100%-40px)] -translate-x-1/2 items-center rounded-full bg-white shadow-float">
          {searchBar}
          <span aria-hidden className="h-5 w-px shrink-0 bg-line" />
          <button type="button" onClick={locate} aria-label="Mi ubicación" className="grid h-10 w-11 shrink-0 place-items-center rounded-r-full pr-0.5">
            {pending ? <Loader2 size={17} className="animate-spin" /> : <LocateFixed size={17} />}
          </button>
        </div>
      ) : (
        <button type="button" onClick={locate} aria-label="Mi ubicación" className={clsx("absolute grid h-10 w-10 place-items-center rounded-full bg-white shadow-float", panel ? "right-4 top-4" : "right-5 top-[116px]")}>
          {pending ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
        </button>
      )}
      {!panel && plans && (
        <div ref={modeRef} role="group" aria-label="Qué ver en el mapa" className="absolute left-1/2 top-[64px] z-10 flex h-10 w-[256px] max-w-[calc(100%-40px)] -translate-x-1/2 items-center gap-0.5 rounded-full bg-white p-1 text-[13px] font-semibold shadow-float">
          <button type="button" aria-pressed={!showPlans} onClick={() => setShowPlans(false)}
            className={clsx("h-full flex-1 rounded-full px-3.5 transition-colors", showPlans ? "text-ink-2" : "bg-ink text-white")}>
            Eventos
          </button>
          <button type="button" aria-pressed={showPlans} onClick={() => setShowPlans(true)}
            className={clsx("flex h-full flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full pl-3 pr-3.5 transition-colors", showPlans ? "bg-ink text-white" : "text-ink-2")}>
            <Users size={14} /> Comunidades
            {planList.length > 0 && (
              <span className={clsx("grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold", showPlans ? "bg-white text-ink" : "bg-[#ff385c] text-white")}>{planList.length}</span>
            )}
          </button>
        </div>
      )}
      {dynamic && (
        <div ref={chipRef} className="absolute left-1/2 top-[116px] z-20 -translate-x-1/2">
          <ReachChip
            km={reachKm}
            steps={STEPS}
            place={loc.gps || loc.label === "Tu ubicación" ? "tu ubicación" : loc.label}
            count={showPlans ? planList.length : eventList.length}
            noun={showPlans ? ["plan", "planes"] : ["evento", "eventos"]}
            onPick={goToReach}
          />
        </div>
      )}
      {!stateCve && panel && (
        <div ref={topRef} className={clsx("absolute left-1/2 z-10 w-max -translate-x-1/2", panel ? "top-4" : "top-[84px]")}>
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
      {showPlans && pins.length === 0 && (
        <div role="status" className="absolute inset-x-5 bottom-[calc(86px+env(safe-area-inset-bottom))] z-10 rounded-card bg-white p-4 shadow-float">
          {nextOut != null ? (
            <>
              <p className="flex items-center gap-2 text-[15px] font-semibold"><Users size={16} className="shrink-0" /> Ningún plan a {radiusLabel(reachKm)}</p>
              <p className="mt-1 text-[13px] text-ink-2">{nextOut === EXPLORE ? "Hay planes más lejos, en la región." : `El más cercano está a ${radiusLabel(nextOut)}.`} Aleja el mapa para verlos.</p>
              <button type="button" onClick={() => goToReach(nextOut)} className="mt-3 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white">
                {nextOut === EXPLORE ? "Ver toda la región" : `Ver a ${radiusLabel(nextOut)}`}
              </button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-[15px] font-semibold"><Users size={16} className="shrink-0" /> Aún no hay planes abiertos por aquí</p>
              <p className="mt-1 text-[13px] text-ink-2">Los arma la gente desde cualquier evento o experiencia con “Ve con alguien”. Sé quien abra el primero.</p>
              <button type="button" onClick={() => setShowPlans(false)} className="mt-3 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white">Ver eventos</button>
            </>
          )}
        </div>
      )}
      {dynamic && !showPlans && pins.length === 0 && (
        <div role="status" className="absolute left-1/2 z-10 flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-full bg-white py-1.5 pl-3 pr-1.5 text-[13px] shadow-float bottom-[calc(86px+env(safe-area-inset-bottom))]">
          <Info size={15} className="shrink-0 text-ink-2" />
          <span className="truncate text-ink-2">
            {nextOut == null ? "Sin eventos por ahora" : `Nada a ${radiusLabel(reachKm)} · lo más cercano está a ${nextOut === EXPLORE ? "más de 3 h" : radiusLabel(nextOut)}`}
          </span>
          {nextOut != null && (
            <button type="button" onClick={() => goToReach(nextOut)} className="shrink-0 rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-white">Alejar</button>
          )}
        </div>
      )}
      {!dynamic && !showPlans && pins.length === 0 && (
        <div role="status" className={clsx("absolute left-1/2 z-10 flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-full bg-white py-1.5 pl-3 pr-1.5 text-[13px] shadow-float", panel ? "top-[68px]" : "bottom-[calc(86px+env(safe-area-inset-bottom))]")}>
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
      <div ref={listRef} className={clsx(panel && "hidden", "no-scrollbar absolute inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[max(20px,calc(50%-150px))] pb-1")}>
        {showPlans
          ? planList.map((p, i) => (
              <div key={p.id} data-id={p.id} className={clsx("shrink-0 snap-center snap-always transition-transform duration-200", p.id !== shownActive && "scale-[0.95]")}>
                <PlanMapCard p={p} active={p.id === shownActive} href={p.target.kind === "event" ? detailHref(p.target.slug) : undefined} eager={i === 0} />
              </div>
            ))
          : eventList.map((e, i) => (
              <div key={e.event_id} data-id={e.event_id} className={clsx("shrink-0 snap-center snap-always transition-transform duration-200", e.event_id !== shownActive && "scale-[0.95]")}>
                <CompactCard e={e} active={e.event_id === shownActive} href={detailHref(e.slug)} eager={!panel && i === 0} />
              </div>
            ))}
      </div>
    </div>
  );
}
