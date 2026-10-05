/** Corre `cb` cuando el navegador queda libre (a más tardar en `timeout` ms). Devuelve la cancelación. */
export function whenIdle(cb: () => void, timeout = 2000): () => void {
  // Safari no tiene requestIdleCallback
  if (!("requestIdleCallback" in window)) {
    const t = setTimeout(cb, 1);
    return () => clearTimeout(t);
  }
  const id = requestIdleCallback(cb, { timeout });
  return () => cancelIdleCallback(id);
}
