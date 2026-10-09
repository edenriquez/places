"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { ZoomableImage } from "./image-viewer";

export type Slide = { src: string; style?: React.CSSProperties };

/**
 * Fotos del evento en carrusel tipo Facebook: cada foto ocupa ~86 % del ancho y asoma la siguiente.
 * Se desliza con el dedo; con mouse hay flechas. Tocar una foto la abre a tamaño completo.
 * `slideClassName` lleva la proporción (y esquinas) de cada foto.
 */
export function FlyerCarousel({ slides, alt, sizes, contain, eventId, slideClassName }: {
  slides: Slide[]; alt: string; sizes: string; contain?: boolean; eventId?: string; slideClassName: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const n = slides.length;

  function onScroll() {
    const t = track.current;
    const first = t?.firstElementChild as HTMLElement | null;
    if (!t || !first) return;
    const atEnd = t.scrollLeft >= t.scrollWidth - t.clientWidth - 2;
    setIndex(atEnd ? n - 1 : Math.round(t.scrollLeft / (first.offsetWidth + GAP)));
  }
  function go(to: number) {
    const slide = track.current?.children[Math.max(0, Math.min(n - 1, to))] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: to >= n - 1 ? "end" : "start" });
  }

  return (
    <div aria-roledescription="carrusel" aria-label={alt}>
      <div className="relative">
        <div
          ref={track}
          onScroll={onScroll}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          style={{ gap: GAP }}
        >
          {slides.map((s, i) => (
            <div
              key={s.src}
              aria-roledescription="foto"
              aria-label={`${i + 1} de ${n}`}
              className={clsx("relative w-[86%] shrink-0 overflow-hidden bg-bg-2", i === n - 1 ? "snap-end" : "snap-start", slideClassName)}
            >
              <ZoomableImage src={s.src} alt={`${alt} · foto ${i + 1}`} eventId={eventId} className="relative block h-full w-full cursor-zoom-in">
                <Image
                  src={s.src}
                  alt={i === 0 ? alt : `${alt} · foto ${i + 1}`}
                  fill
                  sizes={sizes}
                  fetchPriority={i === 0 ? "high" : undefined}
                  className={contain ? "object-contain" : "object-cover"}
                  style={contain ? undefined : s.style}
                />
              </ZoomableImage>
            </div>
          ))}
        </div>
        {index > 0 && (
          <button type="button" onClick={() => go(index - 1)} aria-label="Foto anterior" className={ARROW + " left-3"}>
            <ChevronLeft size={18} />
          </button>
        )}
        {index < n - 1 && (
          <button type="button" onClick={() => go(index + 1)} aria-label="Foto siguiente" className={ARROW + " right-3"}>
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      <div className="flex justify-center gap-1.5 pt-2.5" aria-hidden>
        {slides.map((s, i) => (
          <span key={s.src} className={clsx("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-ink" : "w-1.5 bg-line-2")} />
        ))}
      </div>
    </div>
  );
}

const GAP = 6;
// solo con mouse: en touch se desliza
const ARROW = "absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-ink shadow-soft [@media(hover:hover)]:grid";
