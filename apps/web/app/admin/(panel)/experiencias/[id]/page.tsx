import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fmtWhenShort } from "@/lib/format";
import type { Experience } from "@/lib/types";
import { ExperienceForm } from "../experience-form";

export const metadata = { title: "Editar experiencia · Admin" };

export default async function EditExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const { data } = await sb.from("experiences_view").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const x = data as Experience;
  const now = new Date().toISOString();
  const [{ data: munis }, { data: place }, { data: org }, { data: events }] = await Promise.all([
    sb.from("municipalities").select("cvegeo, name").order("name"),
    x.place_id ? sb.from("places").select("name").eq("id", x.place_id).maybeSingle() : Promise.resolve({ data: null }),
    x.org_id ? sb.from("organizations").select("name").eq("id", x.org_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("events").select("id, title, slug, status, event_occurrences(starts_at)").eq("experience_id", id).order("created_at", { ascending: false }),
  ]);
  const outings = (events ?? []).map((e) => {
    const next = (e.event_occurrences as { starts_at: string }[]).map((o) => o.starts_at).filter((s) => new Date(s).toISOString() >= now).sort()[0];
    return { id: e.id as string, title: e.title as string, slug: e.slug as string, status: e.status as string, next: next ? fmtWhenShort(next) : null };
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link href="/admin/experiencias" className="flex items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink"><ChevronLeft size={16} aria-hidden /> Experiencias</Link>
      <h1 className="mt-2 text-[28px] font-bold">{x.title}</h1>
      <ExperienceForm experience={x} placeName={place?.name ?? null} organizerName={org?.name ?? null} municipalities={munis ?? []} outings={outings} />
    </div>
  );
}
