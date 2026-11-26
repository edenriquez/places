import Link from "next/link";
import clsx from "clsx";
import { Card, Empty, fmtN, fmtPct, Stat } from "@/components/charts/charts";
import { regionLabel, SOURCE_LABEL } from "@/lib/analytics";
import { STEP_LABEL } from "@/lib/journey";
import { createClient } from "@/lib/supabase/server";
import { MetricsTabs } from "../tabs";

export const metadata = { title: "Usuarios nuevos · Métricas · Admin" };

/** Forma del jsonb de public.admin_new_visitors. */
type Visitor = {
  visitor_id: string; first_ts: string; source: string; entry: string; city: string | null; region: string | null;
  device: "mobile" | "desktop" | null; sessions: number; pages: number; actions: number; clicks: number;
  last_action: string | null; last_ts: string | null; signed_up: boolean;
};

const RANGES = [["1", "Hoy"], ["7", "7 días"], ["30", "30 días"]] as const;
const when = (s: string) => new Date(s).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

export default async function NewVisitorsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.some(([k]) => k === sp.r) ? sp.r! : "7";
  const to = new Date();
  const from = new Date(to.getTime() - (Number(range) - 1) * 86400000);
  from.setHours(0, 0, 0, 0);
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_new_visitors", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw new Error(error.message);
  const rows = data as Visitor[];

  const acted = rows.filter((r) => r.actions > 0).length;
  const returned = rows.filter((r) => r.sessions > 1).length;
  const signed = rows.filter((r) => r.signed_up).length;

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Métricas</h1>
          <p className="mt-1 text-[14px] text-ink-2">Cada persona que entró por primera vez y qué hizo. Toca una fila para ver su recorrido completo.</p>
        </div>
        <nav className="flex gap-2 text-[13px]">
          {RANGES.map(([key, l]) => (
            <Link key={key} href={`?r=${key}`} className={clsx("rounded-full border px-3 py-1.5 font-medium", range === key ? "border-ink bg-ink text-on-ink" : "border-line-2 hover:border-ink")}>{l}</Link>
          ))}
        </nav>
      </div>
      <MetricsTabs active="usuarios" range={range} />

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat hero label="Visitantes nuevos" value={fmtN(rows.length)} hint={rows.length >= 300 ? "Se muestran los 300 más recientes" : undefined} />
          <Stat label="Hicieron algo" value={fmtPct(pct(acted, rows.length))} hint={`${fmtN(acted)} guardaron, contactaron, filtraron…`} />
          <Stat label="Volvieron" value={fmtPct(pct(returned, rows.length))} hint={`${fmtN(returned)} con más de una sesión`} />
          <Stat label="Crearon cuenta" value={fmtPct(pct(signed, rows.length))} hint={`${fmtN(signed)} ${signed === 1 ? "persona" : "personas"}`} />
        </div>

        <Card title="Visitantes nuevos" subtitle="Del más reciente al más antiguo · las cifras cuentan todo lo que han hecho desde que llegaron">
          {rows.length === 0 ? <Empty /> : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead className="text-left text-[12px] text-ink-2">
                  <tr className="border-b border-line">
                    <th className="px-5 py-2 font-medium">Llegó</th>
                    <th className="py-2 font-medium">Desde</th>
                    <th className="py-2 font-medium">Dónde</th>
                    <th className="py-2 font-medium">Entró a</th>
                    <th className="py-2 text-right font-medium">Sesiones</th>
                    <th className="py-2 text-right font-medium">Páginas</th>
                    <th className="py-2 text-right font-medium">Acciones</th>
                    <th className="py-2 text-right font-medium">Clics</th>
                    <th className="px-5 py-2 font-medium">Última acción</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.visitor_id} className="group relative border-b border-line last:border-0 hover:bg-bg">
                      <td className="whitespace-nowrap px-5 py-2.5">
                        <Link href={`/admin/metricas/usuarios/${r.visitor_id}?r=${range}`} className="font-medium after:absolute after:inset-0">{when(r.first_ts)}</Link>
                        {r.signed_up && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">cuenta</span>}
                      </td>
                      <td className="py-2.5">{SOURCE_LABEL[r.source] ?? r.source} · <span className="text-ink-2">{r.device === "mobile" ? "cel" : "compu"}</span></td>
                      <td className="py-2.5 text-ink-2">{r.city ?? regionLabel(r.region)}</td>
                      <td className="max-w-[200px] truncate py-2.5 text-ink-2" title={r.entry}>{r.entry}</td>
                      <td className="py-2.5 text-right tabular-nums">{fmtN(r.sessions)}</td>
                      <td className="py-2.5 text-right tabular-nums">{fmtN(r.pages)}</td>
                      <td className={clsx("py-2.5 text-right tabular-nums", r.actions === 0 && "text-ink-3")}>{fmtN(r.actions)}</td>
                      <td className="py-2.5 text-right tabular-nums">{fmtN(r.clicks)}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-ink-2">{r.last_action ? STEP_LABEL[r.last_action] ?? r.last_action : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
