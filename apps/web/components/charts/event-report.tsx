import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { regionLabel, SOURCE_LABEL } from "@/lib/analytics";
import { BarList, Card, Empty, fmtN, fmtPct, Heatmap, heatPeak, LineChart, SplitBar, Stat, finding } from "./charts";

/** Forma del jsonb de public._event_report (supabase/migrations/20260925000000_analytics.sql). */
export type EventReportData = {
  event: { id: string; title: string; slug: string; category: Category; created_at: string; next_at: string | null };
  range: { from: string; to: string };
  kpi: { views: number; visitors: number; contact: number; directions: number; shares: number; links: number; acting: number; saves: number; interests: number };
  daily: { day: string; views: number; actions: number }[];
  sources: { source: string; n: number }[];
  places: { label: string; state: string | null; n: number }[];
  searched: { label: string; n: number }[];
  distance: { bucket: string; n: number }[];
  devices: { device: "mobile" | "desktop"; n: number }[];
  likes: { category: Category; w: number }[];
  heatmap: { dow: number; hour: number; n: number }[];
  benchmark: { median_views: number | null };
};

const BUCKETS = ["<10 km", "10–30 km", "30–60 km", ">60 km"];
// el estado llega con nombre (municipio cargado) o con clave de Vercel (resto del país)
const stateName = (s: string | null) => (s && s.length <= 3 ? regionLabel(s) : s);

export function EventReport({ r, forCommerce }: { r: EventReportData; forCommerce?: boolean }) {
  const k = r.kpi;
  const actionRate = k.visitors ? (k.acting / k.visitors) * 100 : 0;
  const vsMedian = r.benchmark.median_views ? k.views / r.benchmark.median_views : null;
  const likesTotal = r.likes.reduce((a, l) => a + l.w, 0) || 1;

  // títulos que dicen el hallazgo; sin datos, el nombre de la métrica
  const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  const peakDay = r.daily.reduce<(typeof r.daily)[number] | null>((m, d) => (!m || d.views > m.views ? d : m), null);
  const actionRows = [
    { label: "Guardados", value: k.saves },
    { label: "Me interesa", value: k.interests },
    { label: "Llamadas y WhatsApp", value: k.contact },
    { label: "Cómo llegar", value: k.directions },
    { label: "Compartidos", value: k.shares },
    { label: "Redes y sitio", value: k.links },
  ].filter((x) => x.value > 0);
  const sourceRows = r.sources.map((x) => ({ label: SOURCE_LABEL[x.source] ?? x.source, value: x.n }));
  const placeRows = r.places.map((p) => ({ label: p.label, sub: stateName(p.state), value: p.n }));
  const distRows = BUCKETS.map((b) => ({ label: b, value: r.distance.find((d) => d.bucket === b)?.n ?? 0 }));
  const distTotal = distRows.reduce((a, x) => a + x.value, 0);
  const near = distRows[0].value + distRows[1].value;
  const likeRows = r.likes.map((l) => ({ label: CATEGORY_LABEL[l.category] ?? l.category, value: Math.round((l.w / likesTotal) * 100) }));
  const searchedRows = r.searched.map((x) => ({ label: x.label, value: x.n }));
  const mobile = r.devices.find((d) => d.device === "mobile")?.n ?? 0;
  const desktop = r.devices.find((d) => d.device === "desktop")?.n ?? 0;
  const heat = heatPeak(r.heatmap);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat hero label="Personas que lo vieron" value={fmtN(k.visitors)} hint={`${fmtN(k.views)} vistas en total`} />
        <Stat label="Tomaron acción" value={fmtPct(actionRate)} hint={`${fmtN(k.acting)} personas llamaron, guardaron, compartieron o buscaron cómo llegar`} />
        <Stat label="Contactos al organizador" value={fmtN(k.contact)} hint="Llamadas y WhatsApp" />
        <Stat
          label={vsMedian ? "Frente a eventos similares" : "Guardados y me interesa"}
          value={vsMedian ? `${vsMedian.toFixed(1)}×` : fmtN(k.saves + k.interests)}
          hint={vsMedian ? `Vistas contra la mediana de ${CATEGORY_LABEL[r.event.category]?.toLowerCase() ?? "su categoría"}` : `${fmtN(k.saves)} guardados · ${fmtN(k.interests)} me interesa`}
        />
      </div>

      <Card
        title={peakDay?.views ? `${fmtN(k.views)} vistas; el día más fuerte fue el ${dayLabel(peakDay.day)} con ${fmtN(peakDay.views)}` : "Vistas y acciones por día"}
        subtitle="Vistas y acciones por día, hora de la Ciudad de México · la línea punteada es el promedio diario"
      >
        <LineChart average days={r.daily} series={[{ key: "views", label: "Vistas" }, { key: "actions", label: "Acciones" }]} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={finding(actionRows, (l) => `${l} es lo que más hizo la gente con el evento`, "Qué hizo la gente")} subtitle="Acciones sobre el evento">
          <BarList focus="top" rows={actionRows} />
        </Card>
        <Card title={finding(sourceRows, (l, p) => `${l} trajo el ${p} de las visitas`, "De dónde llegaron")} subtitle="Personas por fuente de la visita">
          <BarList showPct focus="top" rows={sourceRows} />
        </Card>
        <Card title={finding(placeRows, (l, p) => `El ${p} de su público es de ${l}`, "De dónde son")} subtitle="Personas por ubicación aproximada">
          <BarList showPct focus="top" rows={placeRows} />
        </Card>
        <Card title={distTotal ? `El ${fmtPct((near / distTotal) * 100)} está a menos de 30 km` : "Qué tan lejos están"} subtitle="Personas por distancia al evento">
          {r.distance.length ? (
            <BarList showPct focus="top" rows={distRows} />
          ) : <Empty />}
        </Card>
        <Card title={finding(likeRows, (l) => `A su público también le gusta ${l.toLowerCase()}`, "Qué más le gusta a su público")} subtitle="Otras categorías que ve y prefiere esta audiencia, en %">
          {r.likes.length ? (
            <BarList focus="top" rows={likeRows} unit="%" />
          ) : <Empty>Aún no hay suficiente historial de esta audiencia.</Empty>}
        </Card>
        <Card title={finding(searchedRows, (l) => `Lo buscaban sobre todo desde ${l}`, "Zonas donde buscaban")} subtitle="Personas por municipio elegido en el buscador">
          <BarList focus="top" rows={searchedRows} />
        </Card>
        <Card title={mobile + desktop ? `El ${fmtPct((mobile / (mobile + desktop)) * 100)} lo vio desde el celular` : "Dispositivo"} subtitle="Personas por dispositivo">
          <SplitBar parts={[{ label: "Celular", value: mobile }, { label: "Computadora", value: desktop }]} />
        </Card>
        <Card title={heat ? `Lo vieron más el ${heat.day} a las ${heat.hour}:00` : "Cuándo lo vieron"} subtitle="Vistas por día y hora">
          <Heatmap cells={r.heatmap} />
        </Card>
      </div>

      {forCommerce && (
        <p className="pt-2 text-center text-[12px] text-ink-3">
          Datos anónimos y aproximados: no guardamos IPs ni datos personales. Ubicación por ciudad, no exacta.
        </p>
      )}
    </div>
  );
}
