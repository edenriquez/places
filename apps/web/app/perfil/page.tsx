import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Heart, Megaphone, Sparkles, Star } from "lucide-react";
import clsx from "clsx";
import { SignInButton, SignOutButton } from "@/components/auth/account-buttons";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopHeader } from "@/components/desktop";
import { SearchBar } from "@/components/location-picker";
import { accountSummary, type Submission } from "@/lib/account";
import { flyerUrl, fmtWhenShort } from "@/lib/format";
import { getLoc, hasLoc } from "@/lib/location-server";
import { municipalities } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL } from "@/lib/types";
import { Preferences } from "./preferences";

export const metadata = { title: "Perfil" };
export const dynamic = "force-dynamic";

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ icon, value, label, href }: { icon: React.ReactNode; value: number; label: string; href?: string }) {
  const body = (
    <>
      <span className="text-ink-2">{icon}</span>
      <span className="mt-2 block text-[26px] font-bold leading-none">{value}</span>
      <span className="mt-1 block text-[12px] font-medium text-ink-2">{label}</span>
    </>
  );
  const cls = "block rounded-card border border-line bg-white p-4 transition hover:border-line-2 hover:shadow-soft";
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

const SUB_STATUS: Record<Submission["status"], { label: string; cls: string }> = {
  queued: { label: "Recibido", cls: "bg-bg-2 text-ink-2" },
  processing: { label: "Recibido", cls: "bg-bg-2 text-ink-2" },
  needs_review: { label: "En revisión", cls: "bg-[#fff6e0] text-[#8a5a00]" },
  failed: { label: "En revisión", cls: "bg-[#fff6e0] text-[#8a5a00]" },
  approved: { label: "Publicado", cls: "bg-free-bg text-free" },
  rejected: { label: "No se publicó", cls: "bg-bg-2 text-ink-3" },
  duplicate: { label: "Ya lo teníamos", cls: "bg-bg-2 text-ink-3" },
};

function Organizer({ submissions }: { submissions: Submission[] }) {
  return (
    <section className="overflow-hidden rounded-card bg-ink text-white">
      <div className="p-5">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10"><Megaphone size={20} /></span>
        <h2 className="mt-4 text-[20px] font-bold leading-tight">¿Organizas algo?</h2>
        <p className="mt-1 text-[14px] text-white/70">Sube el flyer y cuéntanos de qué trata. Lo revisamos y lo publicamos gratis.</p>
        <Link href="/publicar" className="mt-5 inline-flex items-center gap-2 rounded-control bg-white px-4 py-2.5 text-[14px] font-semibold text-ink transition hover:gap-3">
          Publicar un evento <ArrowRight size={16} />
        </Link>
      </div>
      {submissions.length > 0 && (
        <ul className="divide-y divide-white/10 border-t border-white/10 bg-white/[0.04]">
          {submissions.map((s) => {
            const st = SUB_STATUS[s.status];
            const row = (
              <>
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-white/10">
                  {s.media_path && <Image src={flyerUrl(s.media_path)!} alt="" fill sizes="44px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{s.title ?? "Tu flyer"}</span>
                  <span className="block text-[12px] text-white/60">Enviado el {new Date(s.received_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
                </span>
                <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", st.cls)}>{st.label}</span>
              </>
            );
            return (
              <li key={s.id}>
                {s.event_slug ? (
                  <Link href={`/evento/${s.event_slug}`} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04]">{row}</Link>
                ) : (
                  <div className="flex items-center gap-3 px-5 py-3">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default async function ProfilePage() {
  const sb = await createClient();
  const [munis, loc, isSet, { data: { user } }] = await Promise.all([municipalities(), getLoc(), hasLoc(), sb.auth.getUser()]);
  const header = <DesktopHeader><SearchBar loc={loc} municipalities={munis} isSet={isSet} header /></DesktopHeader>;

  if (!user) {
    return (
      <>
        {header}
        <main className="mx-auto max-w-[720px] space-y-4 px-5 pb-28 pt-8 lg:pt-12">
          <h1 className="text-[26px] font-bold">Perfil</h1>
          <section className="rounded-card border border-line bg-white p-6">
            <h2 className="text-[22px] font-bold leading-tight">Haz tuyo entrelugares</h2>
            <p className="mt-1 text-[14px] text-ink-2">Sin cuenta puedes explorar todo. Con cuenta, además:</p>
            <ul className="mt-5 space-y-3.5 text-[15px]">
              <li className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent"><Heart size={18} /></span>Guarda eventos y encuéntralos en cualquier dispositivo</li>
              <li className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#fff6e0] text-[#b37700]"><Star size={18} /></span>Dile a los demás que vas con &ldquo;Me interesa&rdquo;</li>
              <li className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-bg-2 text-ink"><Sparkles size={18} /></span>Ve primero lo que te late</li>
            </ul>
            <SignInButton className="mt-6" />
          </section>
          <Organizer submissions={[]} />
        </main>
        <BottomNav />
      </>
    );
  }

  const s = await accountSummary(sb, user.id);
  const meta = user.user_metadata ?? {};
  const name: string = meta.full_name ?? meta.name ?? user.email ?? "";
  const avatar: string | undefined = meta.avatar_url ?? meta.picture;
  const since = new Date(user.created_at).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const maxWeight = s.topCategories[0]?.[1] ?? 1;

  return (
    <>
      {header}
      <main className="mx-auto max-w-[720px] space-y-4 px-5 pb-28 pt-8 lg:max-w-[1080px] lg:px-8 lg:pt-12">
        <header className="flex items-center gap-4 pb-2">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo de Google
            <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-[72px] w-[72px] rounded-full object-cover ring-4 ring-bg-2" />
          ) : (
            <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-bg-2 text-[26px] font-bold text-ink-2">{name.slice(0, 1).toUpperCase()}</span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-[24px] font-bold leading-tight">{name}</h1>
            <p className="truncate text-[13px] text-ink-2">{user.email}</p>
            <p className="mt-0.5 text-[12px] text-ink-3">En entrelugares desde {since}</p>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3 lg:gap-4">
          <Stat icon={<Heart size={18} />} value={s.savedCount} label="Guardados" href="/guardados" />
          <Stat icon={<Star size={18} />} value={s.interestCount} label="Te interesan" />
          <Stat icon={<CalendarDays size={18} />} value={s.upcomingCount} label="Próximos" />
        </div>

        <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-4">
        <Section
          title="Tu agenda"
          subtitle="Lo próximo que guardaste o te interesa"
          action={s.savedCount > 0 && <Link href="/guardados" className="shrink-0 text-[13px] font-semibold underline">Ver todo</Link>}
        >
          {s.agenda.length ? (
            <ul className="-mx-2 space-y-1">
              {s.agenda.map((e) => (
                <li key={e.event_id}>
                  <Link href={`/evento/${e.slug}`} className="flex items-center gap-3 rounded-control p-2 transition hover:bg-bg-2">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[12px] bg-bg-2">
                      {e.image_path && <Image src={flyerUrl(e.image_path)!} alt="" fill sizes="56px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{e.title}</span>
                      <span className="block truncate text-[13px] text-ink-2">{fmtWhenShort(e.starts_at, e.is_all_day)} · {e.municipality_name}</span>
                    </span>
                    {e.going && <span className="flex shrink-0 items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-white"><Star size={11} className="fill-[#ffb400] text-[#ffb400]" /> Vas</span>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-ink-2">Toca el corazón o &ldquo;Me interesa&rdquo; en un evento y aparecerá aquí. <Link href="/" className="font-semibold text-ink underline">Explorar</Link></p>
          )}
        </Section>

        <Section title="Lo que te mueve" subtitle="Según lo que guardas y te interesa">
          {s.topCategories.length ? (
            <ul className="space-y-3">
              {s.topCategories.map(([cat, w]) => (
                <li key={cat} className="grid grid-cols-[110px_1fr] items-center gap-3 text-[14px]">
                  <span className="truncate font-medium">{CATEGORY_LABEL[cat]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-bg-2">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(8, (w / maxWeight) * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-ink-2">Aún no hay suficiente actividad. Mientras, cuéntanos tus gustos aquí abajo.</p>
          )}
        </Section>

        <Section title="Tus gustos" subtitle="Nos ayudan a mostrarte primero lo que te late">
          <Preferences initial={s.profile} municipalities={munis} />
        </Section>

        </div>

        <aside className="space-y-4 lg:sticky lg:top-[100px]">
          <Organizer submissions={s.submissions} />
          <div className="flex justify-center pt-4 lg:justify-start lg:pt-0"><SignOutButton /></div>
        </aside>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
