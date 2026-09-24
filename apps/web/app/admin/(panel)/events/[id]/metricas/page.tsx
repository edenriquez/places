import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import clsx from "clsx";
import { EventReport, type EventReportData } from "@/components/charts/event-report";
import { createClient } from "@/lib/supabase/server";
import { ReportLink } from "./report-link";

export const metadata = { title: "Métricas del evento · Admin" };

const RANGES = [["7", "7 días"], ["30", "30 días"], ["90", "90 días"], ["todo", "Desde que se publicó"]] as const;

export default async function EventMetricsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const range = RANGES.some(([k]) => k === sp.r) ? sp.r! : "30";
  const sb = await createClient();
  const { data: ev } = await sb.from("events").select("id, created_at").eq("id", id).maybeSingle();
  if (!ev) notFound();

  const to = new Date();
  const from = range === "todo" ? new Date(ev.created_at) : new Date(to.getTime() - Number(range) * 86400000);
  from.setHours(0, 0, 0, 0);
  const [{ data, error }, { data: link }] = await Promise.all([
    sb.rpc("event_report", { p_event: id, p_from: from.toISOString(), p_to: to.toISOString() }),
    sb.from("event_report_links").select("token").eq("event_id", id).is("revoked_at", null).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  const r = data as EventReportData;

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link href="/admin/events" className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 underline"><ArrowLeft size={14} /> Eventos</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight">{r.event.title}</h1>
          <Link href={`/evento/${r.event.slug}`} target="_blank" className="mt-1 inline-flex items-center gap-1 text-[13px] text-ink-2 hover:underline">Ver evento <ExternalLink size={12} /></Link>
        </div>
        <ReportLink eventId={id} token={(link?.token as string | undefined) ?? null} />
      </div>
      <nav className="mt-5 flex flex-wrap gap-2 text-[13px]">
        {RANGES.map(([k, l]) => (
          <Link key={k} href={`?r=${k}`} className={clsx("rounded-full border px-3 py-1.5 font-medium", range === k ? "border-ink bg-ink text-white" : "border-line-2 hover:border-ink")}>{l}</Link>
        ))}
      </nav>
      <div className="mt-5"><EventReport r={r} /></div>
    </div>
  );
}
