import Link from "next/link";
import type { Metadata } from "next";
import clsx from "clsx";
import { BellRing, CalendarHeart, MessageCircle } from "lucide-react";
import { NO_INDEX } from "@/lib/site";
import { SignInButton } from "@/components/auth/account-buttons";
import { BottomNav } from "@/components/bottom-nav";
import { Flyer } from "@/components/event-card";
import { SaveButton } from "@/components/save-button";
import { SharePlan } from "@/components/share-plan";
import { eventRows } from "@/lib/account";
import { fmtTime, fmtWhenShort } from "@/lib/format";
import { BUCKET_TITLE, bucketOf, eventUrl, reminderText, whatsappShare, type PlanBucket } from "@/lib/plans";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { NearRow } from "@/lib/types";

export const metadata: Metadata = { title: "Mis planes", robots: NO_INDEX };
export const dynamic = "force-dynamic";

function Empty({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-bg-2"><CalendarHeart size={28} className="text-ink-2" /></span>
      <p className="mt-4 text-[17px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[290px] text-[14px] text-ink-2">{body}</p>
      {children}
    </div>
  );
}

/** El próximo plan, grande: "Tu plan es mañana a las 18:00" y a compartirlo con quien va. */
function NextPlan({ e, text, going }: { e: NearRow; text: string; going: boolean }) {
  return (
    <section className="mt-5 overflow-hidden rounded-card border border-line shadow-soft">
      <Link href={`/evento/${e.slug}`} className="block">
        <Flyer path={e.image_path} focus={{ x: e.image_focus_x, y: e.image_focus_y }} alt={e.title} sizes="(max-width: 640px) 100vw, 640px" className="aspect-[2/1]" eager />
      </Link>
      <div className="p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-accent"><BellRing size={15} /> {text}</p>
        <Link href={`/evento/${e.slug}`} className="mt-1 block text-[20px] font-bold leading-tight">{e.title}</Link>
        <p className="mt-1 text-[14px] text-ink-2">
          {e.place_name ? `${e.place_name} · ` : ""}{e.municipality_name}{going ? " · Vas" : ""}
        </p>
        <p className="mt-3 text-[13px] font-semibold text-ink-2">¿Con quién vas? Mándaselo:</p>
        <SharePlan p={e} labels className="mt-2 flex-wrap" />
      </div>
    </section>
  );
}

function PlanRow({ e, going, past }: { e: NearRow; going: boolean; past?: boolean }) {
  return (
    <li className={clsx("flex items-center gap-3 py-3", past && "opacity-60")}>
      <Link href={`/evento/${e.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Flyer path={e.image_path} focus={{ x: e.image_focus_x, y: e.image_focus_y }} alt={e.title} sizes="80px" className="h-[72px] w-[80px] shrink-0 rounded-[12px]" />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
            {fmtWhenShort(e.starts_at, e.is_all_day)}
            {going && <span className="rounded-full bg-free-bg px-1.5 py-px text-[11px] font-bold text-free">Vas</span>}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[15px] font-semibold leading-snug">{e.title}</span>
          <span className="block truncate text-[13px] text-ink-2">{e.municipality_name}</span>
        </span>
      </Link>
      {!past && <SharePlan p={e} className="hidden shrink-0 sm:flex" />}
      <SaveButton eventId={e.event_id} variant="icon" />
    </li>
  );
}

const ORDER: PlanBucket[] = ["ahora", "hoy", "manana", "finde", "despues"];

/** Texto para mandar al grupo: "Mis planes del finde: …" */
function weekendShare(plans: NearRow[]) {
  const lines = plans.map((e) => `• ${e.title} · ${fmtWhenShort(e.starts_at, e.is_all_day)} · ${eventUrl(SITE_URL, e.slug, "whatsapp")}`);
  return `Mis planes del finde 🙌\n${lines.join("\n")}\n¿Quién se apunta?`;
}

export default async function PlansPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  let lists: Awaited<ReturnType<typeof eventRows>> | null = null;
  let interested = new Set<string>();
  if (user) {
    const [{ data: saved }, { data: going }] = await Promise.all([
      sb.from("saved_events").select("event_id"),
      sb.from("event_interests").select("event_id"),
    ]);
    interested = new Set((going ?? []).map((r) => r.event_id as string));
    lists = await eventRows(sb, [...new Set([...(saved ?? []), ...(going ?? [])].map((r) => r.event_id as string))]);
  }

  const now = new Date();
  const groups = new Map<PlanBucket, NearRow[]>();
  for (const e of lists?.upcoming ?? []) groups.set(bucketOf(e, now), [...(groups.get(bucketOf(e, now)) ?? []), e]);
  const next = lists?.upcoming[0];
  const nextText = next ? reminderText(next, now) : null;
  const thisWeekend = ORDER.slice(0, 4).flatMap((b) => groups.get(b) ?? []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col px-5 pb-28 pt-8">
      <h1 className="text-[26px] font-bold">Mis planes</h1>
      {lists && lists.upcoming.length > 0 && (
        <p className="mt-0.5 text-[14px] text-ink-2">
          {lists.upcoming.length} {lists.upcoming.length === 1 ? "plan" : "planes"} por delante
          {next && !nextText ? ` · el próximo: ${fmtWhenShort(next.starts_at, next.is_all_day).toLowerCase()}` : ""}
        </p>
      )}
      {!user ? (
        <Empty title="Arma tus planes del finde" body="Guarda eventos o marca “Me interesa” y te avisamos un día antes. Entra para verlos en cualquier dispositivo.">
          <div className="mt-6 w-full max-w-[320px]"><SignInButton /></div>
          <Link href="/" className="mt-4 text-[14px] font-semibold underline">Seguir explorando</Link>
        </Empty>
      ) : !lists || (lists.upcoming.length === 0 && lists.past.length === 0) ? (
        <Empty title="Aún no tienes planes" body="Toca el corazón o “Me interesa” en cualquier evento y aparece aquí, con aviso un día antes.">
          <Link href="/" className="mt-6 rounded-control bg-ink px-5 py-3 text-[14px] font-semibold text-white">¿Qué quieres hacer este fin?</Link>
        </Empty>
      ) : (
        <>
          {next && nextText && <NextPlan e={next} text={nextText} going={interested.has(next.event_id)} />}

          {thisWeekend.length > 1 && (
            <a href={whatsappShare(weekendShare(thisWeekend))} target="_blank" rel="noreferrer" data-track="share_whatsapp"
              className="mt-4 flex items-center justify-center gap-2 rounded-control bg-whatsapp px-5 py-3 text-[15px] font-semibold text-white">
              <MessageCircle size={18} /> Compartir mis planes del finde
            </a>
          )}

          {ORDER.map((b) => {
            const rows = (groups.get(b) ?? []).filter((e) => !(nextText && e.event_id === next?.event_id));
            if (!rows.length) return null;
            return (
              <section key={b} className="mt-7">
                <h2 className="text-[18px] font-bold">
                  {BUCKET_TITLE[b]}
                  {b === "hoy" && rows[0] && !rows[0].is_all_day && <span className="ml-2 text-[14px] font-medium text-ink-2">desde las {fmtTime(rows[0].starts_at)}</span>}
                </h2>
                <ul className="divide-y divide-line/60">
                  {rows.map((e) => <PlanRow key={e.event_id} e={e} going={interested.has(e.event_id)} />)}
                </ul>
              </section>
            );
          })}

          {lists.past.length > 0 && (
            <section className="mt-8">
              <h2 className="text-[18px] font-bold text-ink-2">Ya pasaron</h2>
              <ul className="divide-y divide-line/60">
                {lists.past.map((e) => <PlanRow key={e.event_id} e={e} going={interested.has(e.event_id)} past />)}
              </ul>
            </section>
          )}
        </>
      )}
      <BottomNav />
    </main>
  );
}
