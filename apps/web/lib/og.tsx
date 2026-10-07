import { ImageResponse } from "next/og";
import { BRAND, SITE_HOST, SITE_NAME } from "./site";

/**
 * Imágenes para compartir (Open Graph / X / WhatsApp): 1200×630, texto grande que se lea en miniatura,
 * marca arriba y dominio abajo. Cada página pasa el ícono de lo que hace (mapa, pueblo, publicar…).
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

type IconName = "brand" | "map" | "landmark" | "megaphone" | "shield" | "calendar";

// Trazos de lucide (24×24, línea 2) para que el ícono de la vista previa sea el mismo de la app. Solo `d` de <path>:
// ImageResponse convierte el <svg> a texto y no acepta fragmentos de React dentro.
const STROKES: Record<Exclude<IconName, "brand">, string[]> = {
  map: [
    "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",
    "M15 5.764v15",
    "M9 3.236v15",
  ],
  landmark: [
    "M10 18v-7",
    "M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z",
    "M14 18v-7",
    "M18 18v-7",
    "M3 22h18",
    "M6 18v-7",
  ],
  megaphone: [
    "M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
    "M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14",
    "M8 6v8",
  ],
  shield: [
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
    "m9 12 2 2 4-4",
  ],
  calendar: [
    "M8 2v4",
    "M16 2v4",
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    "M3 10h18",
    "M8 14h.01", "M12 14h.01", "M16 14h.01", "M8 18h.01", "M12 18h.01",
  ],
};

/** El ícono de la app (pin con calendario), en vector para que se vea nítido a cualquier tamaño. */
export function BrandMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="15" fill={BRAND.accent} />
      <path d="M32 55.5c-1.1 0-2.1-.5-2.8-1.4C24.3 47.6 15 37.6 15 28.4a17 17 0 0 1 34 0c0 9.2-9.3 19.2-14.2 25.7-.7.9-1.7 1.4-2.8 1.4z" fill="#fff" />
      <rect x="22.5" y="19.5" width="19" height="17" rx="3.5" fill={BRAND.accent} />
      <rect x="25" y="25.5" width="14" height="8.5" rx="1.5" fill="#fff" />
      <rect x="26.6" y="16.6" width="3" height="5.6" rx="1.5" fill={BRAND.accent} />
      <rect x="34.4" y="16.6" width="3" height="5.6" rx="1.5" fill={BRAND.accent} />
      <circle cx="34.8" cy="29.75" r="2.1" fill={BRAND.accent} />
    </svg>
  );
}

function PageIcon({ name, size }: { name: IconName; size: number }) {
  if (name === "brand") return <BrandMark size={size} />;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size / 4, background: "#fff1f3" }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke={BRAND.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {STROKES[name].map((d) => <path key={d} d={d} />)}
      </svg>
    </div>
  );
}

/**
 * Plus Jakarta Sans (la tipografía de títulos de la app) recortada a los caracteres del texto. Si Google Fonts
 * no responde, ImageResponse usa su fuente por defecto: la imagen sale igual, solo con otra letra.
 */
async function loadFonts(text: string) {
  const weights = [700, 800] as const;
  try {
    const fonts = await Promise.all(weights.map(async (weight) => {
      const css = await (await fetch(
        `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@${weight}&text=${encodeURIComponent(text)}`,
        { signal: AbortSignal.timeout(2500) },
      )).text();
      const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
      if (!src) throw new Error("sin fuente");
      const data = await (await fetch(src, { signal: AbortSignal.timeout(2500) })).arrayBuffer();
      return { name: "Jakarta", data, weight, style: "normal" as const };
    }));
    return fonts;
  } catch {
    return undefined;
  }
}

/**
 * Baja una foto para la tarjeta como data URL. ImageResponse solo decodifica PNG/JPEG/GIF y truena si la URL falla,
 * así que un flyer en WebP o un bucket caído regresan null y la tarjeta sale con el ícono.
 */
export async function ogPhoto(url: string | null | undefined) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !/^image\/(png|jpe?g|gif)$/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export type OgCard = {
  icon: IconName;
  /** línea corta arriba del título: "Mapa de eventos", "Pueblo Mágico · Morelos" */
  eyebrow?: string;
  title: string;
  /** una línea o varias (cuándo / dónde) */
  subtitle?: string | (string | null | undefined)[];
  /** chips abajo: "12 próximos", "Gratis" */
  chips?: string[];
  /** foto (data URL de `ogPhoto`): portada del municipio o flyer del evento; si falta, se dibuja el ícono */
  photo?: string | null;
  /** flyer: a la izquierda y más angosto (suelen ser verticales); portada: a la derecha */
  photoSide?: "left" | "right";
  /** chip resaltado en verde (precio "Gratis") */
  freeChip?: string;
};

/**
 * Con `jpeg` (rutas con foto) el PNG se recomprime: una foto en PNG pesa ~850 KB y WhatsApp deja de mostrar
 * vistas previas pesadas; en JPEG queda en ~100 KB. Esas rutas cambian con el evento, así que su caché es de
 * una hora (el PNG por defecto de ImageResponse se marca inmutable por un año).
 */
export async function renderOg(card: OgCard, { jpeg = false }: { jpeg?: boolean } = {}) {
  const png = await renderPng(card, jpeg);
  if (!jpeg) return png;
  const headers = { "content-type": "image/jpeg", "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" };
  try {
    const { default: sharp } = await import("sharp");
    const out = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(out), { headers });
  } catch {
    // sin sharp (no debería pasar en Vercel): se rehace el PNG, el anterior ya se consumió
    return renderPng(card, true);
  }
}

async function renderPng({ icon, eyebrow, title, subtitle, chips = [], photo, photoSide = "right", freeChip }: OgCard, shortCache: boolean) {
  const lines = (Array.isArray(subtitle) ? subtitle : [subtitle]).filter((l): l is string => !!l);
  const fonts = await loadFonts(`${SITE_NAME}${SITE_HOST}${eyebrow ?? ""}${title}${lines.join("")}${chips.join("")}${freeChip ?? ""}·`);
  const narrow = !!photo;
  const titleSize = title.length > 60 ? (narrow ? 46 : 54) : title.length > 34 ? (narrow ? 54 : 64) : narrow ? 64 : 76;
  const photoPane = photo && (
    <div style={{ display: "flex", width: photoSide === "left" ? 460 : 440, height: "100%", background: BRAND.bg2 }}>
      {/* el flyer se ve completo (trae fecha y precio escritos); la portada del municipio llena el espacio */}
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse solo entiende <img> */}
      <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: photoSide === "left" ? "contain" : "cover" }} />
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#fff", fontFamily: fonts ? "Jakarta" : "sans-serif" }}>
        {photoSide === "left" && photoPane}
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", padding: "56px 60px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <BrandMark size={56} />
            <div style={{ fontSize: 32, fontWeight: 800, color: BRAND.accent, letterSpacing: -0.5 }}>{SITE_NAME}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {!photo && icon !== "brand" && <PageIcon name={icon} size={96} />}
            {eyebrow && <div style={{ fontSize: 28, fontWeight: 700, color: BRAND.ink2 }}>{eyebrow}</div>}
            <div style={{ fontSize: titleSize, fontWeight: 800, color: BRAND.ink, lineHeight: 1.05, letterSpacing: -1.5 }}>{title}</div>
            {lines.map((l) => <div key={l} style={{ fontSize: 30, fontWeight: 700, color: BRAND.ink2, lineHeight: 1.3 }}>{l}</div>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12 }}>
              {[...(freeChip ? [freeChip] : []), ...chips].slice(0, 3).map((c) => (
                <div
                  key={c}
                  style={c === freeChip
                    ? { display: "flex", padding: "10px 22px", borderRadius: 999, background: "#e8f5e9", fontSize: 26, fontWeight: 800, color: BRAND.free }
                    : { display: "flex", padding: "10px 22px", borderRadius: 999, border: "2px solid #dddddd", fontSize: 24, fontWeight: 700, color: BRAND.ink }}
                >
                  {c}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: BRAND.ink3 }}>{SITE_HOST}</div>
          </div>
        </div>
        {photoSide === "right" && photoPane}
        {!photo && icon === "brand" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 420, height: "100%", background: "#fff1f3" }}>
            <BrandMark size={260} />
          </div>
        )}
      </div>
    ),
    {
      ...OG_SIZE,
      fonts,
      ...(shortCache && { headers: { "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" } }),
    },
  );
}
