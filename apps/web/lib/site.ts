import type { Metadata } from "next";

/**
 * Identidad del sitio para SEO, Open Graph y datos estructurados. La URL sale de NEXT_PUBLIC_SITE_URL; en Vercel,
 * si falta, se usa el dominio de producción del proyecto. Todo lo que se comparte (og:url, canonical, sitemap) es absoluto.
 */
export const SITE_NAME = "Entre Lugares";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
export const SITE_HOST = new URL(SITE_URL).host;
export const SITE_TAGLINE = "Qué hacer cerca este fin de semana";
export const SITE_DESCRIPTION =
  "Agenda de eventos en pueblos cerca de la Ciudad de México: ferias, fiestas patronales, conciertos, mercados y talleres en Morelos, Estado de México, Puebla y CDMX. Fechas, lugar, precio y cómo llegar.";
export const SITE_REGIONS = ["Morelos", "Estado de México", "Puebla", "Ciudad de México"];
export const SITE_KEYWORDS = [
  "qué hacer este fin de semana", "eventos cerca de mí", "eventos en pueblos", "ferias", "fiestas patronales",
  "Pueblos Mágicos", "conciertos", "mercados", "Tepoztlán", "Morelos", "Estado de México", "Puebla", "CDMX",
];
export const LOCALE = "es_MX";

/** Colores de marca (globals.css) para íconos e imágenes generadas, donde no hay CSS. */
export const BRAND = { accent: "#ff385c", ink: "#222222", ink2: "#6a6a6a", ink3: "#9a9a9a", bg2: "#f7f7f7", free: "#008a05" };

export const absUrl = (path = "/") => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

/**
 * Metadata de una página pública: título, descripción, canonical, Open Graph y tarjeta de X completos.
 * Un `openGraph` por página reemplaza al del layout, por eso aquí se repiten siteName y locale.
 * Las imágenes no se ponen: las da el `opengraph-image` de cada ruta (o el de la raíz).
 */
export function pageMetadata({ title, description, path, ogTitle, type = "website", absolute = false, images }: {
  title: string;
  description: string;
  path: string;
  /** título para compartir (sin el sufijo " · Entre Lugares" del <title>) */
  ogTitle?: string;
  type?: "website" | "article";
  /** el <title> va tal cual, sin la plantilla del layout (portada) */
  absolute?: boolean;
  /** solo si la imagen necesita alt descriptivo; si no, la pone el opengraph-image de la ruta */
  images?: { url: string; alt: string; type?: string }[];
}): Metadata {
  const shareTitle = ogTitle ?? title;
  const sized = images?.map((i) => ({ width: 1200, height: 630, type: "image/png", ...i }));
  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type, siteName: SITE_NAME, locale: LOCALE, url: path, title: shareTitle, description, ...(sized && { images: sized }) },
    twitter: { card: "summary_large_image", title: shareTitle, description, ...(sized && { images: sized }) },
  };
}

/** Páginas personales o de servicio: no se indexan, pero sí se pueden seguir sus enlaces. */
export const NO_INDEX: Metadata["robots"] = { index: false, follow: true, googleBot: { index: false, follow: true } };

/** Recorta en el último espacio antes de `max` para descripciones de 150–160 caracteres. */
export function clip(text: string, max = 158) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
}
