import Link from "next/link";
import { Heart } from "lucide-react";
import { SignInButton } from "@/components/auth/account-buttons";
import { BottomNav } from "@/components/bottom-nav";
import { EventCard } from "@/components/event-card";
import { createClient } from "@/lib/supabase/server";
import type { NearRow } from "@/lib/types";

export const metadata = { title: "Guardados" };
export const dynamic = "force-dynamic";

type Point = Omit<NearRow, "distance_m" | "place_id"> & { occurrence_id: string };

/** Un evento por fila: su próxima fecha, o la última si ya pasó. */
function pickOccurrence(points: Point[]) {
  const now = Date.now();
  const byEvent = new Map<string, Point[]>();
  for (const p of points) byEvent.set(p.event_id, [...(byEvent.get(p.event_id) ?? []), p]);
  const upcoming: NearRow[] = [];
  const past: NearRow[] = [];
  for (const occ of byEvent.values()) {
    occ.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const next = occ.find((o) => new Date(o.ends_at ?? o.starts_at).getTime() >= now);
    const row = { ...(next ?? occ[occ.length - 1]), distance_m: 0, place_id: null };
    (next ? upcoming : past).push(row);
  }
  upcoming.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  past.sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return { upcoming, past };
}

function Empty({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-bg-2"><Heart size={28} className="text-ink-2" /></span>
      <p className="mt-4 text-[17px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[280px] text-[14px] text-ink-2">{body}</p>
      {children}
    </div>
  );
}

export default async function SavedPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  let lists: ReturnType<typeof pickOccurrence> | null = null;
  if (user) {
    const { data: saved } = await sb.from("saved_events").select("event_id");
    const ids = (saved ?? []).map((r) => r.event_id as string);
    const { data: points } = ids.length
      ? await sb.from("event_points_view").select("*").in("event_id", ids)
      : { data: [] };
    lists = pickOccurrence((points ?? []) as Point[]);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col px-5 pb-28 pt-8">
      <h1 className="text-[26px] font-bold">Guardados</h1>
      {!user ? (
        <Empty title="Guarda lo que no te quieres perder" body="Entra para ver tus guardados en cualquier dispositivo.">
          <div className="mt-6 w-full max-w-[320px]"><SignInButton /></div>
          <Link href="/" className="mt-4 text-[14px] font-semibold underline">Seguir explorando</Link>
        </Empty>
      ) : !lists || (lists.upcoming.length === 0 && lists.past.length === 0) ? (
        <Empty title="Aún no guardas nada" body="Toca el corazón en cualquier evento para tenerlo aquí.">
          <Link href="/" className="mt-6 rounded-control bg-ink px-5 py-3 text-[14px] font-semibold text-white">Explorar eventos</Link>
        </Empty>
      ) : (
        <div className="-mx-5 mt-4">
          {lists.upcoming.map((e) => <EventCard key={e.event_id} e={e} hideDistance />)}
          {lists.past.length > 0 && (
            <>
              <h2 className="px-5 pb-1 pt-8 text-[18px] font-bold text-ink-2">Ya pasaron</h2>
              <div className="opacity-70">{lists.past.map((e) => <EventCard key={e.event_id} e={e} hideDistance />)}</div>
            </>
          )}
        </div>
      )}
      <BottomNav />
    </main>
  );
}
