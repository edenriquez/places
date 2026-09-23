"use client";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Turbopack no empaqueta bien el worker inline de MapLibre; se sirve el build del worker desde /public.
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
export { maplibregl };
