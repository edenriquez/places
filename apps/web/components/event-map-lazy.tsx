"use client";

import dynamic from "next/dynamic";

/** EventMap sin SSR y en su propio chunk: maplibre (~290 KB) solo se baja cuando el mapa se pinta. */
export const EventMap = dynamic(() => import("./event-map").then((m) => m.EventMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-bg-2" />,
});
