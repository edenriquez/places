import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink, Megaphone } from "lucide-react";
import { EventReport, type EventReportData } from "@/components/charts/event-report";
import { createAnonClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reporte del evento", robots: { index: false, follow: false } };

/** Reporte de solo lectura para el comercio (link privado que genera el admin). */
export default async function CommerceReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{20,80}$/.test(token)) notFound();
  const { data } = await createAnonClient().rpc("event_report_by_token", { p_token: token });
  if (!data) notFound();
  const r = data as EventReportData;
  const since = new Date(r.range.from).toLocaleDateString("es-MX", { day: "numeric", month: "long" });

  return (
    <main className="mx-auto max-w-[1100px] px-5 pb-16 pt-6 lg:px-8">
      <header className="flex items-center justify-between gap-3 border-b border-line pb-4">
        <Link href="/" className="font-[family-name:var(--font-jakarta)] text-[20px] font-extrabold tracking-tight text-accent">entrelugares</Link>
        <span className="rounded-full bg-bg-2 px-3 py-1 text-[12px] font-medium text-ink-2">Reporte para el organizador</span>
      </header>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-2">Desde el {since} hasta hoy</p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight">{r.event.title}</h1>
          <Link href={`/evento/${r.event.slug}`} className="mt-1 inline-flex items-center gap-1 text-[13px] text-ink-2 hover:underline">Ver el evento publicado <ExternalLink size={12} /></Link>
        </div>
      </div>

      <div className="mt-6"><EventReport r={r} forCommerce /></div>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-card bg-ink p-6 text-white">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10"><Megaphone size={20} /></span>
          <div>
            <h2 className="text-[18px] font-bold">Llega a más gente con tu próximo evento</h2>
            <p className="mt-1 text-[14px] text-white/70">Destacamos tu evento en la zona y te mandamos este reporte al terminar.</p>
          </div>
        </div>
        <a href={`mailto:hola@entrelugares.mx?subject=${encodeURIComponent(`Promocionar: ${r.event.title}`)}`} className="rounded-control bg-white px-5 py-3 text-[14px] font-semibold text-ink">Quiero promocionarlo</a>
      </section>
    </main>
  );
}
