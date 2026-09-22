import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "./review-form";

export const metadata = { title: "Revisar evento · Admin" };

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: ing } = await sb.from("raw_ingestions").select("*, sources(name, url)").eq("id", id).maybeSingle();
  if (!ing) notFound();

  const [{ data: munis }, { data: event }, { data: occ }, { data: queue }] = await Promise.all([
    sb.from("municipalities_view").select("cvegeo,name").order("name"),
    ing.event_id ? sb.from("events").select("*").eq("id", ing.event_id).maybeSingle() : Promise.resolve({ data: null }),
    ing.event_id ? sb.from("event_occurrences").select("*").eq("event_id", ing.event_id).order("starts_at") : Promise.resolve({ data: [] }),
    sb.from("raw_ingestions").select("id").eq("status", "needs_review").order("received_at"),
  ]);
  const ids = (queue ?? []).map((q) => q.id);
  const idx = ids.indexOf(id);
  const prev = idx > 0 ? ids[idx - 1] : null;
  const next = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;

  // lugares del municipio (para autocompletar) y eventos cercanos en fecha (para "duplicado de")
  const cvegeo = event?.municipality_cvegeo ?? ing.municipality_hint ?? null;
  const [{ data: places }, { data: candidates }] = await Promise.all([
    cvegeo ? sb.from("places_view").select("id,name,kind").eq("municipality_cvegeo", cvegeo).order("name") : Promise.resolve({ data: [] }),
    cvegeo
      ? sb.from("events").select("id,title,slug,status").eq("municipality_cvegeo", cvegeo).in("status", ["published", "pending"]).neq("id", ing.event_id ?? "00000000-0000-0000-0000-000000000000").order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/review" className="text-[13px] text-ink-2 underline">Revisión</Link>
          <h1 className="text-[24px] font-bold">Revisar evento{idx >= 0 ? ` · ${idx + 1} de ${ids.length}` : ""}</h1>
        </div>
        <div className="flex gap-2">
          <Link aria-disabled={!prev} href={prev ? `/admin/review/${prev}` : "#"} className={`grid h-9 w-9 place-items-center rounded-full border border-line ${!prev && "pointer-events-none opacity-40"}`}><ChevronLeft size={18} /></Link>
          <Link aria-disabled={!next} href={next ? `/admin/review/${next}` : "#"} className={`grid h-9 w-9 place-items-center rounded-full border border-line ${!next && "pointer-events-none opacity-40"}`}><ChevronRight size={18} /></Link>
        </div>
      </div>
      <ReviewForm
        ingestion={ing}
        event={event}
        occurrences={occ ?? []}
        municipalities={(munis ?? []) as { cvegeo: string; name: string }[]}
        places={(places ?? []) as { id: string; name: string; kind: string }[]}
        candidates={(candidates ?? []) as { id: string; title: string; slug: string; status: string }[]}
      />
    </div>
  );
}
