import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { flyerUrl, fmtWhenShort } from "@/lib/format";
import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { StatusPill } from "../status-pill";
import { EventStatusButtons } from "./status-buttons";
import { EventImageButton } from "./image-button";

export const metadata = { title: "Eventos · Admin" };

export default async function EventsAdminPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();
  let q = sb.from("events")
    .select("id, slug, title, category, status, is_free, price_min, image_path, municipalities:municipality_cvegeo(name), event_occurrences(starts_at)")
    .order("created_at", { ascending: false }).limit(100);
  if (sp.s) q = q.eq("status", sp.s);
  const { data } = await q;
  const rows = (data ?? []) as unknown as { id: string; slug: string; title: string; category: Category; status: string; is_free: boolean; price_min: number | null; image_path: string | null; municipalities: { name: string } | null; event_occurrences: { starts_at: string }[] }[];

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Eventos · {rows.length}</h1>
          <p className="mt-1 text-[14px] text-ink-2">Publica, despublica y sube la imagen de cada evento. La imagen de una fiesta se reutiliza cada año.</p>
        </div>
        <div className="flex gap-2 text-[13px]">
          {[["", "Todos"], ["published", "Publicados"], ["pending", "Pendientes"], ["rejected", "Descartados"]].map(([k, l]) => (
            <Link key={k} href={k ? `/admin/events?s=${k}` : "/admin/events"} className={`rounded-full border px-3 py-1.5 font-medium ${(sp.s ?? "") === k ? "border-ink bg-ink text-white" : "border-line-2"}`}>{l}</Link>
          ))}
        </div>
      </div>
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
                      <EventImageButton eventId={e.id} hasImage={!!e.image_path} />
                      <EventStatusButtons id={e.id} status={e.status} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-2">No hay eventos con ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
