"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La página real en un iframe al ancho del dispositivo y, encima, los clics pintados en un canvas.
 * Cada punto es una mancha con alfa; el canvas se colorea por intensidad (azul → amarillo → rojo).
 * El iframe lleva la cookie del equipo: sus vistas no cuentan en la analítica.
 */
export function HeatOverlay({ path, width, points }: { path: string; width: number; points: [number, number, number][] }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(900);
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(0.75);

  // el ancho del panel manda la escala; el iframe siempre se pinta al ancho real del dispositivo
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  // alto del documento: lo que diga la página o, como mínimo, hasta el clic más bajo
  const maxY = points.reduce((m, p) => Math.max(m, p[1]), 0) + 200;
  const onLoad = () => {
    const measure = () => {
      try {
        const doc = frame.current?.contentDocument?.documentElement;
        if (doc) setHeight(Math.min(12000, Math.max(doc.scrollHeight, maxY, 600)));
      } catch {
        setHeight(Math.min(12000, Math.max(maxY, 900)));
      }
    };
    measure();
    setTimeout(measure, 1500); // imágenes y contenido diferido
  };

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx || !points.length) return;
    const r = width < 600 ? 22 : 30;
    const peak = Math.max(...points.map((p) => p[2]));
    for (const [px, py, n] of points) {
      const x = (px / 100) * width;
      const y = py + 4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${Math.min(1, 0.15 + (n / peak) * 0.85)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // alfa → color
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i];
      if (!a) continue;
      const t = a / 255;
      const [rr, gg, bb] = t < 0.33 ? [42, 120 + t * 300, 214] : t < 0.66 ? [255, 210, 60] : [235, 60 + (1 - t) * 120, 40];
      d[i - 3] = rr; d[i - 2] = gg; d[i - 1] = bb; d[i] = Math.min(230, 60 + a);
    }
    ctx.putImageData(img, 0, 0);
  }, [points, width, height]);

  return (
    <div>
      <label className="mb-3 flex items-center gap-2 text-[12px] text-ink-2">
        Intensidad de la capa
        <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-32" />
      </label>
      <div ref={box} className="overflow-hidden rounded-card border border-line bg-bg">
        <div style={{ width: width * scale, height: height * scale }} className="mx-auto">
          <div className="relative origin-top-left" style={{ width, height, transform: `scale(${scale})` }}>
            <iframe ref={frame} src={path} onLoad={onLoad} title="Página" className="pointer-events-none absolute inset-0 border-0" style={{ width, height }} />
            <canvas ref={canvas} className="pointer-events-none absolute inset-0" style={{ width, height, opacity }} />
          </div>
        </div>
      </div>
    </div>
  );
}
