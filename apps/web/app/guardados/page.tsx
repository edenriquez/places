import Link from "next/link";
import type { Metadata } from "next";
import clsx from "clsx";
import { BellRing, CalendarHeart, MessageCircle, Star, Users } from "lucide-react";
import { NO_INDEX } from "@/lib/site";
import { SignInButton } from "@/components/auth/account-buttons";
import { BottomNav } from "@/components/bottom-nav";
import { Flyer } from "@/components/event-card";
import { Avatars } from "@/components/plans/avatars";
import { CalendarSync } from "@/components/plans/calendar-sync";
import { JoinButton } from "@/components/plans/join-button";
import { PlanShare } from "@/components/plans/plan-share";
import { SaveButton } from "@/components/save-button";
import { SharePlan } from "@/components/share-plan";
import { eventRows } from "@/lib/account";
import { fmtTime, fmtWhenShort } from "@/lib/format";
import { planIsOver, planUrl, spotsLeft, targetHref, whoGoes, withWhom, type GroupPlan } from "@/lib/group-plans";
import { nearText } from "@/lib/location";
import { getLoc } from "@/lib/location-server";
import { BUCKET_TITLE, bucketOf, eventUrl, reminderText, whatsappShare, type PlanBucket } from "@/lib/plans";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { NearRow } from "@/lib/types";

export const metadata: Metadata = { title: "Mis planes", robots: NO_INDEX };
export const dynamic = "force-dynamic";

/** Una fila del itinerario: un evento que guardaste o te interesa, o un plan en grupo (evento o experiencia). */
type Item =
  | { kind: "event"; key: string; starts_at: string; ends_at: string | null; is_all_day: boolean; e: NearRow; going: boolean; interested: number }
  | { kind: "plan"; key: string; starts_at: string; ends_at: string | null; is_all_day: boolean; p: GroupPlan };

function Empty({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 flex flex-col items-center justify-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-bg-2"><CalendarHeart size={28} className="text-ink-2" /></span>
      <p className="mt-4 text-[17px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[290px] text-[14px] text-ink-2">{body}</p>
      {children}
    </div>
  );
}

/** El próximo plan, grande: "Tu plan es mañana a las 18:00" y a compartirlo con quien va. */
function NextPlan({ item, text, meId }: { item: Item; text: string; meId: string }) {
  const t = item.kind === "plan" ? item.p.target : null;
  const e = item.kind === "event" ? item.e : null;
  const href = item.kind === "plan" ? `/plan/${item.p.code}` : `/evento/${e!.slug}`;
  const img = t ?? e!;
  const title = t?.title ?? e!.title;
  return (
    <section className="mt-5 overflow-hidden rounded-card border border-line shadow-soft">
      <Link href={href} className="block">
        <Flyer path={img.image_path} focus={{ x: img.image_focus_x, y: img.image_focus_y }} alt={title} sizes="(max-width: 640px) 100vw, 640px" className="aspect-[2/1]" eager />
      </Link>
      <div className="p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-accent"><BellRing size={15} /> {text}</p>
        <Link href={href} className="mt-1 block text-[20px] font-bold leading-tight">{title}</Link>
        {item.kind === "plan" ? (
          <>
            <p className="mt-1 text-[14px] text-ink-2">
              {item.p.meeting_point ? `Se ven en ${item.p.meeting_point} · ` : t!.place_name ? `${t!.place_name} · ` : ""}{t!.municipality_name}
            </p>
            <div className="mt-3 flex items-center gap-2.5">
              <Avatars people={item.p.people} total={item.p.going} size={30} />
              <p className="text-[14px] font-semibold">{withWhom(item.p.people, meId)}</p>
            </div>
            {item.p.code && <PlanShare p={{ ...item.p, code: item.p.code }} className="mt-3" />}
          </>
        ) : (
          <>
            <p className="mt-1 text-[14px] text-ink-2">
              {e!.place_name ? `${e!.place_name} · ` : ""}{e!.municipality_name}{item.going ? " · Vas" : ""}
            </p>
            <p className="mt-3 text-[13px] font-semibold text-ink-2">¿Con quién vas? <Link href={`/evento/${e!.slug}#plan`} className="text-ink underline">Arma un plan</Link> o mándaselo:</p>
            <SharePlan p={e!} labels className="mt-2 flex-wrap" />
          </>
        )}
      </div>
    </section>
  );
}

function EventRow({ item, past }: { item: Extract<Item, { kind: "event" }>; past?: boolean }) {
  const { e, going, interested } = item;
  const others = interested - (going ? 1 : 0);
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
          <span className="block truncate text-[13px] text-ink-2">
            {e.municipality_name}{!past && others >= 1 ? ` · ${others} ${others === 1 ? "persona más interesada" : "personas más interesadas"}` : ""}
          </span>
        </span>
      </Link>
      {!past && (
        <Link href={`/evento/${e.slug}#plan`} aria-label="Armar un plan con más gente"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-2 text-ink hover:bg-bg-2">
          <Users size={17} />
        </Link>
      )}
      {!past && <SharePlan p={e} className="hidden shrink-0 sm:flex" />}
      <SaveButton eventId={e.event_id} variant="icon" />
    </li>
  );
}

function GroupRow({ p, meId, past }: { p: GroupPlan; meId: string; past?: boolean }) {
  return (
    <li className={clsx("py-3", past && "opacity-60")}>
      <Link href={`/plan/${p.code}`} className="flex items-center gap-3">
        <Flyer path={p.target.image_path} focus={{ x: p.target.image_focus_x, y: p.target.image_focus_y }} alt={p.target.title} sizes="80px" className="h-[72px] w-[80px] shrink-0 rounded-[12px]" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
            {fmtWhenShort(p.starts_at, p.is_all_day)}
            <span className="rounded-full bg-accent-soft px-1.5 py-px text-[11px] font-bold text-accent">{p.is_open ? "Grupo abierto" : "En grupo"}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[15px] font-semibold leading-snug">{p.target.title}</span>
          <span className="mt-1 flex items-center gap-2">
            <Avatars people={p.people} total={p.going} size={22} max={3} />
            <span className="truncate text-[13px] text-ink-2">{withWhom(p.people, meId)}</span>
          </span>
        </span>
      </Link>
      {!past && p.code && p.going < 2 && <PlanShare p={{ ...p, code: p.code }} compact className="mt-2 pl-[92px]" />}
    </li>
  );
}

/** Planes abiertos de otras personas cerca: lo que convierte "me interesa" en ir con alguien. */
function OpenPlans({ plans, where }: { plans: GroupPlan[]; where: string }) {
  if (!plans.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-[18px] font-bold">Súmate a un plan</h2>
      <p className="text-[13px] text-ink-2">Grupos abiertos {where}. Primero, los de eventos que te interesan.</p>
      <div className="no-scrollbar -mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
        {plans.map((p) => {
          const left = spotsLeft(p);
          return (
            <article key={p.id} className="w-[260px] shrink-0 overflow-hidden rounded-card border border-line">
              <Link href={targetHref(p.target)} className="block">
                <div className="relative">
                  <Flyer path={p.target.image_path} focus={{ x: p.target.image_focus_x, y: p.target.image_focus_y }} alt={p.target.title} sizes="260px" className="aspect-[16/9]" />
                  {p.interested && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-ink">
                      <Star size={11} className="fill-[#ffb400] text-[#ffb400]" /> Te interesa
                    </span>
                  )}
                </div>
                <div className="px-3 pt-3">
                  <p className="text-[12px] font-semibold text-ink-2">{fmtWhenShort(p.starts_at, p.is_all_day)}</p>
                  <p className="line-clamp-1 text-[15px] font-semibold">{p.target.title}</p>
                  <p className="truncate text-[12px] text-ink-3">{p.meeting_point ? `Se ven en ${p.meeting_point}` : p.target.municipality_name}</p>
                </div>
              </Link>
              <div className="flex items-center gap-2 p-3">
                <Avatars people={p.people} total={p.going} size={26} max={3} />
                <span className="min-w-0 flex-1 text-[12px] leading-tight text-ink-2">
                  {whoGoes(p)}{left <= 3 ? ` · ${left === 1 ? "1 lugar" : `${left} lugares`}` : ""}
                </span>
                <JoinButton planId={p.id} eventId={p.target.kind === "event" ? p.target.id : undefined} className="shrink-0 !px-3 !py-1.5 text-[13px]" />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const ORDER: PlanBucket[] = ["ahora", "hoy", "manana", "finde", "despues"];

/** Texto para mandar al grupo: "Mis planes del finde: …" */
function weekendShare(items: Item[]) {
  const lines = items.map((i) => i.kind === "plan"
    ? `• ${i.p.target.title} · ${fmtWhenShort(i.starts_at, i.is_all_day)} · ${i.p.code ? planUrl(i.p.code, "whatsapp") : ""}`
    : `• ${i.e.title} · ${fmtWhenShort(i.starts_at, i.is_all_day)} · ${eventUrl(SITE_URL, i.e.slug, "whatsapp")}`);
  return `Mis planes del finde 🙌\n${lines.join("\n")}\n¿Quién se apunta?`;
}

export default async function PlansPage() {
  const sb = await createClient();
  const [{ data: { user } }, loc] = await Promise.all([sb.auth.getUser(), getLoc()]);

  let upcoming: Item[] = [];
  let past: Item[] = [];
  let open: GroupPlan[] = [];
  if (user) {
    const [{ data: saved }, { data: going }, { data: mine }, { data: near }] = await Promise.all([
      sb.from("saved_events").select("event_id"),
      sb.from("event_interests").select("event_id"),
      sb.rpc("my_plans"),
      sb.rpc("open_plans_near", { p_lat: loc.lat, p_lng: loc.lng, p_radius_m: loc.stateCve ? 150000 : loc.radiusKm * 1000 }),
    ]);
    const plans = (mine ?? []) as GroupPlan[];
    open = (near ?? []) as GroupPlan[];
    const interested = new Set((going ?? []).map((r) => r.event_id as string));
    // un evento con plan en grupo se ve como el plan (con quién vas), no dos veces
    const planned = new Set(plans.filter((p) => p.target.kind === "event").map((p) => p.target.id));
    const ids = [...new Set([...(saved ?? []), ...(going ?? [])].map((r) => r.event_id as string))].filter((id) => !planned.has(id));
    const [lists, { data: counts }] = await Promise.all([
      eventRows(sb, ids),
      ids.length ? sb.rpc("interest_counts", { event_ids: ids }) : Promise.resolve({ data: [] }),
    ]);
    const n = new Map(((counts ?? []) as { event_id: string; n: number }[]).map((c) => [c.event_id, c.n]));
    const ev = (e: NearRow): Item => ({
      kind: "event", key: e.event_id, starts_at: e.starts_at, ends_at: e.ends_at, is_all_day: e.is_all_day,
      e, going: interested.has(e.event_id), interested: n.get(e.event_id) ?? 0,
    });
    const pl = (p: GroupPlan): Item => ({ kind: "plan", key: p.id, starts_at: p.starts_at, ends_at: p.ends_at, is_all_day: p.is_all_day, p });
    upcoming = [...lists.upcoming.map(ev), ...plans.filter((p) => !planIsOver(p)).map(pl)].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    past = [...lists.past.map(ev), ...plans.filter((p) => planIsOver(p)).map(pl)].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  }

  const now = new Date();
  const groups = new Map<PlanBucket, Item[]>();
  for (const i of upcoming) groups.set(bucketOf(i, now), [...(groups.get(bucketOf(i, now)) ?? []), i]);
  const next = upcoming[0];
  const nextText = next ? reminderText(next, now) : null;
  const thisWeekend = ORDER.slice(0, 4).flatMap((b) => groups.get(b) ?? []);
  const withPeople = upcoming.filter((i) => i.kind === "plan" && i.p.going > 1).length;

  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col px-5 pb-28 pt-8">
      <h1 className="text-[26px] font-bold">Mis planes</h1>
      {upcoming.length > 0 && (
        <p className="mt-0.5 text-[14px] text-ink-2">
          {upcoming.length} {upcoming.length === 1 ? "plan" : "planes"} por delante
          {withPeople ? ` · ${withPeople} con más gente` : ""}
          {next && !nextText ? ` · el próximo: ${fmtWhenShort(next.starts_at, next.is_all_day).toLowerCase()}` : ""}
        </p>
      )}
      {!user ? (
        <Empty title="Arma tus planes del finde" body="Guarda eventos, marca “Me interesa” o arma un plan con más gente y te avisamos un día antes. Entra para verlos en cualquier dispositivo.">
          <div className="mt-6 w-full max-w-[320px]"><SignInButton /></div>
          <Link href="/" className="mt-4 text-[14px] font-semibold underline">Seguir explorando</Link>
        </Empty>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <>
          <Empty title="Aún no tienes planes" body="Toca el corazón o “Me interesa” en cualquier evento, o arma un plan e invita: aparece aquí, con aviso un día antes.">
            <Link href="/" className="mt-6 rounded-control bg-ink px-5 py-3 text-[14px] font-semibold text-white">¿Qué quieres hacer este fin?</Link>
          </Empty>
          <OpenPlans plans={open} where={nearText(loc)} />
        </>
      ) : (
        <>
          {next && nextText && <NextPlan item={next} text={nextText} meId={user.id} />}

          {thisWeekend.length > 1 && (
            <a href={whatsappShare(weekendShare(thisWeekend))} target="_blank" rel="noreferrer" data-track="share_whatsapp"
              className="mt-4 flex items-center justify-center gap-2 rounded-control bg-whatsapp px-5 py-3 text-[15px] font-semibold text-white">
              <MessageCircle size={18} /> Compartir mis planes del finde
            </a>
          )}

          <OpenPlans plans={open} where={nearText(loc)} />

          {ORDER.map((b) => {
            const rows = (groups.get(b) ?? []).filter((i) => !(nextText && i.key === next?.key));
            if (!rows.length) return null;
            return (
              <section key={b} className="mt-7">
                <h2 className="text-[18px] font-bold">
                  {BUCKET_TITLE[b]}
                  {b === "hoy" && rows[0] && !rows[0].is_all_day && <span className="ml-2 text-[14px] font-medium text-ink-2">desde las {fmtTime(rows[0].starts_at)}</span>}
                </h2>
                <ul className="divide-y divide-line/60">
                  {rows.map((i) => i.kind === "plan" ? <GroupRow key={i.key} p={i.p} meId={user.id} /> : <EventRow key={i.key} item={i} />)}
                </ul>
              </section>
            );
          })}

          {past.length > 0 && (
            <section className="mt-8">
              <h2 className="text-[18px] font-bold text-ink-2">Ya pasaron</h2>
              <ul className="divide-y divide-line/60">
                {past.map((i) => i.kind === "plan" ? <GroupRow key={i.key} p={i.p} meId={user.id} past /> : <EventRow key={i.key} item={i} past />)}
              </ul>
            </section>
          )}
        </>
      )}
      {user && <CalendarSync />}
      <BottomNav />
    </main>
  );
}
