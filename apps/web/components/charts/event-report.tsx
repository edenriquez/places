import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { regionLabel, SOURCE_LABEL } from "@/lib/analytics";
import { BarList, Card, Empty, fmtN, fmtPct, Heatmap, LineChart, SplitBar, Stat } from "./charts";

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

      <Card title="Vistas y acciones por día" subtitle="Hora de la Ciudad de México">
        <LineChart days={r.daily} series={[{ key: "views", label: "Vistas" }, { key: "actions", label: "Acciones" }]} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Qué hizo la gente" subtitle="Acciones sobre el evento">
          <BarList rows={[
            { label: "Guardados", value: k.saves },
            { label: "Me interesa", value: k.interests },
            { label: "Llamadas y WhatsApp", value: k.contact },
            { label: "Cómo llegar", value: k.directions },
            { label: "Compartidos", value: k.shares },
            { label: "Redes y sitio", value: k.links },
          ].filter((x) => x.value > 0)} />
        </Card>
        <Card title="De dónde llegaron" subtitle="Personas por fuente de la visita">
          <BarList showPct rows={r.sources.map((s) => ({ label: SOURCE_LABEL[s.source] ?? s.source, value: s.n }))} />
        </Card>
        <Card title="De dónde son" subtitle="Ubicación aproximada de quien lo vio">
          <BarList showPct rows={r.places.map((p) => ({ label: p.label, sub: stateName(p.state), value: p.n }))} />
        </Card>
        <Card title="Qué tan lejos están" subtitle="Distancia entre la persona y el evento">
          {r.distance.length ? (
            <BarList showPct rows={BUCKETS.map((b) => ({ label: b, value: r.distance.find((d) => d.bucket === b)?.n ?? 0 }))} />
          ) : <Empty />}
        </Card>
        <Card title="Qué más le gusta a su público" subtitle="Otras categorías que ve y prefiere esta audiencia">
          {r.likes.length ? (
            <BarList rows={r.likes.map((l) => ({ label: CATEGORY_LABEL[l.category] ?? l.category, value: Math.round((l.w / likesTotal) * 100) }))} unit="%" />
          ) : <Empty>Aún no hay suficiente historial de esta audiencia.</Empty>}
        </Card>
        <Card title="Zonas donde buscaban" subtitle="Municipio elegido en el buscador">
          <BarList rows={r.searched.map((s) => ({ label: s.label, value: s.n }))} />
        </Card>
        <Card title="Dispositivo">
          <SplitBar parts={[
            { label: "Celular", value: r.devices.find((d) => d.device === "mobile")?.n ?? 0 },
            { label: "Computadora", value: r.devices.find((d) => d.device === "desktop")?.n ?? 0 },
          ]} />
        </Card>
        <Card title="Cuándo lo vieron" subtitle="Día y hora de las vistas">
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
