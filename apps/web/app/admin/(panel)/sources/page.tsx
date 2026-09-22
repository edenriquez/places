import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/format";
import type { Source } from "@/lib/types";
import { addSource } from "../actions";
import { SourceActions } from "./source-actions";

export const metadata = { title: "Fuentes · Admin" };

const KIND_LABEL: Record<string, string> = {
  facebook_page: "Facebook", instagram: "Instagram", website: "Sitio web", manual: "Manual",
  public_form: "Formulario", sic: "SIC", denue: "DENUE", user_report: "Reporte", correspondent: "Corresponsal",
};

export default async function SourcesPage() {
  const sb = await createClient();
  const [{ data: rows }, { data: munis }] = await Promise.all([
    sb.from("sources").select("*, municipalities:municipality_cvegeo(name)").in("kind", ["facebook_page", "instagram", "website"]).order("name"),
    sb.from("municipalities_view").select("cvegeo,name").order("name"),
  ]);
  const sources = (rows ?? []) as (Source & { municipalities: { name: string } | null })[];
  const active = sources.filter((s) => s.enabled).length;
  const lastRun = sources.map((s) => s.last_run_at).filter(Boolean).sort().pop() as string | undefined;

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="rounded-card bg-bg-2 px-4 py-3 text-[13px] text-ink-2">
        {lastRun ? `El job local corrió por última vez ${relativeTime(lastRun)} desde la Mac.` : "El job local aún no ha corrido ningún scraper. Corre `places-ingest scrape` en la Mac."}
      </div>
      <h1 className="mt-5 text-[28px] font-bold">Fuentes · {active} activas</h1>
      <p className="mt-1 text-[14px] text-ink-2">Páginas y sitios que el job local revisa para encontrar flyers nuevos.</p>

      <form action={addSource} className="mt-5 grid gap-3 rounded-card border border-line p-4 md:grid-cols-[1fr_140px_1fr_160px_110px_auto]">
        <input name="name" required placeholder="Nombre (Ayuntamiento de…)" className={inputCls} />
        <select name="kind" className={inputCls} defaultValue="facebook_page">
          <option value="facebook_page">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="website">Sitio web</option>
        </select>
        <input name="url" type="url" required placeholder="https://facebook.com/…" className={inputCls} />
        <select name="municipality" className={inputCls} defaultValue="">
          <option value="">Municipio…</option>
          {(munis ?? []).map((m) => <option key={m.cvegeo} value={m.cvegeo}>{m.name}</option>)}
        </select>
        <input name="interval_hours" type="number" min={1} defaultValue={24} className={inputCls} title="Intervalo en horas" />
        <button className="rounded-control bg-accent px-4 py-2 text-[14px] font-semibold text-white">Agregar</button>
      </form>

      <div className="mt-6 overflow-hidden rounded-card border border-line">
        <table className="w-full text-[14px]">
          <thead className="bg-bg-2 text-left text-[12px] uppercase tracking-[0.04em] text-ink-2">
            <tr>
              <th className="px-4 py-2.5">Fuente</th>
              <th className="px-4 py-2.5">Tipo</th>
              <th className="px-4 py-2.5">Municipio</th>
              <th className="px-4 py-2.5">Intervalo</th>
              <th className="px-4 py-2.5">Última corrida</th>
              <th className="px-4 py-2.5">Nuevos</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sources.map((s) => (
              <Fragment key={s.id}>
                <tr className={s.enabled ? "" : "opacity-50"}>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{s.name}</span>
                    {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="block max-w-[280px] truncate text-[12px] text-ink-2 underline">{s.url.replace(/^https?:\/\//, "")}</a>}
                  </td>
                  <td className="px-4 py-3"><span className="rounded-full border border-line-2 px-2 py-0.5 text-[12px]">{KIND_LABEL[s.kind] ?? s.kind}</span></td>
                  <td className="px-4 py-3 text-ink-2">{s.municipalities?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-2">cada {s.interval_hours} h</td>
                  <td className="px-4 py-3 text-ink-2">{relativeTime(s.last_run_at)}{s.run_requested_at && <span className="block text-[11px] text-accent">corrida solicitada</span>}</td>
                  <td className="px-4 py-3 font-medium">{s.new_items_last_run ? `+${s.new_items_last_run}` : "0"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[13px]">
                      <span className={`h-2 w-2 rounded-full ${s.last_error ? "bg-error" : s.last_success_at ? "bg-free" : "bg-ink-3"}`} />
                      {s.last_error ? "Error" : s.last_success_at ? "OK" : "Sin correr"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right"><SourceActions id={s.id} enabled={s.enabled} /></td>
                </tr>
                {s.last_error && (
                  <tr className="bg-[#fff7f6]">
                    <td colSpan={8} className="px-4 py-2 font-mono text-[12px] text-error">{s.last_error}</td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!sources.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-2">Agrega la primera fuente arriba.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputCls = "rounded-control border border-line-2 bg-white px-3 py-2 text-[14px]";
