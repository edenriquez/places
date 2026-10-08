import sharp, { type OverlayOptions } from "sharp";
import { eventCoords } from "@/components/event-detail";
import { eventBySlug } from "@/lib/queries";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";
import { mapKey, STATIC_MAP } from "@/lib/static-map";

/**
 * Mini mapa del detalle como imagen: teselas de OpenStreetMap unidas en el servidor y guardadas en el CDN.
 * Reemplaza a maplibre en la carga (~430 KB de JS y ~400 KB de teselas vectoriales); el mapa interactivo
 * solo se baja si lo tocan. Solo responde con las coordenadas actuales de un evento publicado: no es un
 * proxy abierto de OSM.
 */
const TILE = 256;
const { w: W, h: H, zoom: Z } = STATIC_MAP;

// la política de OSM pide identificarse y respetar al menos 7 días de caché
const OSM_HEADERS = { "user-agent": `EntreLugares/1.0 (+${SITE_URL}; ${CONTACT_EMAIL})` };

function worldPx(lat: number, lng: number) {
  const n = TILE * 2 ** Z;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
}

async function tile(x: number, y: number) {
  const res = await fetch(`https://tile.openstreetmap.org/${Z}/${x}/${y}.png`, {
    headers: OSM_HEADERS,
    next: { revalidate: 7 * 86400 },
  });
  if (!res.ok) throw new Error(`osm ${Z}/${x}/${y}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await eventBySlug(slug);
  const c = data && eventCoords(data);
  if (!c || new URL(req.url).searchParams.get("ll") !== mapKey(c)) return new Response("not found", { status: 404 });

  const p = worldPx(c.lat, c.lng);
  const left = Math.round(p.x - W / 2);
  const top = Math.round(p.y - H / 2);
  const [x0, y0] = [Math.floor(left / TILE), Math.floor(top / TILE)];
  const [x1, y1] = [Math.floor((left + W - 1) / TILE), Math.floor((top + H - 1) / TILE)];

  const jobs: Promise<OverlayOptions>[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      jobs.push(tile(x, y).then((input) => ({ input, left: (x - x0) * TILE, top: (y - y0) * TILE })));
    }
  }
  let tiles: OverlayOptions[];
  try {
    tiles = await Promise.all(jobs);
  } catch (e) {
    console.error("mini mapa:", e);
    return new Response("upstream error", { status: 502, headers: { "cache-control": "no-store" } });
  }

  const grid = await sharp({
    create: { width: (x1 - x0 + 1) * TILE, height: (y1 - y0 + 1) * TILE, channels: 3, background: "#f2f2ef" },
  })
    .composite(tiles)
    .png()
    .toBuffer();
  // menos color que el estilo de OSM: se acerca al positron del mapa grande
  const img = await sharp(grid)
    .extract({ left: left - x0 * TILE, top: top - y0 * TILE, width: W, height: H })
    .modulate({ saturation: 0.45, brightness: 1.03 })
    .webp({ quality: 72 })
    .toBuffer();

  return new Response(new Uint8Array(img), {
    headers: {
      "content-type": "image/webp",
      "cache-control": "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=2592000",
    },
  });
}
