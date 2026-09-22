"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import clsx from "clsx";
import type { Loc } from "@/lib/location";
import { RADII } from "@/lib/location";
import type { Municipality } from "@/lib/types";
import { setLocation } from "@/app/actions";

export function SearchBar({ loc, municipalities, compact }: { loc: Loc; municipalities: Municipality[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={clsx("px-5", compact ? "pt-3" : "pt-4")}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-full border border-line bg-white px-4 py-3 text-left shadow-float"
        >
          <Search size={20} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{compact ? `${loc.label} · Este finde` : "¿A dónde vas este finde?"}</span>
            <span className="block truncate text-[12px] text-ink-2">
              {compact ? `Todos los eventos · ${loc.radiusKm} km` : `Cerca de ${loc.label} · ${loc.radiusKm} km`}
            </span>
          </span>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-2">
            <SlidersHorizontal size={16} />
          </span>
        </button>
      </div>
      {open && <LocationSheet loc={loc} municipalities={municipalities} onClose={() => setOpen(false)} />}
    </>
  );
}

function LocationSheet({ loc, municipalities, onClose }: { loc: Loc; municipalities: Municipality[]; onClose: () => void }) {
  const [radius, setRadius] = useState<number>(loc.radiusKm);
  const [pending, start] = useTransition();
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const router = useRouter();

  function apply(next: Loc) {
    start(async () => {
      await setLocation(next);
      router.refresh();
      onClose();
    });
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setGeoErr("Tu navegador no permite ubicación.");
    navigator.geolocation.getCurrentPosition(
      (pos) => apply({ lat: pos.coords.latitude, lng: pos.coords.longitude, radiusKm: radius, label: "Tu ubicación" }),
      () => setGeoErr("No pudimos leer tu ubicación. Elige un pueblo."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-screen-sm overflow-y-auto rounded-t-[20px] bg-white p-5 sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold">¿Dónde buscas?</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-line"><X size={18} /></button>
        </div>

        <button
          type="button"
          onClick={useMyLocation}
          disabled={pending}
          className="mt-4 flex w-full items-center gap-3 rounded-control border border-line px-4 py-3 text-left hover:border-ink"
        >
          <LocateFixed size={20} className="text-accent" />
          <span className="text-[15px] font-semibold">Usar mi ubicación</span>
        </button>
        {geoErr && <p className="mt-2 text-[13px] text-error">{geoErr}</p>}

        <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2">Radio</p>
        <div className="mt-2 flex gap-2">
          {RADII.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRadius(r)}
              className={clsx("h-9 rounded-full border px-4 text-[14px] font-medium", radius === r ? "border-ink bg-ink text-white" : "border-line-2")}
            >
              {r} km
            </button>
          ))}
        </div>

        <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2">Pueblos</p>
        <ul className="mt-2 divide-y divide-line">
          {municipalities.map((m) => (
            <li key={m.cvegeo}>
              <button
                type="button"
                disabled={pending}
                onClick={() => apply({ lat: m.lat, lng: m.lng, radiusKm: radius, label: m.name, cvegeo: m.cvegeo })}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <MapPin size={18} className="text-ink-2" />
                <span className="flex-1">
                  <span className="block text-[15px] font-medium">{m.name}</span>
                  <span className="block text-[12px] text-ink-2">{m.state}{m.is_pueblo_magico ? " · Pueblo Mágico" : ""}{m.drive_from_cdmx ? ` · ${m.drive_from_cdmx} desde CDMX` : ""}</span>
                </span>
                {loc.cvegeo === m.cvegeo && <span className="text-[12px] font-semibold text-accent">Actual</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
