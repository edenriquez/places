"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
import clsx from "clsx";
import { DEFAULT_RADIUS, EXPLORE, radiusLabel, type Loc } from "@/lib/location";
import type { Municipality } from "@/lib/types";
import { setLocation } from "@/app/actions";
import { track } from "@/lib/track";

type State = { cve: string; name: string; lat: number; lng: number; munis: Municipality[] };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Estados a partir de los municipios (la clave del estado son los 2 primeros dígitos del cvegeo). */
function groupStates(municipalities: Municipality[]): State[] {
  const by = new Map<string, State>();
  for (const m of municipalities) {
    const cve = m.cvegeo.slice(0, 2);
    const s = by.get(cve) ?? { cve, name: m.state, lat: 0, lng: 0, munis: [] };
    s.munis.push(m);
    by.set(cve, s);
  }
  return [...by.values()]
    .map((s) => ({ ...s, lat: s.munis.reduce((a, m) => a + m.lat, 0) / s.munis.length, lng: s.munis.reduce((a, m) => a + m.lng, 0) / s.munis.length }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function SearchBar({ loc, municipalities, compact, isSet = true, header }: { loc: Loc; municipalities: Municipality[]; compact?: boolean; isSet?: boolean; header?: boolean }) {
  const [open, setOpen] = useState(false);
  const where = loc.stateCve ? `Todo ${loc.label}` : loc.radiusKm === 0 ? "Explorando toda la región" : loc.label === "Tu ubicación" ? "Cerca de ti" : `Cerca de ${loc.label}`;
  return (
    <>
      <div className={clsx(!header && "px-5", !header && (compact ? "pt-3" : "pt-4"))}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={clsx("flex w-full items-center gap-3 rounded-full border border-line bg-white px-4 text-left shadow-float", header ? "py-2" : "py-3")}
        >
          <Search size={20} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{!isSet ? "¿A dónde vas este finde?" : compact ? loc.label : "¿A dónde vas este finde?"}</span>
            <span className="block truncate text-[12px] text-ink-2">{!isSet ? "Busca un estado o municipio" : where}</span>
          </span>
        </button>
      </div>
      {/* portal: el encabezado de escritorio usa backdrop-blur, que vuelve "fixed" relativo a él y recortaba la hoja */}
      {open && createPortal(<LocationSheet loc={isSet ? loc : null} municipalities={municipalities} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

/** Buscador: escribe y sugiere estados y municipios (sin servicios externos). Un estado se puede elegir completo o abrir para ver sus municipios. */
export function LocationSheet({ loc, municipalities, onClose }: { loc: Loc | null; municipalities: Municipality[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<State | null>(null);
  const [pending, start] = useTransition();
  const [geo, setGeo] = useState<"idle" | "locating" | "error">("idle");
  const router = useRouter();
  const states = useMemo(() => groupStates(municipalities), [municipalities]);
  const radiusKm = loc?.radiusKm ?? DEFAULT_RADIUS;

  const results = useMemo(() => {
    const n = norm(q);
    if (!n) return null;
    const st = states.filter((s) => norm(s.name).includes(n));
    const mu = municipalities
      .filter((m) => norm(m.name).includes(n))
      .sort((a, b) => Number(!norm(a.name).startsWith(n)) - Number(!norm(b.name).startsWith(n)) || a.name.localeCompare(b.name))
      .slice(0, 8);
    return { st, mu };
  }, [q, states, municipalities]);

  function apply(next: Loc) {
    start(async () => {
      await setLocation(next);
      track("search", { props: { label: next.label, mode: next.stateCve ? "estado" : next.radiusKm === EXPLORE ? "explorar" : radiusLabel(next.radiusKm) } });
      router.refresh();
      onClose();
    });
  }
  const pickState = (s: State) => apply({ lat: s.lat, lng: s.lng, radiusKm, label: s.name, stateCve: s.cve });
  const pickMuni = (m: Municipality) => apply({ lat: m.lat, lng: m.lng, radiusKm, label: m.name, cvegeo: m.cvegeo });

  function useMyLocation() {
    if (!navigator.geolocation) return setGeo("error");
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => apply({ lat: pos.coords.latitude, lng: pos.coords.longitude, radiusKm, label: "Tu ubicación", gps: true }),
      () => setGeo("error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  }

  const stateRow = (s: State) => (
    <li key={s.cve} className="flex items-center">
      <button type="button" disabled={pending} onClick={() => pickState(s)} className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg-2 text-[11px] font-bold text-ink-2">{s.name.slice(0, 2).toUpperCase()}</span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium">{s.name}</span>
          <span className="block text-[12px] text-ink-2">Estado · {s.munis.length} municipios</span>
        </span>
        {loc?.stateCve === s.cve && <span className="ml-auto text-[12px] font-semibold text-accent">Actual</span>}
      </button>
      <button type="button" onClick={() => { setDrill(s); setQ(""); }} aria-label={`Ver municipios de ${s.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-bg-2">
        <ChevronRight size={18} />
      </button>
    </li>
  );
  const muniRow = (m: Municipality) => (
    <li key={m.cvegeo}>
      <button type="button" disabled={pending} onClick={() => pickMuni(m)} className="flex w-full items-center gap-3 py-3 text-left">
        <MapPin size={18} className="shrink-0 text-ink-2" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{m.name}</span>
          <span className="block truncate text-[12px] text-ink-2">{m.state}{m.is_pueblo_magico ? " · Pueblo Mágico" : ""}</span>
        </span>
        {loc?.cvegeo === m.cvegeo && !loc.stateCve && <span className="text-[12px] font-semibold text-accent">Actual</span>}
      </button>
    </li>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="flex h-[88dvh] w-full max-w-screen-sm flex-col rounded-t-[20px] bg-white sm:h-auto sm:max-h-[80dvh] sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line p-4">
          {drill ? (
            <button type="button" onClick={() => setDrill(null)} aria-label="Volver" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line"><ChevronLeft size={18} /></button>
          ) : null}
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-ink px-4 py-2.5">
            <Search size={18} className="shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => { setQ(e.target.value); setDrill(null); }}
              placeholder={drill ? `Buscar en ${drill.name}` : "Estado o municipio"}
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            />
            {pending && <Loader2 size={16} className="shrink-0 animate-spin text-ink-2" />}
          </label>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {results ? (
            results.st.length + results.mu.length ? (
              <ul className="divide-y divide-line">
                {results.st.map(stateRow)}
                {results.mu.map(muniRow)}
              </ul>
            ) : (
              <p className="py-6 text-center text-[14px] text-ink-2">Aún no cubrimos “{q}”. Prueba con otro municipio o un estado.</p>
            )
          ) : drill ? (
            <ul className="divide-y divide-line">
              <li>
                <button type="button" disabled={pending} onClick={() => pickState(drill)} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{drill.name.slice(0, 2).toUpperCase()}</span>
                  <span className="text-[15px] font-semibold">Todo {drill.name}</span>
                </button>
              </li>
              {drill.munis.map(muniRow)}
            </ul>
          ) : (
            <>
              <p className="pt-4 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-2">Estados</p>
              <ul className="divide-y divide-line">{states.map(stateRow)}</ul>
            </>
          )}
        </div>

        <div className="border-t border-line px-5 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          <button type="button" onClick={useMyLocation} disabled={pending || geo === "locating"} className="flex items-center gap-2 text-[13px] font-medium text-ink-2 hover:text-ink">
            {geo === "locating" ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
            {geo === "error" ? "No pudimos leer tu ubicación; elige un lugar arriba" : "Usar mi ubicación actual"}
          </button>
        </div>
      </div>
    </div>
  );
}
