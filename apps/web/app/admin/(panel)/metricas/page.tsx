import Link from "next/link";
import clsx from "clsx";
import { BarList, Card, Empty, fmtN, fmtPct, Funnel, LineChart, SplitBar, Stat, finding } from "@/components/charts/charts";
import { COMPANIONS } from "@/lib/account";
import { regionLabel, SOURCE_LABEL } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { MetricsTabs } from "./tabs";

export const metadata = { title: "Métricas · Admin" };

/** Forma del jsonb de public.admin_overview. */
type Overview = {
  kpi: {
    visitors: number; new_visitors: number; sessions: number; pageviews: number; active_users: number;
    dau: number; wau: number; mau: number; signups: number; users_total: number; users_before: number;
    published_events: number; submissions: number;
  };
  daily: { day: string; visitors: number; users: number; signups: number }[];
  acquisition: { visitors: { source: string; n: number }[]; signups: { source: string; n: number }[] };
  places: {
    visitors: { label: string; state: string | null; n: number }[];
    regions: { region: string; n: number }[];
    members: { label: string; state: string; n: number }[];
    searched: { label: string; n: number }[];
  };
  categories: Record<"views" | "saves" | "interests" | "declared", { category: Category; n: number }[]> & { companions: { id: string; n: number }[] };
  funnel: { visitors: number; saw_event: number; acted: number; saved: number; contacted: number };
  retention: { week: string; size: number; returned: number }[];
  devices: { device: "mobile" | "desktop"; n: number }[];
  top_events: { id: string; title: string; slug: string; views: number; visitors: number; actions: number }[];
};

const RANGES = [["7", "7 días"], ["30", "30 días"], ["90", "90 días"]] as const;
const stateName = (s: string | null) => (s && s.length <= 3 ? regionLabel(s) : s);
const cat = (rows: { category: Category; n: number }[]) => rows.map((r) => ({ label: CATEGORY_LABEL[r.category] ?? r.category, value: r.n }));
const src = (rows: { source: string; n: number }[]) => rows.map((r) => ({ label: SOURCE_LABEL[r.source] ?? r.source, value: r.n }));
const weekLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.some(([k]) => k === sp.r) ? sp.r! : "30";
  const to = new Date();
  const from = new Date(to.getTime() - Number(range) * 86400000);
  from.setHours(0, 0, 0, 0);
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_overview", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw new Error(error.message);
  const o = data as Overview;
  const k = o.kpi;

  // registrados acumulados: los de antes del rango + los de cada día
  const cumulative = runningTotal(o.daily, k.users_before);
  const conversion = k.new_visitors ? (k.signups / k.new_visitors) * 100 : 0;
  const mobile = o.devices.find((d) => d.device === "mobile")?.n ?? 0;
  const mobilePct = k.visitors ? (mobile / k.visitors) * 100 : 0;
  const topZone = o.places.visitors.find((p) => p.label !== "Sin ubicación");
  const topCat = o.categories.views[0];

  // títulos que dicen el hallazgo; si no hay datos, el nombre de la métrica
  const peakDay = o.daily.reduce<(typeof o.daily)[number] | null>((m, d) => (!m || d.visitors > m.visitors ? d : m), null);
  const acqV = src(o.acquisition.visitors);
  const acqS = src(o.acquisition.signups);
  const placeRows = o.places.visitors.map((p) => ({ label: p.label, sub: stateName(p.state), value: p.n }));
  const regionRows = o.places.regions.map((r) => ({ label: regionLabel(r.region === "?" ? null : r.region), value: r.n }));
  const memberRows = o.places.members.map((m) => ({ label: m.label, sub: m.state, value: m.n }));
  const searchedRows = o.places.searched.map((x) => ({ label: x.label, value: x.n }));
  const catViews = cat(o.categories.views);
  const catSaved = cat(mergeCats(o.categories.saves, o.categories.interests));
  const catDeclared = cat(o.categories.declared);
  const companionRows = o.categories.companions.map((c) => ({ label: COMPANIONS.find((x) => x.id === c.id)?.label ?? c.id, value: c.n }));
  const retention = o.retention.map((c) => ({ label: `Semana del ${weekLabel(c.week)}`, sub: `${fmtN(c.size)} nuevos`, value: Math.round((c.returned / Math.max(c.size, 1)) * 100) }));
  const retentionAvg = (() => {
    const size = o.retention.reduce((a, c) => a + c.size, 0);
    return size ? (o.retention.reduce((a, c) => a + c.returned, 0) / size) * 100 : 0;
  })();
  const actedPct = o.funnel.saw_event ? (o.funnel.acted / o.funnel.saw_event) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Métricas</h1>
          <p className="mt-1 text-[14px] text-ink-2">Uso del público, cuentas y adquisición. Datos anónimos desde que se activó la analítica.</p>
        </div>
        <nav className="flex gap-2 text-[13px]">
          {RANGES.map(([key, l]) => (
            <Link key={key} href={`?r=${key}`} className={clsx("rounded-full border px-3 py-1.5 font-medium", range === key ? "border-ink bg-ink text-white" : "border-line-2 hover:border-ink")}>{l}</Link>
          ))}
        </nav>
      </div>
      <MetricsTabs active="general" range={range} />

      <div className="mt-5 space-y-4">
        {/* lo que se le cuenta a un comercio en una frase */}
        <section className="rounded-card bg-ink p-5 text-white">
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-white/60">Para el pitch</p>
          <p className="mt-2 text-[17px] leading-relaxed">
            <b>{fmtN(k.mau)}</b> personas usaron entrelugares en los últimos 30 días
            {mobilePct > 0 && <>, <b>{fmtPct(mobilePct)}</b> desde el celular</>}
            {topZone && <>; la zona con más público es <b>{topZone.label}</b></>}
            {topCat && <> y lo más buscado es <b>{(CATEGORY_LABEL[topCat.category] ?? topCat.category).toLowerCase()}</b></>}.
            {" "}Hay <b>{fmtN(k.users_total)}</b> {k.users_total === 1 ? "cuenta registrada" : "cuentas registradas"} y <b>{fmtN(k.published_events)}</b> {k.published_events === 1 ? "evento publicado" : "eventos publicados"}.
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat hero label="Visitantes únicos" value={fmtN(k.visitors)} hint={`${fmtN(k.new_visitors)} nuevos · ${fmtN(k.pageviews)} vistas`} />
          <Stat label="Registros nuevos" value={fmtN(k.signups)} hint={`${fmtPct(conversion)} de los visitantes nuevos`} />
          <Stat label="Cuentas registradas" value={fmtN(k.users_total)} hint={`${fmtN(k.active_users)} activas en el rango`} />
          <Stat label="Activos hoy · semana · mes" value={`${fmtN(k.dau)} · ${fmtN(k.wau)} · ${fmtN(k.mau)}`} hint="Visitantes únicos en 1, 7 y 30 días" />
        </div>

        <Card
          title={peakDay?.visitors ? `${fmtN(k.visitors)} personas en ${range} días; el día más fuerte fue el ${weekLabel(peakDay.day)} con ${fmtN(peakDay.visitors)}` : "Personas por día"}
          subtitle="Visitantes únicos y cuentas con sesión, por día · la línea punteada es el promedio diario"
        >
          <LineChart average days={o.daily} series={[{ key: "visitors", label: "Visitantes" }, { key: "users", label: "Con sesión" }]} />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={`${fmtN(k.users_total)} ${k.users_total === 1 ? "cuenta" : "cuentas"} en total, ${fmtN(k.signups)} ${k.signups === 1 ? "nueva" : "nuevas"} en el rango`} subtitle="Cuentas registradas, acumulado histórico">
            <LineChart compact days={cumulative} series={[{ key: "total", label: "Cuentas" }]} />
          </Card>
          <Card title={k.signups ? `Se registra el ${fmtPct(conversion)} de los visitantes nuevos` : "Aún no hay registros en el rango"} subtitle="Registros por día">
            <LineChart compact days={o.daily} series={[{ key: "signups", label: "Registros" }]} />
          </Card>
          <Card title={finding(acqV, (l, p) => `${l} trae el ${p} de los visitantes nuevos`, "Cómo llegan los visitantes nuevos")} subtitle="Fuente de la primera visita">
            <BarList showPct focus="top" rows={acqV} />
          </Card>
          <Card title={finding(acqS, (l, p) => `${l} trae el ${p} de los registros`, "Cómo llegaron quienes se registraron")} subtitle="Fuente de la primera visita de quien se registró">
            <BarList showPct focus="top" rows={acqS} />
          </Card>
          <Card title={finding(placeRows, (l, p) => `${l} concentra el ${p} del público`, "De dónde son los visitantes")} subtitle="Visitantes por ubicación aproximada">
            <BarList showPct focus="top" rows={placeRows} />
          </Card>
          <Card title={finding(regionRows, (l, p) => `${l} es el ${p} del público`, "Visitantes por estado")} subtitle="Visitantes por estado">
            <BarList showPct focus="top" rows={regionRows} />
          </Card>
          <Card title={finding(memberRows, (l, _p, r) => `${l} es el pueblo con más cuentas (${fmtN(r.value)})`, "Pueblo de las cuentas")} subtitle="Pueblo declarado en el perfil">
            <BarList focus="top" rows={memberRows} />
          </Card>
          <Card title={finding(searchedRows, (l, _p, r) => `${l} es la zona más buscada (${fmtN(r.value)} ${r.value === 1 ? "persona" : "personas"})`, "Zonas más buscadas")} subtitle="Personas por municipio elegido en el buscador">
            <BarList focus="top" rows={searchedRows} />
          </Card>
          <Card title={finding(catViews, (l, p) => `${l} es lo más visto: ${p} del público de eventos`, "Categorías más vistas")} subtitle="Visitantes por categoría del evento">
            <BarList showPct focus="top" rows={catViews} />
          </Card>
          <Card title={finding(catSaved, (l, p) => `${l} se lleva el ${p} de los guardados y me interesa`, "Guardados y me interesa por categoría")} subtitle="Guardados y me interesa por categoría, histórico">
            <BarList focus="top" rows={catSaved} />
          </Card>
          <Card title={finding(catDeclared, (l, _p, r) => `${l} es el gusto más declarado (${fmtN(r.value)} ${r.value === 1 ? "cuenta" : "cuentas"})`, "Gustos declarados")} subtitle="Lo que eligen en su perfil">
            <BarList focus="top" rows={catDeclared} />
          </Card>
          <Card title={finding(companionRows, (l, p) => `El ${p} sale ${l.toLowerCase().replace("mi cuenta", "su cuenta")}`, "Con quién salen")} subtitle="Con quién salen, declarado en el perfil">
            <BarList focus="top" rows={companionRows} />
          </Card>
          <Card title={o.funnel.saw_event ? `El ${fmtPct(actedPct)} de quien ve un evento hace algo con él` : "Embudo"} subtitle="Visitantes en cada paso · % respecto al paso anterior">
            <Funnel steps={[
              { label: "Visitaron", value: o.funnel.visitors },
              { label: "Vieron un evento", value: o.funnel.saw_event },
              { label: "Tomaron acción", value: o.funnel.acted },
            ]} />
            <p className="mt-4 border-t border-line pt-3 text-[12px] text-ink-2">
              De quienes vieron un evento, <b className="text-ink">{fmtPct(o.funnel.saw_event ? (o.funnel.saved / o.funnel.saw_event) * 100 : 0)}</b> lo guardó o marcó “me interesa” y{" "}
              <b className="text-ink">{fmtPct(o.funnel.saw_event ? (o.funnel.contacted / o.funnel.saw_event) * 100 : 0)}</b> contactó al organizador.
            </p>
          </Card>
          <Card title={o.retention.length ? `Regresa el ${fmtPct(retentionAvg)} de los nuevos en 7 días` : "Regresan en 7 días"} subtitle="% de visitantes nuevos de cada semana que volvió · la semana en curso aún no cumple 7 días">
            {o.retention.length ? (
              <BarList wideLabels reference={{ value: retentionAvg, label: "Promedio del rango" }} rows={retention} unit="%" />
            ) : <Empty />}
          </Card>
          <Card title={k.visitors ? `El ${fmtPct(mobilePct)} entra desde el celular` : "Dispositivo"} subtitle="Visitantes por dispositivo">
            <SplitBar parts={[
              { label: "Celular", value: mobile },
              { label: "Computadora", value: o.devices.find((d) => d.device === "desktop")?.n ?? 0 },
            ]} />
          </Card>
          <Card title={`${fmtN(k.published_events)} eventos publicados; ${fmtN(k.submissions)} ${k.submissions === 1 ? "envío" : "envíos"} de organizadores en el rango`} subtitle="Oferta: eventos y envíos desde /publicar">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[26px] font-semibold leading-none">{fmtN(k.published_events)}</p><p className="mt-1 text-[12px] text-ink-2">Eventos publicados</p></div>
              <div><p className="text-[26px] font-semibold leading-none">{fmtN(k.submissions)}</p><p className="mt-1 text-[12px] text-ink-2">Envíos desde /publicar en el rango</p></div>
            </div>
          </Card>
        </div>

        <Card title={o.top_events[0] ? `“${o.top_events[0].title}” es el evento con más público (${fmtN(o.top_events[0].visitors)} personas)` : "Eventos con más público"} subtitle="Eventos con más vistas en el rango">
          {o.top_events.length ? (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead className="text-left text-[12px] text-ink-2">
                  <tr><th className="px-5 py-2 font-medium">Evento</th><th className="px-3 py-2 text-right font-medium">Vistas</th><th className="px-3 py-2 text-right font-medium">Personas</th><th className="px-3 py-2 text-right font-medium">Acciones</th><th className="px-5 py-2" /></tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {o.top_events.map((e) => (
                    <tr key={e.id}>
                      <td className="max-w-[360px] truncate px-5 py-2.5 font-medium">{e.title}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(e.views)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(e.visitors)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtN(e.actions)}</td>
                      <td className="px-5 py-2.5 text-right"><Link href={`/admin/events/${e.id}/metricas`} className="text-[13px] font-semibold underline">Métricas</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty />}
        </Card>
      </div>
    </div>
  );
}

function mergeCats(a: { category: Category; n: number }[], b: { category: Category; n: number }[]) {
  const m = new Map<Category, number>();
  for (const r of [...a, ...b]) m.set(r.category, (m.get(r.category) ?? 0) + r.n);
  return [...m.entries()].map(([category, n]) => ({ category, n })).sort((x, y) => y.n - x.n);
}

function runningTotal(days: { day: string; signups: number }[], start: number) {
  const out: { day: string; total: number }[] = [];
  let acc = start;
  for (const d of days) out.push({ day: d.day, total: (acc += d.signups) });
  return out;
}
