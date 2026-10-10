import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EXPERIENCE_KINDS, type ExperienceKind } from "@/lib/experiences";
import { flyerUrl } from "@/lib/format";
import { ExperienceStatusButtons } from "./status-buttons";

export const metadata = { title: "Experiencias · Admin" };

const STATUSES = [["", "Todas"], ["published", "Publicadas"], ["draft", "Borradores"], ["archived", "Archivadas"]] as const;
const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  published: { label: "Publicada", cls: "bg-free-bg text-free" },
  draft: { label: "Borrador", cls: "bg-bg-2 text-ink-2" },
  archived: { label: "Archivada", cls: "bg-bg-2 text-ink-3" },
};

type Row = {
  id: string; slug: string; title: string; kind: ExperienceKind; status: string; image_path: string | null;
  availability_text: string | null; valid_until: string | null; updated_at: string;
  municipalities: { name: string } | null; places: { name: string } | null; place_text: string | null;
  events: { id: string }[];
};

export default async function ExperiencesAdminPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const status = (await searchParams).s ?? "";
  const sb = await createClient();
  let q = sb.from("experiences")
    .select("id, slug, title, kind, status, image_path, availability_text, valid_until, updated_at, place_text, municipalities:municipality_cvegeo(name), places:place_id(name), events(id)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Experiencias · {rows.length}</h1>
          <p className="mt-1 text-[14px] text-ink-2">Lo que se puede hacer cualquier día. Sus salidas con guía son eventos: vincúlalos desde la revisión del evento.</p>
        </div>
        <Link href="/admin/experiencias/nueva" className="flex items-center gap-1.5 rounded-control bg-accent px-4 py-2.5 text-[14px] font-semibold text-white"><Plus size={16} aria-hidden /> Nueva experiencia</Link>
      </div>

      <nav aria-label="Filtrar por estado" className="mt-4 flex flex-wrap gap-2 text-[13px]">
        {STATUSES.map(([k, l]) => (
          <Link key={k} href={k ? `/admin/experiencias?s=${k}` : "/admin/experiencias"} aria-current={status === k ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 font-medium ${status === k ? "border-ink bg-ink text-white" : "border-line-2"}`}>{l}</Link>
        ))}
      </nav>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[14px]">
            <caption className="sr-only">Experiencias</caption>
            <thead className="text-left text-[12px] uppercase tracking-[0.04em] text-ink-2">
              <tr>
                <th scope="col" className="border-b border-line bg-bg-2 px-3 py-2.5 font-semibold">Experiencia</th>
                <th scope="col" className="border-b border-line bg-bg-2 px-3 py-2.5 font-semibold">Lugar</th>
                <th scope="col" className="border-b border-line bg-bg-2 px-3 py-2.5 text-right font-semibold">Salidas</th>
                <th scope="col" className="border-b border-line bg-bg-2 px-3 py-2.5 font-semibold">Estado</th>
                <th scope="col" className="border-b border-line bg-bg-2 px-3 py-2.5 text-right font-semibold"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const img = flyerUrl(x.image_path);
                const pill = STATUS_PILL[x.status] ?? STATUS_PILL.draft;
                const expired = !!x.valid_until && x.valid_until < today;
                return (
                  <tr key={x.id} className="hover:bg-bg-2/60">
                    <th scope="row" className="max-w-[340px] border-b border-line px-3 py-2 text-left font-normal">
                      <div className="flex items-center gap-3">
                        <div className="relative hidden h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-bg-2 sm:block">{img && <Image src={img} alt="" fill sizes="40px" className="object-cover" />}</div>
                        <div className="min-w-0">
                          <Link href={`/admin/experiencias/${x.id}`} className="block truncate font-medium hover:underline">{x.title}</Link>
                          <span className="block truncate text-[12px] text-ink-2">{EXPERIENCE_KINDS[x.kind]?.emoji} {EXPERIENCE_KINDS[x.kind]?.label} · {x.availability_text ?? "sin horario"}</span>
                        </div>
                      </div>
                    </th>
                    <td className="border-b border-line px-3 py-2">
                      <span className="block truncate">{x.places?.name ?? x.place_text ?? "—"}</span>
                      <span className="block text-[12px] text-ink-2">{x.municipalities?.name ?? "—"}</span>
                    </td>
                    <td className="border-b border-line px-3 py-2 text-right tabular-nums">{x.events.length}</td>
                    <td className="border-b border-line px-3 py-2">
                      <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${pill.cls}`}>{pill.label}</span>
                      {expired && <span className="ml-2 text-[12px] font-medium text-warn">vencida</span>}
                    </td>
                    <td className="border-b border-line px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {x.status === "published" && (
                          <Link href={`/experiencia/${x.slug}`} target="_blank" aria-label="Ver en el sitio" title="Ver en el sitio" className="grid h-8 w-8 place-items-center rounded-control border border-line-2 text-ink-2 hover:text-ink"><ExternalLink size={15} aria-hidden /></Link>
                        )}
                        <Link href={`/admin/experiencias/${x.id}`} aria-label="Editar" title="Editar" className="grid h-8 w-8 place-items-center rounded-control border border-line-2 text-ink-2 hover:text-ink"><Pencil size={15} aria-hidden /></Link>
                        <ExperienceStatusButtons id={x.id} status={x.status} title={x.title} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {error && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[14px]">No se pudieron cargar las experiencias ({error.message}).</td></tr>
              )}
              {!error && !rows.length && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[14px] text-ink-2">
                  {status ? "Ninguna experiencia con este estado." : <>Todavía no hay experiencias. <Link href="/admin/experiencias/nueva" className="font-medium text-ink underline">Crea la primera</Link></>}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
