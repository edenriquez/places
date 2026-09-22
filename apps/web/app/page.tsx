import Link from "next/link";
import { Map } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { CategoryRow } from "@/components/category-row";
import { EventCard, LiveCard } from "@/components/event-card";
import { SearchBar } from "@/components/location-picker";
import { Chip, EmptyState, SectionHeader } from "@/components/ui";
import { getLoc } from "@/lib/location-server";
import { eventsLiveNear, eventsNear, municipalities, type Range } from "@/lib/queries";

export const dynamic = "force-dynamic";

const RANGES: { key: Range; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "finde", label: "Este finde" },
  { key: "15d", label: "Próximos 15 días" },
  { key: "todo", label: "Todo" },
];

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ r?: string; c?: string }> }) {
  const sp = await searchParams;
  const range = (RANGES.some((x) => x.key === sp.r) ? sp.r : "finde") as Range;
  const category = sp.c;
  const loc = await getLoc();
  const [munis, live, upcoming] = await Promise.all([
    municipalities(),
    eventsLiveNear(loc),
    eventsNear(loc, range, category),
  ]);
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;

  return (
    <main className="mx-auto max-w-screen-sm pb-28">
      <SearchBar loc={loc} municipalities={munis} />
      <CategoryRow active={category} range={range} />

      <SectionHeader title="Sucediendo ahora" subtitle="Eventos activos en este momento cerca de ti" live />
      {live.length ? (
        <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-5 pb-1">
          {live.map((e) => <LiveCard key={`${e.event_id}-${e.starts_at}`} e={e} />)}
        </div>
      ) : (
        <EmptyState title="Nada en vivo ahora" hint="Mira lo que viene este fin de semana." />
      )}

      <SectionHeader
        title={rangeLabel}
        subtitle={`${upcoming.length} ${upcoming.length === 1 ? "evento" : "eventos"} a menos de ${loc.radiusKm} km de ${loc.label}`}
      />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-2">
        {RANGES.map((r) => (
          <Chip key={r.key} active={r.key === range} href={`/?r=${r.key}${category ? `&c=${category}` : ""}`}>{r.label}</Chip>
        ))}
      </div>
      {upcoming.length ? (
        <div className="divide-y divide-line/60">
          {upcoming.map((e) => <EventCard key={`${e.event_id}-${e.starts_at}`} e={e} />)}
        </div>
      ) : (
        <div className="pt-3">
          <EmptyState title="Todavía no hay eventos publicados aquí" hint="Prueba otro rango de fechas, amplía el radio o cambia de pueblo." />
        </div>
      )}

      <Link
        href="/mapa"
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-white shadow-float"
      >
        Mapa <Map size={18} />
      </Link>
      <BottomNav />
    </main>
  );
}
