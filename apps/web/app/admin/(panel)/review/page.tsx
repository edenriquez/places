import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { flyerUrl, relativeTime } from "@/lib/format";
import { StatusPill } from "../status-pill";

export const metadata = { title: "Revisión · Admin" };

export default async function ReviewListPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();
  let q = sb.from("raw_ingestions").select("id, status, media_path, received_at, confidence, extraction, municipality_hint, municipalities:municipality_hint(name)")
    .eq("status", "needs_review").order("received_at");
  if (sp.m) q = q.eq("municipality_hint", sp.m);
  const [{ data: rows }, { data: munis }] = await Promise.all([q, sb.from("municipalities_view").select("cvegeo,name").order("name")]);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Revisión · {rows?.length ?? 0} pendientes</h1>
          <p className="mt-1 text-[14px] text-ink-2">Eventos extraídos automáticamente que esperan tu aprobación.</p>
        </div>
        <form className="flex items-center gap-2 text-[13px]">
          <select name="m" defaultValue={sp.m ?? ""} className="rounded-control border border-line-2 bg-white px-3 py-2">
            <option value="">Todos los municipios</option>
            {(munis ?? []).map((m) => <option key={m.cvegeo} value={m.cvegeo}>{m.name}</option>)}
          </select>
          <button className="rounded-control border border-ink px-3 py-2 font-semibold">Filtrar</button>
        </form>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(rows ?? []).map((r) => {
          const ex = (r.extraction ?? {}) as { title?: string; dates?: { date: string }[] };
          const muni = r.municipalities as unknown as { name: string } | null;
          const url = flyerUrl(r.media_path);
          return (
            <li key={r.id}>
              <Link href={`/admin/review/${r.id}`} className="block overflow-hidden rounded-card border border-line hover:border-ink">
                <div className="relative aspect-[4/3] bg-bg-2">{url && <Image src={url} alt="" fill sizes="320px" className="object-cover" />}</div>
                <div className="p-3">
                  <p className="line-clamp-2 text-[14px] font-semibold">{ex.title ?? "Sin título"}</p>
                  <p className="mt-1 text-[12px] text-ink-2">{ex.dates?.[0]?.date ?? "sin fecha"} · {muni?.name ?? "sin municipio"}</p>
                  <div className="mt-2 flex items-center justify-between text-[12px] text-ink-2">
                    <span>Confianza {r.confidence ?? "—"}</span>
                    <span>{relativeTime(r.received_at)}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {!rows?.length && (
        <div className="mt-8 rounded-card border border-dashed border-line-2 p-10 text-center text-ink-2">
          <StatusPill status="approved" /> <span className="ml-2">Nada pendiente. Sube flyers o espera al job local.</span>
        </div>
      )}
    </div>
  );
}
