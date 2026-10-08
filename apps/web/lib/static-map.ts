/** Imagen del mini mapa (ver app/evento/[slug]/mapa/route.ts): 1 px de imagen = 1 px CSS, sin escalar. */
export const STATIC_MAP = { w: 640, h: 320, zoom: 15 };

/** `ll` va en la URL: si cambian las coordenadas del evento cambia la URL y el CDN no sirve la imagen vieja. */
export const mapKey = (c: { lat: number; lng: number }) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;

export const staticMapSrc = (slug: string, c: { lat: number; lng: number }) =>
  `/evento/${encodeURIComponent(slug)}/mapa?ll=${mapKey(c)}`;
