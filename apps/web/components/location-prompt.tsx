"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LocateFixed } from "lucide-react";
import { setLocation } from "@/app/actions";
import { DEFAULT_RADIUS } from "@/lib/location";
import { track } from "@/lib/track";

type State = "locating" | "idle" | "denied";

/** Primera visita: pide la ubicación en cuanto carga. Discreto: una línea bajo el buscador, que es la vía principal. */
export function LocationPrompt() {
  const [state, setState] = useState<State>("idle");
  const [pending, start] = useTransition();
  const asked = useRef(false);
  const router = useRouter();

  function locate() {
    if (!navigator.geolocation) return setState("denied");
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => start(async () => {
        await setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, radiusKm: DEFAULT_RADIUS, label: "Tu ubicación", gps: true });
        track("search", { props: { mode: "gps" } });
        router.refresh();
      }),
      () => setState("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  }

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    // si ya la negó antes no insistimos: el navegador ni siquiera volvería a preguntar
    // (Safari viejo no tiene Permissions API: se pregunta directo)
    const perms = navigator.permissions?.query({ name: "geolocation" as PermissionName }) ?? Promise.reject();
    perms.then((p) => (p.state === "denied" ? setState("denied") : locate())).catch(locate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = state === "locating" || pending;
  return (
    <p className="flex items-center gap-1.5 px-6 pt-2 text-[13px] text-ink-2">
      {busy ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
      {busy ? (
        "Buscando lo que hay cerca de ti…"
      ) : (
        <>
          Viendo toda la región ·
          {state === "denied" ? " busca tu pueblo arriba" : <button type="button" onClick={locate} className="font-semibold text-ink underline">usar mi ubicación</button>}
        </>
      )}
    </p>
  );
}
