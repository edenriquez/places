"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const heroDone = () => {
  const hero = document.querySelector<HTMLImageElement>("img[data-hero]");
  return !hero || hero.complete || document.readyState === "complete";
};

/**
 * Flyer de las tarjetas que no son la principal. Vercel sirve todo por una sola conexión HTTP/2 sin respetar
 * prioridades: si estas imágenes arrancan junto con el flyer principal se reparten el ancho de banda y en
 * 4G lento el LCP se va a ~7 s. Se piden cuando el principal (`img[data-hero]`) ya cargó, o al load si
 * desapareció antes (cambio de pestaña).
 */
export function AfterHeroImage({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const done = () => setShow(true);
    if (heroDone()) return queueMicrotask(done);
    const hero = document.querySelector<HTMLImageElement>("img[data-hero]")!;
    hero.addEventListener("load", done, { once: true });
    hero.addEventListener("error", done, { once: true });
    window.addEventListener("load", done, { once: true });
    return () => {
      hero.removeEventListener("load", done);
      hero.removeEventListener("error", done);
      window.removeEventListener("load", done);
    };
  }, []);
  return show ? <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" /> : null;
}
