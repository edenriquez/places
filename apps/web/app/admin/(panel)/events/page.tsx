import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, BarChart3, Pencil, Search, X } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/server";
import { flyerUrl, fmtWhenShort } from "@/lib/format";
import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { StatusPill } from "../status-pill";
import { EventStatusButtons } from "./status-buttons";
import { EventImageButton } from "./image-button";

export const metadata = { title: "Eventos · Admin" };

const PAGE_SIZE = 50;
const STATUSES = [["", "Todos"], ["published", "Publicados"], ["pending", "Pendientes"], ["cancelled", "Cancelados"], ["rejected", "Descartados"]] as const;
// columnas ordenables en el servidor (la fecha vive en event_occurrences y no ordena al evento)
const SORTS = { created: { col: "created_at", label: "agregado" }, title: { col: "title", label: "nombre" }, status: { col: "status", label: "estado" } } as const;
type SortKey = keyof typeof SORTS;
type Params = { s: string; q: string; m: string; o: string; d: string; p: string };

export default async function EventsAdminPage({ searchParams }: { searchParams: Promise<Partial<Params>> }) {
  const sp = await searchParams;
  const status = sp.s ?? "";
  const search = (sp.q ?? "").trim();
  const muni = sp.m ?? "";
  const sort: SortKey = sp.o && sp.o in SORTS ? (sp.o as SortKey) : "created";
  const dir = sp.d === "asc" || sp.d === "desc" ? sp.d : sort === "created" ? "desc" : "asc";
  const page = Math.max(1, Number(sp.p) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const sb = await createClient();
  const { data: munis } = await sb.from("municipalities_view").select("cvegeo,name").order("name");
  let q = sb.from("events")
    .select("id, slug, title, category, status, is_free, price_min, image_path, raw_ingestion_id, created_at, municipalities:municipality_cvegeo(name), event_occurrences(starts_at)", { count: "exact" })
    .order(SORTS[sort].col, { ascending: dir === "asc" })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  if (status) q = q.eq("status", status);
  if (muni) q = q.eq("municipality_cvegeo", muni);
  if (search) q = q.ilike("title", `%${search.replace(/[%_]/g, "\\$&")}%`);
  const { data, count, error } = await q;
  const total = count ?? 0;

  const current: Params = { s: status, q: search, m: muni, o: sort === "created" ? "" : sort, d: sp.d ?? "", p: "" };
  // cualquier cambio de filtro u orden vuelve a la página 1
  const link = (over: Partial<Params>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, p: "", ...over })) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/admin/events?${qs}` : "/admin/events";
  };
  const sortLink = (key: SortKey) => {
    const nextDir = sort === key ? (dir === "asc" ? "desc" : "asc") : key === "created" ? "desc" : "asc";
    return link({ o: key === "created" ? "" : key, d: nextDir });
  };
  const rows = (data ?? []) as unknown as { id: string; slug: string; title: string; category: Category; status: string; is_free: boolean; price_min: number | null; image_path: string | null; raw_ingestion_id: string | null; created_at: string; municipalities: { name: string } | null; event_occurrences: { starts_at: string }[] }[];
  const muniName = munis?.find((m) => m.cvegeo === muni)?.name;
  const chips = [
    search && { label: `“${search}”`, href: link({ q: "" }) },
    muni && { label: muniName ?? muni, href: link({ m: "" }) },
  ].filter(Boolean) as { label: string; href: string }[];
  const filtered = chips.length > 0 || !!status;
  const to = Math.min(from + rows.length, total);

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Eventos · {total}</h1>
          <p className="mt-1 text-[14px] text-ink-2">Publica, despublica y sube la imagen de cada evento. La imagen de una fiesta se reutiliza cada año.</p>
        </div>
        <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2 text-[13px]">
          {STATUSES.map(([k, l]) => (
            <Link key={k} href={link({ s: k })} aria-current={status === k ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 font-medium ${status === k ? "border-ink bg-ink text-white" : "border-line-2"}`}>{l}</Link>
          ))}
        </nav>
      </div>

      <form className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
        {status && <input type="hidden" name="s" value={status} />}
        {current.o && <input type="hidden" name="o" value={current.o} />}
        {current.d && <input type="hidden" name="d" value={current.d} />}
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            name="q"
            type="search"
            aria-label="Buscar por nombre del evento"
            defaultValue={search}
            placeholder="Buscar por nombre del evento"
            className="w-full rounded-control border border-line-2 bg-white py-2 pl-9 pr-3 focus:border-ink focus:outline-none"
          />
        </div>
        <select name="m" defaultValue={muni} aria-label="Municipio" className="rounded-control border border-line-2 bg-white px-3 py-2">
          <option value="">Todos los municipios</option>
          {(munis ?? []).map((m) => <option key={m.cvegeo} value={m.cvegeo}>{m.name}</option>)}
        </select>
        <button className="rounded-control border border-ink px-4 py-2 font-semibold">Filtrar</button>
      </form>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          {chips.map((c) => (
            <Link key={c.href} href={c.href} className="inline-flex items-center gap-1 rounded-full bg-bg-2 px-3 py-1 font-medium">
              {c.label} <X size={12} aria-hidden /><span className="sr-only">Quitar filtro</span>
            </Link>
          ))}
          <Link href={link({ q: "", m: "" })} className="text-ink-2 underline">Limpiar filtros</Link>
        </div>
      )}

      <p aria-live="polite" className="sr-only">{`${total} eventos · ordenados por ${SORTS[sort].label}, ${dir === "asc" ? "ascendente" : "descendente"}`}</p>

      <div className="mt-5 overflow-hidden rounded-card border border-line bg-white">
        {/* la tabla se desplaza dentro de su caja (encabezado y columna Evento fijos), nunca la página */}
        <div className="max-h-[75vh] overflow-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[14px]">
            <caption className="sr-only">Eventos</caption>
            <thead className="sticky top-0 z-20 text-left text-[12px] uppercase tracking-[0.04em] text-ink-2">
              <tr>
                <SortTh label="Evento" active={sort === "title"} dir={dir} href={sortLink("title")} className="sticky left-0 z-30 min-w-[210px] md:min-w-[260px]" />
                <th scope="col" className="border-b border-line bg-bg-2 px-3 py-2.5 font-semibold">Fecha y municipio</th>
                <SortTh label="Estado" active={sort === "status"} dir={dir} href={sortLink("status")} />
                <SortTh label="Agregado" active={sort === "created"} dir={dir} href={sortLink("created")} />
                <th scope="col" className="border-b border-line bg-bg-2 px-3 py-2.5 text-right font-semibold"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const url = flyerUrl(e.image_path);
                const first = e.event_occurrences.map((o) => o.starts_at).sort()[0];
                return (
                  <tr key={e.id} className="group bg-white hover:bg-bg-2/60 focus-within:bg-bg-2/60">
                    <th scope="row" className="sticky left-0 z-10 max-w-[58vw] border-b md:max-w-[300px] border-line bg-inherit px-3 py-2 text-left font-normal shadow-[1px_0_0_var(--line)]">
                      <div className="flex items-center gap-3">
                        <div className="relative hidden h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-bg-2 sm:block">{url && <Image src={url} alt="" fill sizes="40px" className="object-cover" />}</div>
                        <div className="min-w-0">
                          <Link href={`/evento/${e.slug}`} target="_blank" title={e.title} className="block truncate font-medium hover:underline focus-visible:underline">{e.title}</Link>
                          <span className="block truncate text-[12px] text-ink-2">{CATEGORY_LABEL[e.category]} · {e.is_free ? "Gratis" : e.price_min != null ? `$${e.price_min}` : "—"}</span>
                        </div>
                      </div>
                    </th>
                    <td className="whitespace-nowrap border-b border-line px-3 py-2">
                      <span className="block tabular-nums">{first ? fmtWhenShort(first) : "sin fecha"}</span>
                      <span className="block text-[12px] text-ink-2">{e.municipalities?.name ?? "—"}</span>
                    </td>
                    <td className="border-b border-line px-3 py-2"><StatusPill status={e.status} /></td>
                    <td className="whitespace-nowrap border-b border-line px-3 py-2 text-[13px] text-ink-2 tabular-nums">{fmtShortDate(e.created_at)}</td>
                    <td className="border-b border-line px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {e.status === "published" && <IconLink href={`/admin/events/${e.id}/metricas`} label="Métricas"><BarChart3 size={15} aria-hidden /></IconLink>}
                        {e.raw_ingestion_id && <IconLink href={`/admin/review/${e.raw_ingestion_id}`} label="Editar"><Pencil size={15} aria-hidden /></IconLink>}
                        <EventImageButton eventId={e.id} hasImage={!!e.image_path} />
                        <EventStatusButtons id={e.id} status={e.status} title={e.title} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {error && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[14px]">
                  No se pudieron cargar los eventos ({error.message}). <Link href={link({})} className="underline">Reintentar</Link>
                </td></tr>
              )}
              {!error && !rows.length && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[14px] text-ink-2">
                  {filtered
                    ? <>Ningún evento coincide con estos filtros. <Link href="/admin/events" className="font-medium text-ink underline">Ver todos</Link></>
                    : <>Todavía no hay eventos. <Link href="/admin/upload" className="font-medium text-ink underline">Sube un flyer</Link></>}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[13px] text-ink-2">
            <span className="tabular-nums">{from + 1}–{to} de {total}</span>
            {total > PAGE_SIZE && (
              <nav aria-label="Paginación" className="flex gap-2">
                <PageLink href={link({ p: String(page - 1) })} disabled={page <= 1}>Anterior</PageLink>
                <PageLink href={link({ p: String(page + 1) })} disabled={to >= total}>Siguiente</PageLink>
              </nav>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

function SortTh({ label, active, dir, href, className }: { label: string; active: boolean; dir: "asc" | "desc"; href: string; className?: string }) {
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={clsx("border-b border-line bg-bg-2 px-3 py-2.5 font-semibold", className)}>
      <Link href={href} className={clsx("inline-flex items-center gap-1 rounded hover:text-ink focus-visible:text-ink", active && "text-ink")}>
        {label}
        {active ? (dir === "asc" ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />) : null}
      </Link>
    </th>
  );
}

/** Acción secundaria de fila: ícono siempre visible (no depende de hover), nombre accesible y tooltip. */
function IconLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} aria-label={label} title={label} className="grid h-8 w-8 place-items-center rounded-control border border-line-2 text-ink-2 hover:text-ink">
      {children}
    </Link>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span aria-disabled className="rounded-control border border-line px-3 py-1.5 font-semibold text-ink-3">{children}</span>;
  return <Link href={href} className="rounded-control border border-line-2 px-3 py-1.5 font-semibold text-ink">{children}</Link>;
}

const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });
function fmtShortDate(iso: string) {
  return shortDate.format(new Date(iso)).replace(".", "");
}
