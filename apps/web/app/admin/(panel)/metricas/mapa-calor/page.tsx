import Link from "next/link";
import clsx from "clsx";
import { BarList, Card, Empty, fmtN } from "@/components/charts/charts";
import { targetLabel } from "@/lib/journey";
import { createClient } from "@/lib/supabase/server";
import { MetricsTabs } from "../tabs";
import { HeatOverlay } from "./heat-overlay";

export const metadata = { title: "Mapa de calor · Métricas · Admin" };

/** Forma del jsonb de public.admin_heatmap. points: [x en % del ancho, y en px, clics]. */
type Heat = {
  pages: { path: string; n: number; visitors: number }[];
  path: string | null; total: number; vw: number | null;
  points: [number, number, number][];
  targets: { target: string; n: number; visitors: number }[];
};

const RANGES = [["7", "7 días"], ["30", "30 días"], ["90", "90 días"]] as const;
const DEVICES = [["mobile", "Celular"], ["desktop", "Computadora"]] as const;

export default async function HeatmapPage({ searchParams }: { searchParams: Promise<{ r?: string; d?: string; p?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.some(([k]) => k === sp.r) ? sp.r! : "30";
  const device = sp.d === "desktop" ? "desktop" : "mobile";
  const reqPath = sp.p?.startsWith("/") ? sp.p : null;
  const to = new Date();
  const from = new Date(to.getTime() - Number(range) * 86400000);
  from.setHours(0, 0, 0, 0);
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_heatmap", { p_from: from.toISOString(), p_to: to.toISOString(), p_device: device, p_path: reqPath });
  if (error) throw new Error(error.message);
  const h = data as Heat;
  const path = h.path ?? reqPath;
  // ancho al que se pinta la página: el más común entre quienes tocaron, acotado a tamaños reales
  const width = device === "mobile" ? Math.min(430, Math.max(360, h.vw ?? 390)) : Math.min(1440, Math.max(1024, h.vw ?? 1280));
  const q = (o: Record<string, string | null>) => "?" + new URLSearchParams(Object.entries({ r: range, d: device, p: path, ...o }).filter((e): e is [string, string] => !!e[1])).toString();
  const pill = (on: boolean) => clsx("rounded-full border px-3 py-1.5 font-medium", on ? "border-ink bg-ink text-on-ink" : "border-line-2 hover:border-ink");

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Métricas</h1>
          <p className="mt-1 text-[14px] text-ink-2">Dónde toca la gente en cada página, pintado sobre la página como se ve hoy.</p>
        </div>
        <nav className="flex gap-2 text-[13px]">
          {RANGES.map(([key, l]) => <Link key={key} href={q({ r: key })} className={pill(range === key)}>{l}</Link>)}
        </nav>
      </div>
      <MetricsTabs active="calor" range={range} />

      <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <nav className="flex gap-2 text-[13px]">
            {DEVICES.map(([key, l]) => <Link key={key} href={q({ d: key, p: null })} className={pill(device === key)}>{l}</Link>)}
          </nav>
          <Card title="Páginas" subtitle="Con más clics en el rango">
            {h.pages.length === 0 ? <Empty /> : (
              <ul className="-mx-2 space-y-0.5 text-[13px]">
                {h.pages.map((p) => (
                  <li key={p.path}>
                    <Link href={q({ p: p.path })} className={clsx("flex justify-between gap-2 rounded-lg px-2 py-1.5", p.path === path ? "bg-ink text-on-ink" : "hover:bg-bg")}>
                      <span className="truncate" title={p.path}>{p.path}</span>
                      <span className="shrink-0 tabular-nums opacity-70">{fmtN(p.n)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {h.targets.length > 0 && (
            <Card title={`Lo más tocado en ${path}`} subtitle="Clics por elemento">
              <BarList wideLabels focus="top" rows={h.targets.map((t) => ({ label: targetLabel(t.target), sub: `${fmtN(t.visitors)} pers.`, value: t.n }))} />
            </Card>
          )}
        </div>

        <Card title={path ? `${fmtN(h.total)} clics en ${path}` : "Mapa de calor"} subtitle={`Vista de ${device === "mobile" ? "celular" : "computadora"} a ${width} px · el contenido puede haber cambiado desde los clics`}>
          {path && h.total > 0 ? <HeatOverlay key={`${path}-${device}`} path={path} width={width} points={h.points} /> : <Empty>Aún no hay clics en este rango. Se empiezan a juntar desde hoy.</Empty>}
        </Card>
      </div>
    </div>
  );
}
