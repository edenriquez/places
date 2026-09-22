import Link from "next/link";
import { List } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { EventMap } from "@/components/event-map";
import { SearchBar } from "@/components/location-picker";
import { getLoc } from "@/lib/location-server";
import { eventsNear, municipalities } from "@/lib/queries";
import { createAnonClient } from "@/lib/supabase/server";
import type { NearRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mapa" };

export default async function MapPage() {
  const loc = await getLoc();
  const [munis, rows] = await Promise.all([municipalities(), eventsNear(loc, "15d")]);

  // coordenadas por evento desde la vista de puntos
  const sb = createAnonClient();
  const ids = [...new Set(rows.map((r) => r.event_id))];
  const { data: pts } = ids.length
    ? await sb.from("event_points_view").select("event_id,lat,lng").in("event_id", ids)
    : { data: [] as { event_id: string; lat: number; lng: number }[] };
  const coord = new Map((pts ?? []).map((p) => [p.event_id, p]));
  const events = rows
    .map((r) => ({ ...r, lat: coord.get(r.event_id)?.lat ?? null, lng: coord.get(r.event_id)?.lng ?? null }))
    .filter((r): r is NearRow & { lat: number; lng: number } => r.lat != null && r.lng != null);

  return (
    <main className="fixed inset-0 mx-auto max-w-screen-sm">
      <EventMap events={events} center={{ lat: loc.lat, lng: loc.lng }} radiusKm={loc.radiusKm} />
      <div className="absolute inset-x-0 top-0 z-20">
        <SearchBar loc={loc} municipalities={munis} compact />
      </div>
      <Link href="/" className="absolute right-5 top-[62px] z-20 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[14px] font-semibold shadow-float">
        <List size={16} /> Lista
      </Link>
      {!events.length && (
        <div className="absolute inset-x-5 top-1/2 z-10 -translate-y-1/2 rounded-card bg-white/95 p-5 text-center shadow-float">
          <p className="text-[15px] font-semibold">No hay eventos con ubicación en este radio</p>
          <p className="mt-1 text-[13px] text-ink-2">Amplía el radio o cambia de pueblo desde la barra de búsqueda.</p>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
