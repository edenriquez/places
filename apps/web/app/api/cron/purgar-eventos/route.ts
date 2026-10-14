import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { EVENTS_TAG } from "@/lib/queries";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Purga diaria (Vercel Cron, ver vercel.json): los eventos cuya última fecha pasó hace más de una semana pierden
 * flyer, fotos, contacto y los datos de personas; quedan su esqueleto y las métricas (purge_past_events en la BD).
 * Aquí se quitan del bucket las fotos que la BD devuelve, que ya nadie más usa. Vercel manda el CRON_SECRET.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sb = createServiceClient();
  if (!sb) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

  const { data, error } = await sb.rpc("purge_past_events");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as { event_id: string; photo_paths: string[] }[];
  const paths = rows.flatMap((r) => r.photo_paths);

  // el bucket acepta lotes; si algo falla las filas ya están purgadas y solo queda una foto huérfana
  let removed = 0;
  const failed: string[] = [];
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { data: gone, error: rmError } = await sb.storage.from("flyers").remove(batch);
    if (rmError) failed.push(...batch);
    else removed += gone?.length ?? 0;
  }
  if (rows.length) revalidateTag(EVENTS_TAG, "max");

  return NextResponse.json({ purged: rows.length, photos_removed: removed, photos_failed: failed });
}
