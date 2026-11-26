import { NextResponse, type NextRequest } from "next/server";
import { deviceOf, isBot, STAFF_COOKIE } from "@/lib/analytics";
import { isAdminUser } from "@/lib/analytics-server";
import { createServiceClient } from "@/lib/supabase/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 16384;
const MAX_CLICKS = 50;
const uuidOr = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const IGNORED = /^\/(admin|reporte|api|auth)(\/|$)/;

type Batch = { sessionId?: string; uid?: string; now?: number; clicks?: { p?: unknown; x?: unknown; y?: unknown; vw?: unknown; t?: unknown; ts?: unknown }[] };

/** Lotes de clics de lib/clicks.ts (mapa de calor). Mismo filtro que /api/t; siempre 204. */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  try {
    const ua = request.headers.get("user-agent");
    const visitor = uuidOr(request.cookies.get("el_vid")?.value);
    const sb = createServiceClient();
    if (!sb || !visitor || isBot(ua) || request.cookies.has(STAFF_COOKIE)) return done;

    const raw = await request.text();
    if (raw.length > MAX_BODY) return done;
    const b = JSON.parse(raw) as Batch;
    if (!Array.isArray(b.clicks) || !b.clicks.length) return done;
    const uid = uuidOr(b.uid);
    if (uid && (await isAdminUser(sb, uid))) return done;

    // la hora del clic según el navegador, corregida por el desfase de su reloj respecto al servidor
    const skew = typeof b.now === "number" ? Date.now() - b.now : 0;
    const device = deviceOf(ua);
    const rows = b.clicks.slice(0, MAX_CLICKS).flatMap((c) => {
      const x = Number(c.x), y = Number(c.y), vw = Number(c.vw), ts = Number(c.ts);
      if (typeof c.p !== "string" || !c.p.startsWith("/") || IGNORED.test(c.p)) return [];
      if (!(x >= 0 && x <= 1) || !(y >= 0 && y < 1e6) || !(vw > 0 && vw < 10000)) return [];
      const at = Number.isFinite(ts) ? Math.min(Date.now(), ts + skew) : Date.now();
      return [{
        ts: new Date(at).toISOString(),
        visitor_id: visitor,
        session_id: uuidOr(b.sessionId),
        user_id: uid,
        path: c.p.slice(0, 300),
        x,
        y: Math.round(y),
        vw: Math.round(vw),
        device,
        target: typeof c.t === "string" ? c.t.slice(0, 80) : null,
      }];
    });
    if (rows.length) await sb.from("analytics_clicks").insert(rows);
  } catch {
    // payload inválido o BD caída: se ignora
  }
  return done;
}
