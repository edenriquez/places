import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { flyerUrl, fmtWhenShort } from "@/lib/format";
import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { StatusPill } from "../status-pill";
import { EventStatusButtons } from "./status-buttons";
import { EventImageButton } from "./image-button";

export const metadata = { title: "Eventos · Admin" };

export default async function EventsAdminPage({ searchParams }: { searchParams: Promise<{ s?: string; q?: string; m?: string }> }) {
  const sp = await searchParams;
  const status = sp.s ?? "";
  const search = (sp.q ?? "").trim();
  const muni = sp.m ?? "";
  const sb = await createClient();
  const { data: munis } = await sb.from("municipalities_view").select("cvegeo,name").order("name");
  let q = sb.from("events")
    .select("id, slug, title, category, status, is_free, price_min, image_path, raw_ingestion_id, municipalities:municipality_cvegeo(name), event_occurrences(starts_at)")
    .order("created_at", { ascending: false }).limit(100);
  if (status) q = q.eq("status", status);
  if (muni) q = q.eq("municipality_cvegeo", muni);
  if (search) q = q.ilike("title", `%${search.replace(/[%_]/g, "\\$&")}%`);
  const { data } = await q;
  const link = (over: Partial<{ s: string; q: string; m: string }>) => {
    const params = new URLSearchParams();
    const next = { s: status, q: search, m: muni, ...over };
    if (next.s) params.set("s", next.s);
    if (next.q) params.set("q", next.q);
    if (next.m) params.set("m", next.m);
    const qs = params.toString();
    return qs ? `/admin/events?${qs}` : "/admin/events";
  };
  const rows = (data ?? []) as unknown as { id: string; slug: string; title: string; category: Category; status: string; is_free: boolean; price_min: number | null; image_path: string | null; raw_ingestion_id: string | null; municipalities: { name: string } | null; event_occurrences: { starts_at: string }[] }[];

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Eventos · {rows.length}</h1>
          <p className="mt-1 text-[14px] text-ink-2">Publica, despublica y sube la imagen de cada evento. La imagen de una fiesta se reutiliza cada año.</p>
        </div>
        <div className="flex gap-2 text-[13px]">
          {[["", "Todos"], ["published", "Publicados"], ["pending", "Pendientes"], ["rejected", "Descartados"]].map(([k, l]) => (
            <Link key={k} href={link({ s: k })} className={`rounded-full border px-3 py-1.5 font-medium ${status === k ? "border-ink bg-ink text-white" : "border-line-2"}`}>{l}</Link>
          ))}
        </div>
      </div>

      <form className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
        {status && <input type="hidden" name="s" value={status} />}
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Buscar por nombre del evento"
            className="w-full rounded-control border border-line-2 bg-white py-2 pl-9 pr-3 focus:border-ink focus:outline-none"
          />
        </div>
        <select name="m" defaultValue={muni} className="rounded-control border border-line-2 bg-white px-3 py-2">
          <option value="">Todos los municipios</option>
          {(munis ?? []).map((m) => <option key={m.cvegeo} value={m.cvegeo}>{m.name}</option>)}
        </select>
        <button className="rounded-control border border-ink px-4 py-2 font-semibold">Filtrar</button>
        {(search || muni) && <Link href={link({ q: "", m: "" })} className="px-2 py-2 text-[13px] text-ink-2 underline">Limpiar</Link>}
      </form>
      <div className="mt-5 overflow-hidden rounded-card border border-line">
        <table className="w-full text-[14px]">
          <thead className="bg-bg-2 text-left text-[12px] uppercase tracking-[0.04em] text-ink-2">
            <tr><th className="px-4 py-2.5"></th><th className="px-4 py-2.5">Evento</th><th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Municipio</th><th className="px-4 py-2.5">Estado</th><th className="px-4 py-2.5"></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((e) => {
              const url = flyerUrl(e.image_path);
              const first = e.event_occurrences.map((o) => o.starts_at).sort()[0];
              return (
                <tr key={e.id}>
                  <td className="px-4 py-2"><div className="relative h-10 w-10 overflow-hidden rounded-lg bg-bg-2">{url && <Image src={url} alt="" fill sizes="40px" className="object-cover" />}</div></td>
                  <td className="px-4 py-2">
                    <Link href={`/evento/${e.slug}`} target="_blank" className="font-medium hover:underline">{e.title}</Link>
                    <span className="block text-[12px] text-ink-2">{CATEGORY_LABEL[e.category]} · {e.is_free ? "Gratis" : e.price_min != null ? `$${e.price_min}` : "—"}</span>
                  </td>
                  <td className="px-4 py-2 text-ink-2">{first ? fmtWhenShort(first) : "sin fecha"}</td>
                  <td className="px-4 py-2 text-ink-2">{e.municipalities?.name ?? "—"}</td>
                  <td className="px-4 py-2"><StatusPill status={e.status} /></td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {e.raw_ingestion_id && <Link href={`/admin/review/${e.raw_ingestion_id}`} className="rounded-control border border-line-2 px-3 py-1.5 text-[13px] font-semibold">Editar</Link>}
                      <EventImageButton eventId={e.id} hasImage={!!e.image_path} />
                      <EventStatusButtons id={e.id} status={e.status} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-2">{search || muni ? "Ningún evento coincide con la búsqueda." : "No hay eventos con ese filtro."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
