import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ExperienceForm } from "../experience-form";

export const metadata = { title: "Nueva experiencia · Admin" };

export default async function NewExperiencePage() {
  const sb = await createClient();
  const { data: munis } = await sb.from("municipalities").select("cvegeo, name").order("name");
  return (
    <div className="mx-auto max-w-[1200px]">
      <Link href="/admin/experiencias" className="flex items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink"><ChevronLeft size={16} aria-hidden /> Experiencias</Link>
      <h1 className="mt-2 text-[28px] font-bold">Nueva experiencia</h1>
      <p className="mt-1 text-[14px] text-ink-2">Algo que se puede hacer cualquier día: un sendero, una cascada, un taller, un viñedo…</p>
      <ExperienceForm experience={null} placeName={null} organizerName={null} municipalities={munis ?? []} outings={[]} />
    </div>
  );
}
