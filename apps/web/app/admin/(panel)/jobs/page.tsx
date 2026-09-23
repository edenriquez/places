import clsx from "clsx";
import { createClient } from "@/lib/supabase/server";
import { isWithinMinutes, relativeTime } from "@/lib/format";
import { JOB_KIND_LABEL, workerIsOnline, type Job, type Worker } from "@/lib/types";
import { StatusPill } from "../status-pill";
import { AutoRefresh } from "./auto-refresh";
import { EnqueueForm } from "./enqueue-form";
import { JobActions } from "./job-actions";

export const metadata = { title: "Tareas · Admin" };

function fmtDuration(from: string | null, to: string | null) {
  if (!from) return "—";
  const s = Math.max(0, Math.round((new Date(to ?? Date.now()).getTime() - new Date(from).getTime()) / 1000));
  if (s < 90) return `${s} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
}

function fmtUptime(s?: number) {
  if (!s) return null;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`;
  return `${Math.round(s / 86400)} d`;
}

function paramsSummary(job: Job) {
  const p = job.params ?? {};
  const bits: string[] = [];
  if (job.kind === "process" && p.limit) bits.push(`máx. ${p.limit}`);
  if (job.kind === "scrape") bits.push(p.source_id ? "una fuente" : "las que toquen", ...(p.force ? ["forzado"] : []));
  if (job.kind === "festivities") bits.push(String(p.year ?? ""), p.status === "pending" ? "pendientes" : "publicados");
  if (job.kind === "seed") bits.push(["municipalities", "sic", "denue", "festivities"].filter((k) => p[k] !== false).join(", "));
  return bits.filter(Boolean).join(" · ");
}

const ORIGIN_LABEL = { admin: "Admin", auto: "Automática", cli: "Terminal" } as const;

export default async function JobsPage() {
  const sb = await createClient();
  const [{ data: workerRows }, { data: jobRows }, { data: sourceRows }, { count: queuedFlyers }] = await Promise.all([
    sb.from("workers").select("*").order("last_seen_at", { ascending: false }),
    sb.from("jobs").select("*").order("created_at", { ascending: false }).limit(60),
    sb.from("sources").select("id,name").in("kind", ["facebook_page", "instagram", "website"]).eq("enabled", true).order("name"),
    sb.from("raw_ingestions").select("id", { count: "exact", head: true }).eq("status", "queued"),
  ]);
  const workers = (workerRows ?? []) as Worker[];
  const jobs = (jobRows ?? []) as Job[];
  const anyOnline = workers.some(workerIsOnline);
  const anyActive = jobs.some((j) => j.status === "running" || j.status === "queued");

  return (
    <div className="mx-auto max-w-[1100px]">
      <AutoRefresh everyMs={anyActive ? 3000 : 10000} />
      <h1 className="text-[28px] font-bold">Tareas</h1>
      <p className="mt-1 text-[14px] text-ink-2">
        La Mac corre <code className="rounded bg-bg-2 px-1">places-ingest worker</code>, reporta que está viva cada 15 s y toma las tareas de esta cola.
        Ella misma encola “Procesar flyers” cuando hay algo en cola y “Revisar fuentes” cuando toca por intervalo.
      </p>

      {/* ---------------------------------------------------------------- workers */}
      <section className="mt-6 grid gap-3 md:grid-cols-2">
        {workers.length === 0 && (
          <div className="rounded-card border border-dashed border-line-2 p-5 text-[14px] text-ink-2 md:col-span-2">
            <p className="font-semibold text-ink">Ninguna Mac se ha conectado todavía.</p>
            <p className="mt-1">En la Mac: <code className="rounded bg-bg-2 px-1">ops/worker.sh setup</code> y luego <code className="rounded bg-bg-2 px-1">ops/worker.sh install</code>. En cuanto arranque aparece aquí.</p>
          </div>
        )}
        {workers.map((w) => {
          const online = workerIsOnline(w);
          const current = w.current_job_id ? jobs.find((j) => j.id === w.current_job_id) : undefined;
          const busy = online && !!current && current.status === "running";
          const m = w.meta ?? {};
          return (
            <div key={w.id} className="rounded-card border border-line p-4">
              <div className="flex items-center gap-2.5">
                <span className={clsx("h-2.5 w-2.5 rounded-full", !online ? "bg-ink-3" : busy ? "bg-warn live-dot" : "bg-free")} />
                <h2 className="text-[16px] font-bold">{w.id}</h2>
                <span className="ml-auto text-[12px] text-ink-2">{online ? `en línea · visto ${relativeTime(w.last_seen_at)}` : `sin conexión · vista ${relativeTime(w.last_seen_at)}`}</span>
              </div>
              <p className="mt-2 text-[14px]">
                {!online
                  ? "El worker no manda señal. ¿La Mac está dormida o apagada, o el agente de launchd no está cargado?"
                  : busy
                    ? <>Ocupada: <strong>{JOB_KIND_LABEL[current!.kind]}</strong> · {current!.progress_done}/{current!.progress_total ?? "?"} · {current!.progress_message}</>
                    : `Libre. ${queuedFlyers ? `${queuedFlyers} flyers en cola, los tomará en su siguiente vuelta.` : "Sin flyers en cola."}`}
              </p>
              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
                {m.model && <div><dt className="inline">Modelo </dt><dd className="inline font-medium text-ink">{m.model}</dd></div>}
                {m.ocr_engine && <div><dt className="inline">OCR </dt><dd className="inline font-medium text-ink">{m.ocr_engine}</dd></div>}
                {online && <div><dt className="inline">Ollama </dt><dd className="inline font-medium text-ink">{m.ollama ? "encendido" : "apagado (bajo demanda)"}</dd></div>}
                {online && m.power && <div><dt className="inline">Energía </dt><dd className={clsx("inline font-medium", m.power === "battery" ? "text-warn" : "text-ink")}>{m.power === "ac" ? "corriente" : "batería"}</dd></div>}
                {online && m.load != null && <div><dt className="inline">Carga </dt><dd className="inline font-medium text-ink">{m.load}</dd></div>}
                {online && fmtUptime(m.uptime_s) && <div><dt className="inline">Encendido </dt><dd className="inline font-medium text-ink">{fmtUptime(m.uptime_s)}</dd></div>}
                {w.version && <div><dt className="inline">Código </dt><dd className="inline font-mono font-medium text-ink">{w.version}</dd></div>}
                {w.hostname && <div><dt className="inline">Host </dt><dd className="inline font-medium text-ink">{w.hostname}</dd></div>}
              </dl>
            </div>
          );
        })}
      </section>

      {/* ---------------------------------------------------------------- encolar */}
      <h2 className="mt-8 text-[18px] font-bold">Encolar tarea</h2>
      <div className="mt-3">
        <EnqueueForm sources={(sourceRows ?? []) as { id: string; name: string }[]} disabled={!anyOnline} />
      </div>

      {/* ---------------------------------------------------------------- lista */}
      <h2 className="mt-8 text-[18px] font-bold">Últimas tareas</h2>
      <div className="mt-3 overflow-hidden rounded-card border border-line">
        <table className="w-full text-[14px]">
          <thead className="bg-bg-2 text-left text-[12px] uppercase tracking-[0.04em] text-ink-2">
            <tr>
              <th className="px-4 py-2.5">Tarea</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="w-[34%] px-4 py-2.5">Progreso</th>
              <th className="px-4 py-2.5">Origen</th>
              <th className="px-4 py-2.5">Creada</th>
              <th className="px-4 py-2.5">Duración</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {jobs.map((j) => {
              const total = j.progress_total;
              const pct = total ? Math.min(100, Math.round((j.progress_done / total) * 100)) : j.status === "done" ? 100 : 0;
              const stale = j.status === "running" && !!j.heartbeat_at && !isWithinMinutes(j.heartbeat_at, 2);
              const hasLog = (j.log?.length ?? 0) > 0 || !!j.error;
              return (
                <tr key={j.id} className="align-top">
                  <td className="px-4 py-3">
                    <span className="block font-medium">{JOB_KIND_LABEL[j.kind] ?? j.kind}</span>
                    <span className="block text-[12px] text-ink-2">{paramsSummary(j)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={j.status} />
                    {stale && <span className="mt-1 block text-[11px] text-warn">sin señal hace {relativeTime(j.heartbeat_at)}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {(j.status === "running" || j.status === "done" || total) ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-2">
                          <div className={clsx("h-full rounded-full transition-[width]", j.status === "failed" ? "bg-error" : j.status === "cancelled" ? "bg-ink-3" : j.status === "done" ? "bg-free" : "bg-accent")} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-ink-2">{j.progress_done}/{total ?? "?"}</span>
                      </div>
                    ) : null}
                    {(j.progress_message || j.error) && (
                      <p className={clsx("mt-1 line-clamp-2 text-[12px]", j.status === "failed" ? "text-error" : "text-ink-2")}>
                        {j.status === "failed" ? (j.error ?? "").split("\n")[0] : j.progress_message}
                      </p>
                    )}
                    {hasLog && (
                      <details className="mt-1 text-[12px]">
                        <summary className="cursor-pointer text-ink-2 underline">log ({j.log?.length ?? 0})</summary>
                        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-bg-2 p-2 text-[11px] leading-snug">{[...(j.log ?? []), ...(j.error ? [`\n${j.error}`] : [])].join("\n")}</pre>
                      </details>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {ORIGIN_LABEL[j.origin] ?? j.origin}
                    {j.worker_id && <span className="block text-[11px]">{j.worker_id}</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-2" title={j.created_at}>{relativeTime(j.created_at)}</td>
                  <td className="px-4 py-3 text-ink-2">{j.status === "queued" ? "—" : fmtDuration(j.started_at, j.finished_at)}</td>
                  <td className="px-4 py-3">
                    <JobActions id={j.id} status={j.status} cancelRequested={!!j.cancel_requested_at} />
                  </td>
                </tr>
              );
            })}
            {jobs.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-2">Todavía no hay tareas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
