import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { Card, Empty, fmtN, Stat } from "@/components/charts/charts";
import { regionLabel, SOURCE_LABEL } from "@/lib/analytics";
import { STEP_LABEL, targetLabel } from "@/lib/journey";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Recorrido · Métricas · Admin" };

type Step = {
  ts: string; session_id: string | null; type: string; path: string; target: string | null; event_title: string | null;
  source: string | null; geo_city: string | null; geo_region: string | null; device: string | null; props: Record<string, unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TZ = "America/Mexico_City";
const time = (s: string) => new Date(s).toLocaleTimeString("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });
const day = (s: string) => new Date(s).toLocaleDateString("es-MX", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

export default async function JourneyPage({ params, searchParams }: { params: Promise<{ vid: string }>; searchParams: Promise<{ r?: string }> }) {
  const { vid } = await params;
  const { r = "7" } = await searchParams;
  if (!UUID.test(vid)) notFound();
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_visitor_journey", { p_visitor: vid });
  if (error) throw new Error(error.message);
  const { steps, linked } = data as { steps: Step[]; linked: boolean };
  if (!steps.length) notFound();

  // sesiones en orden; sin id (navegadores sin sessionStorage) se cortan tras 30 min de silencio
  const sessions: { key: string; steps: Step[] }[] = [];
  for (const s of steps) {
    const cur = sessions.at(-1);
    const prev = cur?.steps.at(-1);
    const same = cur && prev && (s.session_id ? s.session_id === prev.session_id || !prev.session_id : Date.parse(s.ts) - Date.parse(prev.ts) < 30 * 60000);
    if (same) cur.steps.push(s);
    else sessions.push({ key: `${s.session_id ?? "s"}-${s.ts}`, steps: [s] });
  }
  const first = steps.find((s) => s.type === "pageview") ?? steps[0];
  const actions = steps.filter((s) => s.type !== "pageview" && s.type !== "click").length;

  return (
    <div className="mx-auto max-w-[900px]">
      <Link href={`/admin/metricas/usuarios?r=${r}`} className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
        <ArrowLeft size={14} /> Usuarios nuevos
      </Link>
      <h1 className="mt-2 text-[24px] font-bold">Recorrido de un visitante</h1>
      <p className="mt-1 text-[13px] text-ink-2">
        Llegó el {day(first.ts)} desde {SOURCE_LABEL[first.source ?? ""] ?? first.source ?? "–"}
        {first.geo_city || first.geo_region ? ` · ${first.geo_city ?? regionLabel(first.geo_region)}` : ""}
        {first.device ? ` · ${first.device === "mobile" ? "celular" : "computadora"}` : ""}
        {linked ? " · creó cuenta" : ""}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Sesiones" value={fmtN(sessions.length)} />
        <Stat label="Páginas" value={fmtN(steps.filter((s) => s.type === "pageview").length)} />
        <Stat label="Acciones" value={fmtN(actions)} hint={`${fmtN(steps.filter((s) => s.type === "click").length)} clics`} />
      </div>

      <div className="mt-4 space-y-4">
        {sessions.toReversed().map((ses, i) => {
          const start = ses.steps[0].ts;
          const mins = Math.round((Date.parse(ses.steps.at(-1)!.ts) - Date.parse(start)) / 60000);
          return (
            <Card key={ses.key} title={`Sesión ${sessions.length - i} · ${day(start)}`} subtitle={`${time(start)} · ${mins < 1 ? "menos de 1 min" : `${mins} min`} · ${ses.steps.length} pasos`}>
              {ses.steps.length === 0 ? <Empty /> : (
                <ol className="relative space-y-1.5 border-l border-line pl-4 text-[13px]">
                  {ses.steps.map((s, j) => (
                    <li key={j} className="relative">
                      <span className={clsx("absolute -left-[21px] top-[7px] size-2 rounded-full", s.type === "pageview" ? "bg-ink" : s.type === "click" ? "bg-line-2" : "bg-accent")} />
                      <span className="mr-2 tabular-nums text-ink-3">{time(s.ts)}</span>
                      <Describe s={s} />
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Describe({ s }: { s: Step }) {
  if (s.type === "pageview") return <span><span className="font-medium">Abrió</span> <code className="text-ink-2">{s.path}</code>{s.event_title && <span className="text-ink-2"> · {s.event_title}</span>}</span>;
  if (s.type === "click") return <span className="text-ink-2">Tocó «{targetLabel(s.target)}»</span>;
  const label = typeof s.props?.label === "string" ? s.props.label : typeof s.props?.q === "string" ? s.props.q : null;
  return (
    <span>
      <span className="font-semibold text-accent">{STEP_LABEL[s.type] ?? s.type}</span>
      {label && <span className="text-ink-2"> · {label}</span>}
      {s.event_title && <span className="text-ink-2"> · {s.event_title}</span>}
    </span>
  );
}
