import Link from "next/link";
import { Heart } from "lucide-react";
import { SignInButton } from "@/components/auth/account-buttons";
import { BottomNav } from "@/components/bottom-nav";
import { EventCard } from "@/components/event-card";
import { eventRows } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Guardados" };
export const dynamic = "force-dynamic";

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

  let lists: Awaited<ReturnType<typeof eventRows>> | null = null;
  if (user) {
    const { data: saved } = await sb.from("saved_events").select("event_id");
    lists = await eventRows(sb, (saved ?? []).map((r) => r.event_id as string));
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
