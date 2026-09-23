import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DesktopHeader } from "@/components/desktop";
import { EventDesktop, EventMobile } from "@/components/event-detail";
import { SearchBar } from "@/components/location-picker";
import { fmtWhenLong } from "@/lib/format";
import { getLoc, hasLoc } from "@/lib/location-server";
import { eventBySlug, municipalities, municipalityEvents } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await eventBySlug(slug);
  if (!data) return { title: "Evento" };
  const when = data.occurrences[0] ? fmtWhenLong(data.occurrences[0].starts_at, data.occurrences[0].ends_at, data.occurrences[0].is_all_day) : "";
  return {
    title: data.event.title,
    description: `${when}${data.municipality ? ` · ${data.municipality.name}` : ""}. ${data.event.description ?? ""}`.slice(0, 200),
    openGraph: { title: data.event.title, description: when, type: "article" },
  };
}

export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  const data = await eventBySlug(slug);
  if (!data) notFound();
  const [loc, isSet, munis, around] = await Promise.all([
    getLoc(),
    hasLoc(),
    municipalities(),
    data.municipality ? municipalityEvents(data.municipality.cvegeo, 7, data.municipality) : Promise.resolve([]),
  ]);
  const others = around.filter((e) => e.event_id !== data.event.id);

  // teléfono y escritorio no comparten layout: cada uno tiene su presentación
  return (
    <>
      <div className="lg:hidden"><EventMobile d={data} nearby={others.slice(0, 2)} /></div>
      <div className="hidden lg:block">
        <DesktopHeader><SearchBar loc={loc} municipalities={munis} isSet={isSet} header /></DesktopHeader>
        <EventDesktop d={data} nearby={others.slice(0, 3)} />
      </div>
    </>
  );
}
