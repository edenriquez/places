import Link from "next/link";
import clsx from "clsx";
import { BarList, Card, Empty, fmtN, fmtPct, Funnel, leader, LineChart, Stat, finding } from "@/components/charts/charts";
import { SOURCE_LABEL } from "@/lib/analytics";
import { listPosts } from "@/lib/blog";
import { BLOG_BASE, LOCALES, postPath } from "@/lib/blog-copy";
import { createClient } from "@/lib/supabase/server";
import { MetricsTabs } from "../tabs";

export const metadata = { title: "Blog · Métricas · Admin" };

/** Forma del jsonb de public.admin_blog. */
type Blog = {
  kpi: { visitors: number; pageviews: number; entries: number; search: number; ai: number; app: number; saw_event: number; acted: number; ai_site: number };
  daily: { day: string; visitors: number; entries: number }[];
  sources: { source: string; n: number }[];
  posts: { path: string; views: number; visitors: number; entries: number; search: number; ai: number; app: number; acted: number }[];
  ai_hosts: { host: string; n: number }[];
  ai_paths: { path: string; n: number }[];
};

const RANGES = [["7", "7 días"], ["30", "30 días"], ["90", "90 días"]] as const;
const AI_LABEL: Record<string, string> = {
  "chatgpt.com": "ChatGPT", "chat.openai.com": "ChatGPT", "com.openai.chatgpt": "ChatGPT (app)", "perplexity.ai": "Perplexity",
  "gemini.google.com": "Gemini", "claude.ai": "Claude", "copilot.microsoft.com": "Copilot", "chat.deepseek.com": "DeepSeek",
  "meta.ai": "Meta AI", "grok.com": "Grok",
};
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

export default async function BlogMetricsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.some(([k]) => k === sp.r) ? sp.r! : "30";
  const to = new Date();
  const from = new Date(to.getTime() - Number(range) * 86400000);
  from.setHours(0, 0, 0, 0);
  const sb = await createClient();
  const [{ data, error }, ...lists] = await Promise.all([
    sb.rpc("admin_blog", { p_from: from.toISOString(), p_to: to.toISOString() }),
    ...LOCALES.map((l) => listPosts(l)),
  ]);
  if (error) throw new Error(error.message);
  const b = data as Blog;
  const k = b.kpi;

  // ruta → título de la guía
  const titles = new Map<string, string>([[BLOG_BASE.es, "Índice del blog"], [BLOG_BASE.en, "Índice del blog (inglés)"]]);
  for (const p of lists.flat()) titles.set(postPath(p.slug, p.locale), p.locale === "en" ? `${p.title} (EN)` : p.title);
  const title = (path: string) => titles.get(path) ?? path;

  const sourceRows = b.sources.map((s) => ({ label: SOURCE_LABEL[s.source] ?? s.source, value: s.n }));
  const aiHostRows = b.ai_hosts.map((h) => ({ label: AI_LABEL[h.host] ?? h.host, value: h.n }));
  const aiPathRows = b.ai_paths.map((p) => ({ label: titles.get(p.path) ?? p.path, value: p.n }));
  // los títulos de guía son largos: si van parejos, el título no los junta
  const aiPathLead = leader(aiPathRows);
  const topPost = b.posts.find((p) => p.path !== BLOG_BASE.es && p.path !== BLOG_BASE.en);
  const appPct = pct(k.app, k.entries);

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Métricas</h1>
          <p className="mt-1 text-[14px] text-ink-2">Visitas a las guías, de dónde llegan (buscadores, asistentes de IA, redes) y si siguen a la app.</p>
        </div>
        <nav className="flex gap-2 text-[13px]">
          {RANGES.map(([key, l]) => (
            <Link key={key} href={`?r=${key}`} className={clsx("rounded-full border px-3 py-1.5 font-medium", range === key ? "border-ink bg-ink text-white" : "border-line-2 hover:border-ink")}>{l}</Link>
          ))}
        </nav>
      </div>
      <MetricsTabs active="blog" range={range} />

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat hero label="Visitantes del blog" value={fmtN(k.visitors)} hint={`${fmtN(k.pageviews)} vistas · ${fmtN(k.entries)} sesiones empezaron en una guía`} />
          <Stat label="Llegaron desde buscadores" value={fmtN(k.search)} hint={`${fmtPct(pct(k.search, k.entries))} de las sesiones que empezaron en una guía`} />
          <Stat label="Llegaron desde asistentes de IA" value={fmtN(k.ai)} hint={`${fmtN(k.ai_site)} ${k.ai_site === 1 ? "persona" : "personas"} desde IA en todo el sitio`} />
          <Stat label="Siguieron a la app" value={fmtPct(appPct)} hint={`${fmtN(k.app)} de ${fmtN(k.entries)} sesiones salieron del blog o guardaron un evento`} />
        </div>

        <Card
          title={topPost ? `“${title(topPost.path)}” es la guía más leída (${fmtN(topPost.visitors)} ${topPost.visitors === 1 ? "persona" : "personas"})` : "Personas por día en el blog"}
          subtitle="Visitantes del blog y sesiones que empezaron en una guía, por día · la línea punteada es el promedio diario"
        >
          <LineChart average days={b.daily} series={[{ key: "visitors", label: "Visitantes del blog" }, { key: "entries", label: "Entraron por una guía" }]} />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={finding(sourceRows, (l, p) => `${l} trae el ${p} de quienes entran por una guía`, "Cómo llegan a las guías")} subtitle="Fuente de las sesiones que empezaron en una guía">
            <BarList showPct focus="top" rows={sourceRows} />
          </Card>
          <Card title={k.entries ? `El ${fmtPct(appPct)} de quien entra por una guía sigue a la app` : "De la guía a la app"} subtitle="Sesiones que empezaron en una guía · % respecto al paso anterior">
            <Funnel steps={[
              { label: "Entraron por una guía", value: k.entries },
              { label: "Siguieron a la app", value: k.app },
              { label: "Tomaron acción", value: k.acted },
            ]} />
            <p className="mt-4 border-t border-line pt-3 text-[12px] text-ink-2">
              De quienes siguieron a la app, <b className="text-ink">{fmtPct(pct(k.saw_event, k.app))}</b> abrió la página de un evento o una experiencia.
            </p>
          </Card>
        </div>

        <Card title="Guías" subtitle="Vistas y personas en el rango · las columnas de entradas cuentan sesiones que empezaron en esa guía">
          {b.posts.length ? (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead className="text-left text-[12px] text-ink-2">
                  <tr>
                    <th className="px-5 py-2 font-medium">Guía</th>
                    <th className="px-3 py-2 text-right font-medium">Vistas</th>
                    <th className="px-3 py-2 text-right font-medium">Personas</th>
                    <th className="px-3 py-2 text-right font-medium">Entradas</th>
                    <th className="px-3 py-2 text-right font-medium">Buscadores</th>
                    <th className="px-3 py-2 text-right font-medium">IA</th>
                    <th className="px-5 py-2 text-right font-medium">Siguieron a la app</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {b.posts.map((p) => (
                    <tr key={p.path}>
                      <td className="max-w-[360px] truncate px-5 py-2.5 font-medium">
                        <a href={p.path} target="_blank" rel="noreferrer" className="hover:underline" title={p.path}>{title(p.path)}</a>
                      </td>
                      <td className="px-3 py-2.5 text-right">{fmtN(p.views)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(p.visitors)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(p.entries)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(p.search)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(p.ai)}</td>
                      <td className="px-5 py-2.5 text-right">{p.entries ? fmtPct(pct(p.app, p.entries)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty />}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={finding(aiHostRows, (l, p) => `${l} trae el ${p} de las visitas desde IA`, "Asistentes de IA que nos recomiendan")} subtitle="Personas que llegaron desde un asistente de IA, en todo el sitio">
            <BarList showPct focus="top" rows={aiHostRows} />
          </Card>
          <Card title={aiPathLead && !aiPathLead.tied ? `La IA manda más gente a “${aiPathLead.row.label}”` : "Páginas a las que llegan desde IA"} subtitle="Primera página de quienes llegaron desde un asistente de IA">
            <BarList wideLabels focus="top" rows={aiPathRows} />
          </Card>
        </div>

        <p className="text-[12px] text-ink-2">
          Qué escribió la gente en Google, impresiones y posición promedio no llegan al sitio: están en{" "}
          <a href="https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fentrelugar.es%2F" target="_blank" rel="noreferrer" className="font-medium text-ink underline">Search Console → Rendimiento</a>.
        </p>
      </div>
    </div>
  );
}
