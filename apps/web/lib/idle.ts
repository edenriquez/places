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

/** Como whenIdle, pero no antes del evento load: lo diferido no le quita ancho de banda al flyer principal. */
export function afterLoad(cb: () => void): () => void {
  let cancel = () => {};
  const start = () => { cancel = whenIdle(cb); };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
  return () => {
    window.removeEventListener("load", start);
    cancel();
  };
}
