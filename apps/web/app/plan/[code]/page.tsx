import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, ChevronRight, Lock, MapPin, MessageSquareQuote, Users } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { BottomNav } from "@/components/bottom-nav";
import { Flyer } from "@/components/event-card";
import { Avatar } from "@/components/plans/avatars";
import { JoinButton } from "@/components/plans/join-button";
import { LeaveButton, OpenToggle, RemovePerson } from "@/components/plans/plan-manage";
import { PlanShare } from "@/components/plans/plan-share";
import { flyerUrl, fmtWhenLong, fmtWhenShort } from "@/lib/format";
import { planIsOver, spotsLeft, targetHref, withWhom, type GroupPlan } from "@/lib/group-plans";
import { NO_INDEX } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

const planByCode = cache(async (code: string) => {
  if (!/^[0-9a-f]{18}$/.test(code)) return null;
  const sb = await createClient();
  const [{ data }, { data: { user } }] = await Promise.all([sb.rpc("plan_by_code", { p_code: code }), sb.auth.getUser()]);
  return data ? { plan: data as GroupPlan & { code: string }, user } : null;
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const r = await planByCode((await params).code);
  if (!r) return { title: "Plan no encontrado", robots: NO_INDEX };
  const { plan } = r;
  const title = `${plan.host?.name ?? "Alguien"} te invita: ${plan.target.title}`;
  const description = `${fmtWhenShort(plan.starts_at, plan.is_all_day)} · ${[plan.target.place_name, plan.target.municipality_name].filter(Boolean).join(", ")}. Únete y les aparece a todos en el calendario.`;
  const img = flyerUrl(plan.target.image_path);
  return {
    title,
    description,
    robots: NO_INDEX,
    openGraph: { title, description, ...(img && { images: [{ url: img, alt: plan.target.title }] }) },
  };
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-ink-2">{icon}</span>
      <div className="min-w-0 text-[15px]">{children}</div>
    </li>
  );
}

export default async function PlanPage({ params }: Params) {
  const r = await planByCode((await params).code);
  if (!r) notFound();
  const { plan: p, user } = r;
  const member = !!p.role;
  const over = p.status === "cancelled" || planIsOver(p);
  const left = spotsLeft(p);
  const host = p.host?.name ?? "Alguien";
  const heir = p.people.find((x) => x.id !== user?.id)?.name;
  const href = targetHref(p.target);

  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col pb-28 lg:pt-6">
      <div className="relative">
        <Link href={href} className="block">
          <Flyer path={p.target.image_path} focus={{ x: p.target.image_focus_x, y: p.target.image_focus_y }} alt={p.target.title}
            sizes="(max-width: 640px) 100vw, 640px" className="aspect-[2/1] lg:rounded-card" eager />
        </Link>
        <BackButton className="absolute left-4 top-[max(env(safe-area-inset-top),12px)] grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft" />
      </div>

      <div className="space-y-6 px-5 pt-5">
        <header>
          <p className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-accent">
            {p.is_open ? <Users size={15} /> : <Lock size={14} />}
            {member ? (p.role === "host" ? "Tu plan" : `Plan de ${host}`) : `${host} te invita`}
            {p.is_open && <span className="font-semibold normal-case tracking-normal text-ink-2">· abierto</span>}
          </p>
          <Link href={href} className="mt-1 block text-[26px] font-bold leading-tight">{p.target.title}</Link>
        </header>

        <ul className="space-y-3">
          <Row icon={<CalendarDays size={19} />}>{fmtWhenLong(p.starts_at, p.ends_at, p.is_all_day)}</Row>
          <Row icon={<MapPin size={19} />}>
            {p.meeting_point ? <><span className="font-medium">Se ven en {p.meeting_point}</span><br /></> : null}
            <span className={p.meeting_point ? "text-[13px] text-ink-2" : ""}>{[p.target.place_name, p.target.municipality_name].filter(Boolean).join(", ")}</span>
          </Row>
          {p.note && (
            <Row icon={<MessageSquareQuote size={19} />}>
              <span className="text-ink-2">&ldquo;{p.note}&rdquo;</span>
            </Row>
          )}
        </ul>

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-bold">Van {p.going}</h2>
            {!over && <span className="text-[13px] text-ink-2">{left ? `${left === 1 ? "queda 1 lugar" : `quedan ${left} lugares`}` : "lleno"}</span>}
          </div>
          <ul className="mt-2 divide-y divide-line">
            {p.people.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2.5">
                <Avatar p={x} size={36} />
                <span className="min-w-0 flex-1 text-[15px] font-medium">
                  {x.id === user?.id ? "Tú" : x.name}
                  {x.id === p.host?.id && <span className="ml-2 rounded-full bg-bg-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">Lo armó</span>}
                </span>
                {p.role === "host" && x.id !== user?.id && !over && <RemovePerson planId={p.id} person={x} />}
              </li>
            ))}
          </ul>
        </section>

        {over ? (
          <p className="rounded-card bg-bg-2 p-4 text-center text-[14px] text-ink-2">
            {p.status === "cancelled" ? "Este plan se canceló." : "Este plan ya pasó."}{" "}
            <Link href={href} className="font-semibold text-ink underline">Ver {p.target.kind === "event" ? "el evento" : "la experiencia"}</Link>
          </p>
        ) : member ? (
          <section className="space-y-5 rounded-card border border-line p-4">
            <div>
              <p className="text-[15px] font-semibold">{withWhom(p.people, user?.id)}</p>
              <p className="text-[13px] text-ink-2">Invita a quien quieras: cuando se una, les aparece a todos en sus planes y en el calendario.</p>
              <PlanShare p={p} className="mt-3" />
            </div>
            {p.role === "host" && <div className="border-t border-line pt-4"><OpenToggle p={p} /></div>}
          </section>
        ) : left === 0 ? (
          <p className="rounded-card bg-bg-2 p-4 text-center text-[14px] text-ink-2">
            Este plan ya se llenó. <Link href={href} className="font-semibold text-ink underline">Arma el tuyo</Link>
          </p>
        ) : (
          <section className="rounded-card border border-line p-4">
            <JoinButton code={p.code} eventId={p.target.kind === "event" ? p.target.id : undefined} label="Me apunto" className="w-full !rounded-control py-3 text-[15px]" />
            <p className="mt-3 text-center text-[13px] text-ink-2">
              Al unirte, el plan aparece en tus planes y en los de {host}, con aviso un día antes. {host} y quienes van verán tu nombre y tu foto.
            </p>
          </section>
        )}

        <Link href={href} className="flex items-center justify-between rounded-card border border-line p-4 text-[15px] font-semibold hover:border-ink">
          {p.target.kind === "event" ? "Ver el evento completo" : "Ver la experiencia completa"}
          <ChevronRight size={18} className="text-ink-3" />
        </Link>

        {member && !over && <LeaveButton p={p} heir={heir} />}
      </div>
      <BottomNav />
    </main>
  );
}
