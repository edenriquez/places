"use client";

import { useEffect } from "react";

/** Registra public/sw.js (instalable y con página sin conexión). En desarrollo no, para no servir archivos viejos. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
