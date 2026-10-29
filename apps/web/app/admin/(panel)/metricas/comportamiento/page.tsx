import Link from "next/link";
import clsx from "clsx";
import { BarList, Card, Empty, fmtN, fmtPct, Heatmap, heatPeak, MUTED, PairedBars, seqStep, SERIES, Stat, finding } from "@/components/charts/charts";
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
  municipio: "Página de un municipio", plan: "Plan compartido", mis_planes: "Mis planes", perfil: "Perfil", publicar: "Publicar", blog: "Blog (una guía)", otra: "Otra",
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

  // títulos que dicen el hallazgo; sin datos, el nombre de la métrica
  const emptyRows = b.empty_zones.map((z) => ({ label: `${z.label} · ${intentLabel(z.intent)}`, sub: z.state, value: z.n }));
  const outRows = b.out_cities.map((c) => ({ label: c.city, sub: regionLabel(c.region), value: c.n }));
  const intentRows = b.intents.map((x) => ({ label: intentLabel(x.intent), value: x.n }));
  const periodRows = b.periods.map((x) => ({ label: PERIOD_LABEL[x.key] ?? x.key, value: x.n }));
  const leadRows = b.lead_time.map((x) => ({ label: LEAD_LABEL[x.bucket], value: x.n }));
  const kindRows = b.experience_kinds.map((x) => ({ label: EXPERIENCE_KINDS[x.kind as keyof typeof EXPERIENCE_KINDS]?.label ?? x.kind, value: x.n }));
  const freqRows = b.frequency.map((x) => ({ label: FREQ_LABEL[x.bucket], value: x.n }));
  const actionRows = b.actions.map((x) => ({ label: ACTION_LABEL[x.type] ?? MORE_ACTIONS[x.type] ?? x.type, sub: `${fmtN(x.n)} veces`, value: x.visitors }));
  const entryRows = b.entries.map((x) => ({ label: ENTRY_LABEL[x.entry] ?? x.entry, value: x.sessions }));
  const heat = heatPeak(b.heatmap);
  const oneDay = b.frequency.find((x) => x.bucket === 0)?.n ?? 0;
  const freqTotal = b.frequency.reduce((a, x) => a + x.n, 0);

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
            <Link key={key} href={`?r=${key}`} className={clsx("rounded-full border px-3 py-1.5 font-medium", range === key ? "border-ink bg-ink text-on-ink" : "border-line-2 hover:border-ink")}>{l}</Link>
          ))}
        </nav>
      </div>
      <MetricsTabs active="comportamiento" range={range} />

      <div className="mt-5 space-y-4">
        {/* lo accionable en una frase */}
        <section className="rounded-card bg-ink p-5 text-on-ink">
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-on-ink/60">Lectura</p>
          <p className="mt-2 text-[17px] leading-relaxed">
            {worstGap
              ? <>Falta oferta de <b>{worstGap.label.toLowerCase()}</b>: la elige el <b>{fmtPct(worstGap.dShare)}</b> de quien escoge una intención y es el <b>{fmtPct(worstGap.sShare)}</b> de los eventos próximos.</>
              : demandTotal ? <>La oferta de los próximos 30 días acompaña lo que la gente elige.</> : <>Todavía nadie ha elegido una intención en este rango.</>}
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

        <Card
          title={worstGap ? `Falta oferta de ${worstGap.label.toLowerCase()}: ${fmtPct(worstGap.dShare)} de la demanda y ${fmtPct(worstGap.sShare)} de los eventos` : demandTotal ? "La oferta acompaña lo que la gente elige" : "Demanda contra oferta por intención"}
          subtitle="% de quienes eligieron cada intención en el rango contra % de los eventos de sus categorías en los próximos 30 días"
        >
          <PairedBars
            unit="%"
            series={["Demanda", "Oferta"]}
            rows={gaps.map((g) => ({ label: g.label, a: g.dShare, b: g.sShare, note: `${fmtN(g.demand)} ${g.demand === 1 ? "persona" : "personas"} · ${fmtN(g.supply)} ${g.supply === 1 ? "evento" : "eventos"}${g.empty ? ` · ${fmtN(g.empty)} vieron vacío` : ""}` }))}
            flag={(r) => (r.a > 0 && (r.b === 0 || r.a >= r.b * 1.5) ? "Falta oferta" : null)}
          />
          <p className="mt-4 border-t border-line pt-3 text-[12px] text-ink-3">“Falta oferta”: nadie publica de eso o su parte de la demanda es al menos 1.5 veces su parte de la oferta. Un taller cuenta en Familia y en Cultura.</p>
        </Card>

        <Card
          title={thinZone ? `${thinZone.name} se busca mucho y tiene ${thinZone.events ? `solo ${fmtN(thinZone.events)} ${thinZone.events === 1 ? "evento" : "eventos"}` : "cero eventos"} a 30 km` : b.zones.length ? "Las zonas más buscadas tienen oferta cerca" : "Zonas buscadas y su oferta"}
          subtitle="Personas por municipio elegido en el buscador (o el más cercano al GPS) · eventos a 30 km en los próximos 30 días"
        >
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
                      <td className="px-3 py-2.5 text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          <span aria-hidden className="h-2 rounded-r-[3px]" style={{ width: `${Math.max(2, (z.searchers / Math.max(...b.zones.map((x) => x.searchers), 1)) * 56)}px`, background: z === thinZone ? SERIES[0] : MUTED }} />
                          {fmtN(z.searchers)}
                        </span>
                      </td>
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
          <Card title={finding(emptyRows, (l, _p, r) => `${l}: ${fmtN(r.value)} ${r.value === 1 ? "persona buscó" : "personas buscaron"} y no encontró nada`, "Qué buscaron y no encontraron")} subtitle="Personas que vieron un resultado vacío, por zona e intención">
            <BarList wideLabels focus="top" rows={emptyRows} />
          </Card>
          <Card title={finding(outRows, (l, p) => `${l} es el ${p} del público fuera de cobertura`, "Fuera de cobertura")} subtitle="Visitantes a más de 20 km de cualquier pueblo cargado, por ciudad">
            <BarList focus="top" rows={outRows} />
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

        <Card
          title={regions.length ? (() => {
            const [r0] = regions[0];
            const best = INTENTS.map((it) => ({ it, n: cell(r0, it.key) })).sort((x, y) => y.n - x.n)[0];
            return `Quien viene de ${regionLabel(r0 === "?" ? null : r0)} elige sobre todo ${best.it.label.toLowerCase()} (${fmtPct(pct(best.n, regions[0][1]))})`;
          })() : "Qué eligen según de dónde vienen"}
          subtitle="% de quienes eligieron una intención en cada estado de origen; más oscuro = más elegido en esa fila (una persona puede elegir varias)"
        >
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
                          const tone = seqStep(n, max);
                          return (
                            <td key={it.key} className="px-1 py-1 text-right">
                              <span className={clsx("block rounded-[4px] px-2 py-1.5", n && n === max ? "font-semibold" : "", tone.dark ? "text-white" : n ? "text-[#222]" : "text-ink-3")} style={{ background: tone.bg }} title={`${regionLabel(region === "?" ? null : region)} · ${it.label}: ${fmtN(n)} de ${fmtN(total)}`}>
                                {n ? fmtPct(pct(n, total)) : "–"}
                              </span>
                            </td>
                          );
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
          <Card title={finding(intentRows, (l, p) => `${l} es la intención más elegida (${p})`, "Intenciones elegidas")} subtitle="Personas que tocaron cada intención">
            <BarList showPct focus="top" rows={intentRows} />
          </Card>
          <Card title={finding(periodRows, (l, p) => `El ${p} busca “${l.toLowerCase()}”`, "Para cuándo buscan")} subtitle={`Personas por periodo elegido · ${fmtN(b.any_day)} ${b.any_day === 1 ? "abrió" : "abrieron"} “Cualquier día”`}>
            <BarList showPct focus="top" rows={periodRows} />
          </Card>
          <Card title={finding(leadRows, (l, p) => `El ${p} de los planes se hace ${l.toLowerCase().replace("el mismo día o ya empezó", "el mismo día")}`, "Con cuánta anticipación planean")} subtitle="Guardar, me interesa, armar plan o compartir, respecto al inicio del evento">
            <BarList wideLabels showPct focus="top" rows={leadRows} />
          </Card>
          <Card title={finding(kindRows, (l, _p, r) => `${l} es el tipo de experiencia más buscado (${fmtN(r.value)})`, "Tipos de experiencia")} subtitle="Personas que filtraron por cada tipo en Cualquier día">
            <BarList focus="top" rows={kindRows} />
          </Card>
        </div>

        <Card
          title={heat ? `Entran sobre todo el ${heat.day} a las ${heat.hour}:00; el ${fmtPct(heat.weekendPct)} de viernes a domingo` : "Cuándo entran"}
          subtitle="Inicio de sesión por día y hora (centro de México)"
        >
          <Heatmap cells={b.heatmap} unit="sesiones" />
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Sesiones" value={fmtN(k.sessions)} hint={`${fmtPct(pct(k.bounce, k.sessions))} se van tras una página sin hacer nada`} />
          <Stat label="Páginas por sesión" value={k.pages_median == null ? "–" : String(Math.round(k.pages_median * 10) / 10)} hint="Mediana" />
          <Stat label="Duración de sesión" value={fmtDuration(k.duration_median_s)} hint="Mediana, sesiones de 2+ páginas" />
          <Stat label="Entran directo a un evento" value={fmtPct(pct(eventEntry, k.sessions))} hint="Casi siempre desde un link compartido" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={finding(entryRows, (l, p) => `El ${p} de las sesiones empieza en ${l.toLowerCase()}`, "Puerta de entrada")} subtitle="Sesiones por primera página · el % junto al nombre es la parte de esas sesiones que hizo algo">
            <BarList wideLabels showPct focus="top" rows={b.entries.map((x) => ({ label: ENTRY_LABEL[x.entry] ?? x.entry, sub: fmtPct(pct(x.acted, x.sessions)), value: x.sessions }))} />
          </Card>
          <Card title={freqTotal ? `El ${fmtPct(pct(oneDay, freqTotal))} viene un solo día; ${fmtPct(pct(freqTotal - oneDay, freqTotal))} vuelve` : "Cuántos días vuelven"} subtitle="Personas por días distintos con visita en el rango">
            <BarList showPct focus={FREQ_LABEL[0]} rows={freqRows} />
          </Card>
        </div>

        <Card title={finding(actionRows, (l, _p, r) => `${l} es lo que más hace la gente con un evento (${fmtN(r.value)} ${r.value === 1 ? "persona" : "personas"})`, "Qué hacen con un evento")} subtitle="Personas distintas por acción">
          <BarList wideLabels focus="top" rows={actionRows} />
        </Card>
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: "warn" | "bad"; children: React.ReactNode }) {
  return (
    <span className={clsx("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", tone === "bad" ? "bg-error-bg text-error" : "bg-warn-bg text-warn-ink")}>
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
