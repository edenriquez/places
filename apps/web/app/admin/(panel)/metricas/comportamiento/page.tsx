import Link from "next/link";
import clsx from "clsx";
import { BarList, Card, Empty, fmtN, fmtPct, Heatmap, Stat } from "@/components/charts/charts";
import { ACTION_LABEL, regionLabel } from "@/lib/analytics";
import { EXPERIENCE_KINDS } from "@/lib/experiences";
import { INTENTS } from "@/lib/intents";
import { createClient } from "@/lib/supabase/server";
import { MetricsTabs } from "../tabs";

export const metadata = { title: "Comportamiento · Métricas · Admin" };

/** Forma del jsonb de public.admin_behavior. */
type Behavior = {
  kpi: {
    visitors: number; explorers: number; pickers: number; empty_visitors: number; sessions: number;
    pages_median: number | null; duration_median_s: number | null; bounce: number; acted_sessions: number; out_visitors: number;
  };
  intents: { intent: string; n: number }[];
  intent_by_region: { region: string; total: number; intent: string; n: number }[];
  periods: { key: string; n: number }[];
  any_day: number;
  experience_kinds: { kind: string; n: number }[];
  supply_categories: { category: string; n: number }[];
  zones: { name: string; state: string; searchers: number; events: number; empty: number }[];
  empty_intents: { intent: string; tab: string; n: number }[];
  empty_zones: { label: string; state: string; intent: string; n: number }[];
  out_cities: { city: string; region: string | null; n: number }[];
  out_points: { lat: number; lng: number; n: number }[];
  lead_time: { bucket: number; n: number }[];
  entries: { entry: string; sessions: number; acted: number }[];
  frequency: { bucket: number; n: number }[];
  actions: { type: string; n: number; visitors: number }[];
  heatmap: { dow: number; hour: number; n: number }[];
};

const RANGES = [["7", "7 días"], ["30", "30 días"], ["90", "90 días"]] as const;
const PERIOD_LABEL: Record<string, string> = {
  ahora: "Ahora mismo", finde: "Este finde", "15d": "Próximos 15 días", todo: "Todo lo que viene", pronto: "Próximamente", dia: "Cualquier día",
};
const ENTRY_LABEL: Record<string, string> = {
  explorar: "Portada (Explorar)", mapa: "Mapa", evento: "Página de un evento", experiencia: "Página de una experiencia",
  municipio: "Página de un municipio", plan: "Plan compartido", mis_planes: "Mis planes", perfil: "Perfil", publicar: "Publicar", otra: "Otra",
};
const LEAD_LABEL = ["El mismo día o ya empezó", "1–2 días antes", "3–7 días antes", "1–4 semanas antes", "Más de un mes antes"];
const FREQ_LABEL = ["1 día", "2–3 días", "4–7 días", "8 días o más"];
const MORE_ACTIONS: Record<string, string> = {
  plan_create: "Armaron un plan", plan_join: "Se unieron a un plan", plan_invite: "Invitaron a un plan", flyer_zoom: "Ampliaron el flyer",
};
const intentLabel = (k: string) => INTENTS.find((i) => i.key === k)?.label ?? (k === "todo" ? "Sin intención" : k);
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

export default async function BehaviorPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.some(([k]) => k === sp.r) ? sp.r! : "30";
  const to = new Date();
  const from = new Date(to.getTime() - Number(range) * 86400000);
  from.setHours(0, 0, 0, 0);
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_behavior", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw new Error(error.message);
  const b = data as Behavior;
  const k = b.kpi;

  // demanda (personas que eligen la intención) contra oferta (eventos de sus categorías en 30 días)
  const supplyByCat = new Map(b.supply_categories.map((s) => [s.category, s.n]));
  const supplyTotal = b.supply_categories.reduce((a, s) => a + s.n, 0);
  const demandTotal = b.intents.reduce((a, s) => a + s.n, 0);
  const emptyBy = (key: string) => b.empty_intents.filter((x) => x.intent === key).reduce((a, x) => a + x.n, 0);
  const gaps = INTENTS.map((it) => {
    const demand = b.intents.find((x) => x.intent === it.key)?.n ?? 0;
    const supply = it.cats.reduce((a, c) => a + (supplyByCat.get(c) ?? 0), 0);
    const dShare = pct(demand, demandTotal);
    const sShare = pct(supply, supplyTotal);
    const gap = demand > 0 && (supply === 0 || dShare >= sShare * 1.5);
    return { key: it.key, label: it.label, demand, supply, dShare, sShare, empty: emptyBy(it.key), gap };
  }).sort((x, y) => y.demand - x.demand || y.supply - x.supply);

  const worstGap = gaps.find((g) => g.gap);
  const thinZone = b.zones.find((z) => z.events < 5);
  const topOut = b.out_cities[0];
  const eventEntry = b.entries.find((e) => e.entry === "evento")?.sessions ?? 0;

  const regions = [...new Map(b.intent_by_region.map((r) => [r.region, r.total])).entries()].sort((x, y) => y[1] - x[1]);
  const cell = (region: string, intent: string) => b.intent_by_region.find((r) => r.region === region && r.intent === intent)?.n ?? 0;

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Métricas</h1>
          <p className="mt-1 text-[14px] text-ink-2">Qué busca la gente, dónde, si ahí hay oferta y cómo planea. Para decidir a dónde crecer.</p>
        </div>
        <nav className="flex gap-2 text-[13px]">
          {RANGES.map(([key, l]) => (
            <Link key={key} href={`?r=${key}`} className={clsx("rounded-full border px-3 py-1.5 font-medium", range === key ? "border-ink bg-ink text-white" : "border-line-2 hover:border-ink")}>{l}</Link>
          ))}
        </nav>
      </div>
      <MetricsTabs active="comportamiento" range={range} />

      <div className="mt-5 space-y-4">
        {/* lo accionable en una frase */}
        <section className="rounded-card bg-ink p-5 text-white">
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-white/60">Lectura</p>
          <p className="mt-2 text-[17px] leading-relaxed">
            {worstGap
              ? <>Falta oferta de <b>{worstGap.label.toLowerCase()}</b>: la elige el <b>{fmtPct(worstGap.dShare)}</b> de quien escoge una intención y es el <b>{fmtPct(worstGap.sShare)}</b> de los eventos próximos.</>
              : <>La oferta de los próximos 30 días acompaña lo que la gente elige.</>}
            {thinZone && <> La zona buscada con menos oferta es <b>{thinZone.name}</b> ({fmtN(thinZone.searchers)} {thinZone.searchers === 1 ? "persona" : "personas"}, {fmtN(thinZone.events)} {thinZone.events === 1 ? "evento" : "eventos"} a 30 km).</>}
            {topOut && <> Fuera de cobertura, la ciudad con más visitantes es <b>{topOut.city}</b>.</>}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat hero label="Eligen qué quieren hacer" value={fmtPct(pct(k.pickers, k.explorers))} hint={`${fmtN(k.pickers)} de ${fmtN(k.explorers)} en Explorar o Mapa`} />
          <Stat label="Vieron un resultado vacío" value={fmtN(k.empty_visitors)} hint="Eligieron algo y en su zona no había nada" />
          <Stat label="Sesiones con acción" value={fmtPct(pct(k.acted_sessions, k.sessions))} hint={`${fmtN(k.acted_sessions)} de ${fmtN(k.sessions)} sesiones`} />
          <Stat label="Visitantes fuera de cobertura" value={fmtN(k.out_visitors)} hint={`${fmtPct(pct(k.out_visitors, k.visitors))} viven a más de 20 km de un pueblo cargado`} />
        </div>

        <Card title="Demanda contra oferta por intención" subtitle="Personas que eligieron la intención en el rango · eventos de sus categorías en los próximos 30 días">
          {demandTotal || supplyTotal ? (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead className="text-left text-[12px] text-ink-2">
                  <tr>
                    <th className="px-5 py-2 font-medium">Intención</th>
                    <th className="px-3 py-2 text-right font-medium">Personas</th>
                    <th className="px-3 py-2 text-right font-medium">% demanda</th>
                    <th className="px-3 py-2 text-right font-medium">Eventos</th>
                    <th className="px-3 py-2 text-right font-medium">% oferta</th>
                    <th className="px-3 py-2 text-right font-medium">Vieron vacío</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {gaps.map((g) => (
                    <tr key={g.key}>
                      <td className="px-5 py-2.5 font-medium">{g.label}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(g.demand)}</td>
                      <td className="px-3 py-2.5 text-right text-ink-2">{fmtPct(g.dShare)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(g.supply)}</td>
                      <td className="px-3 py-2.5 text-right text-ink-2">{fmtPct(g.sShare)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(g.empty)}</td>
                      <td className="px-5 py-2.5 text-right">{g.gap && <Pill tone="warn">Falta oferta</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-5 pt-3 text-[12px] text-ink-3">“Falta oferta”: nadie publica de eso o su parte de la demanda es al menos 1.5 veces su parte de la oferta. Un taller cuenta en Familia y en Cultura.</p>
            </div>
          ) : <Empty />}
        </Card>

        <Card title="Zonas buscadas y su oferta" subtitle="Municipio elegido en el buscador (o el más cercano al GPS) · eventos a 30 km en los próximos 30 días">
          {b.zones.length ? (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead className="text-left text-[12px] text-ink-2">
                  <tr>
                    <th className="px-5 py-2 font-medium">Zona</th>
                    <th className="px-3 py-2 text-right font-medium">Personas</th>
                    <th className="px-3 py-2 text-right font-medium">Eventos</th>
                    <th className="px-3 py-2 text-right font-medium">Vieron vacío</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {b.zones.map((z) => (
                    <tr key={`${z.name}-${z.state}`}>
                      <td className="px-5 py-2.5"><span className="font-medium">{z.name}</span> <span className="text-[12px] text-ink-3">{z.state}</span></td>
                      <td className="px-3 py-2.5 text-right">{fmtN(z.searchers)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(z.events)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(z.empty)}</td>
                      <td className="px-5 py-2.5 text-right">
                        {z.events === 0 ? <Pill tone="bad">Sin oferta</Pill> : z.events < 5 ? <Pill tone="warn">Poca oferta</Pill> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty />}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Qué buscaron y no encontraron" subtitle="Zona e intención de quien vio un resultado vacío">
            <BarList wideLabels rows={b.empty_zones.map((z) => ({ label: `${z.label} · ${intentLabel(z.intent)}`, sub: z.state, value: z.n }))} />
          </Card>
          <Card title="Fuera de cobertura" subtitle="Ciudad de visitantes a más de 20 km de cualquier pueblo cargado">
            <BarList rows={b.out_cities.map((c) => ({ label: c.city, sub: regionLabel(c.region), value: c.n }))} />
            {b.out_points.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-[12px] font-medium text-ink-2">Búsquedas por GPS sin pueblo cerca (punto aproximado, ~10 km)</p>
                <ul className="mt-2 space-y-1 text-[13px] tabular-nums">
                  {b.out_points.map((p) => (
                    <li key={`${p.lat},${p.lng}`} className="flex justify-between gap-3">
                      <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer" className="underline">{p.lat}, {p.lng}</a>
                      <span className="text-ink-2">{fmtN(p.n)} {p.n === 1 ? "persona" : "personas"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        <Card title="Qué eligen según de dónde vienen" subtitle="% de quienes eligieron una intención en cada estado de origen (una persona puede elegir varias)">
          {regions.length ? (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead className="text-left text-[12px] text-ink-2">
                  <tr>
                    <th className="px-5 py-2 font-medium">Origen</th>
                    {INTENTS.map((it) => <th key={it.key} className="px-3 py-2 text-right font-medium">{it.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {regions.map(([region, total]) => {
                    const max = Math.max(...INTENTS.map((it) => cell(region, it.key)));
                    return (
                      <tr key={region}>
                        <td className="px-5 py-2.5"><span className="font-medium">{regionLabel(region === "?" ? null : region)}</span> <span className="text-[12px] text-ink-3">{fmtN(total)}</span></td>
                        {INTENTS.map((it) => {
                          const n = cell(region, it.key);
                          return <td key={it.key} className={clsx("px-3 py-2.5 text-right", n && n === max ? "font-semibold text-ink" : "text-ink-2")}>{n ? fmtPct(pct(n, total)) : "–"}</td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty />}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Intenciones elegidas" subtitle="Personas que tocaron cada una">
            <BarList showPct rows={b.intents.map((x) => ({ label: intentLabel(x.intent), value: x.n }))} />
          </Card>
          <Card title="Para cuándo buscan" subtitle={`Periodo elegido · ${fmtN(b.any_day)} ${b.any_day === 1 ? "abrió" : "abrieron"} “Cualquier día”`}>
            <BarList showPct rows={b.periods.map((x) => ({ label: PERIOD_LABEL[x.key] ?? x.key, value: x.n }))} />
          </Card>
          <Card title="Con cuánta anticipación planean" subtitle="Guardar, me interesa, armar plan o compartir, respecto al inicio del evento">
            <BarList wideLabels showPct rows={b.lead_time.map((x) => ({ label: LEAD_LABEL[x.bucket], value: x.n }))} />
          </Card>
          <Card title="Tipos de experiencia" subtitle="Personas que filtraron por cada tipo en Cualquier día">
            <BarList rows={b.experience_kinds.map((x) => ({ label: EXPERIENCE_KINDS[x.kind as keyof typeof EXPERIENCE_KINDS]?.label ?? x.kind, value: x.n }))} />
          </Card>
        </div>

        <Card title="Cuándo entran" subtitle="Inicio de sesión por día y hora (centro de México)">
          <Heatmap cells={b.heatmap} unit="sesiones" />
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Sesiones" value={fmtN(k.sessions)} hint={`${fmtPct(pct(k.bounce, k.sessions))} se van tras una página sin hacer nada`} />
          <Stat label="Páginas por sesión" value={k.pages_median == null ? "–" : String(Math.round(k.pages_median * 10) / 10)} hint="Mediana" />
          <Stat label="Duración de sesión" value={fmtDuration(k.duration_median_s)} hint="Mediana, sesiones de 2+ páginas" />
          <Stat label="Entran directo a un evento" value={fmtPct(pct(eventEntry, k.sessions))} hint="Casi siempre desde un link compartido" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Puerta de entrada" subtitle="Primera página de la sesión · % de esas sesiones con una acción">
            {b.entries.length ? (
              <ul className="space-y-2 text-[14px] tabular-nums">
                {b.entries.map((x) => (
                  <li key={x.entry} className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{ENTRY_LABEL[x.entry] ?? x.entry}</span>
                    <span className="text-ink-2">{fmtN(x.sessions)} <span className="text-ink-3">· {fmtPct(pct(x.acted, x.sessions))} con acción</span></span>
                  </li>
                ))}
              </ul>
            ) : <Empty />}
          </Card>
          <Card title="Cuántos días vuelven" subtitle="Días distintos con visita en el rango, por persona">
            <BarList showPct rows={b.frequency.map((x) => ({ label: FREQ_LABEL[x.bucket], value: x.n }))} />
          </Card>
        </div>

        <Card title="Qué hacen con un evento" subtitle="Personas distintas por acción">
          <BarList wideLabels rows={b.actions.map((x) => ({ label: ACTION_LABEL[x.type] ?? MORE_ACTIONS[x.type] ?? x.type, sub: `${fmtN(x.n)} veces`, value: x.visitors }))} />
        </Card>
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: "warn" | "bad"; children: React.ReactNode }) {
  return (
    <span className={clsx("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", tone === "bad" ? "bg-[#fdecea] text-[#c13515]" : "bg-[#fff4e0] text-[#8a5300]")}>
      {children}
    </span>
  );
}

function fmtDuration(s: number | null) {
  if (s == null) return "–";
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${Math.round(s % 60)} s` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
