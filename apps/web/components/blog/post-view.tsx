import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, Clock, MessageCircle, Plus } from "lucide-react";
import { BottomNav } from "../bottom-nav";
import { JsonLd } from "../json-ld";
import { BlogHeader } from "./blog-header";
import { CopyLink, EventsPill } from "./guide-client";
import { guideEvents, PostEvents, PostEventsRail } from "./post-events";
import { eventWindow, fmtPostDate, inlineHtml, postBySlug, relatedPosts, translationOf, type PostMeta } from "@/lib/blog";
import { BLOG_BASE, BLOG_COPY, LANG_TAG, postPath, type Locale } from "@/lib/blog-copy";
import { whatsappShare } from "@/lib/plans";
import { municipalities } from "@/lib/queries";
import { absUrl } from "@/lib/site";
import { breadcrumbs, guideEventsList, postGraph } from "@/lib/structured-data";
import type { Municipality } from "@/lib/types";

/** Todos los municipios por slug; sin BD la guía sale sin ellos. */
export async function municipalityMap(): Promise<Map<string, Municipality>> {
  try {
    return new Map((await municipalities()).map((m) => [m.slug, m]));
  } catch {
    return new Map();
  }
}

/** Municipios de una guía en el orden del encabezado. */
const pick = (slugs: string[], bySlug: Map<string, Municipality>) => slugs.map((s) => bySlug.get(s)).filter((m): m is Municipality => !!m);

/** Portada de una guía: la del primer municipio que tenga foto. */
export const coverOf = (p: PostMeta, bySlug: Map<string, Municipality>) => pick(p.municipios, bySlug).find((m) => m.cover_image_url);

const delay = (i: number) => ({ "--i": i }) as React.CSSProperties;

export async function PostView({ slug, locale }: { slug: string; locale: Locale }) {
  const p = await postBySlug(slug, locale);
  if (!p) notFound();
  const c = BLOG_COPY[locale];
  const [bySlug, translation, related] = await Promise.all([municipalityMap(), translationOf(p), relatedPosts(p)]);
  const munis = pick(p.municipios, bySlug);
  const cover = munis.find((m) => m.cover_image_url);
  const range = p.eventos ? eventWindow(p.eventos) : undefined;
  const events = munis.length ? await guideEvents(munis, range) : { events: [], past: false, upcoming: false };
  const showEvents = !!range || events.events.length > 0;
  const eventsTitle = !p.eventos || "desde" in p.eventos ? c.events : p.eventos.rango === "fin-de-semana" ? c.eventsWeekend : c.eventsNext(p.eventos.dias);
  // el bloque completo va en el marcador del texto; las guías sin fechas lo llevan al final
  const eventsAt = range ? p.eventsAt : p.toc.length;
  const before = range ? p.before : p.before + p.after;
  const after = range ? p.after : "";
  const toc = [
    ...p.toc.slice(0, eventsAt),
    ...(showEvents ? [{ id: "eventos", label: events.upcoming ? c.railUpcoming : eventsTitle }] : []),
    ...p.toc.slice(eventsAt),
    ...(p.faq.length ? [{ id: "preguntas", label: c.faq }] : []),
  ];
  const path = postPath(p.slug, locale);

  return (
    <main lang={LANG_TAG[locale]} className="mx-auto max-w-[680px] px-5 pb-28 pt-6 lg:pt-10">
      <div className="read-progress" aria-hidden />
      <JsonLd
        data={[
          ...postGraph(p, munis, translation),
          ...guideEventsList(p, events.events),
          breadcrumbs([{ name: c.explore, path: "/" }, { name: c.blog, path: BLOG_BASE[locale] }, { name: p.ogTitle ?? p.title, path }]),
        ]}
      />
      <BlogHeader
        back={BLOG_BASE[locale]}
        backLabel={c.blog}
        switchTo={translation && { href: postPath(translation.slug, translation.locale), label: c.switchTo, lang: LANG_TAG[translation.locale] }}
      />

      <article>
        <header className="mt-12 sm:mt-16">
          <p className="rise flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3" style={delay(1)}>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{c.guide}</span>
            <span className="inline-flex items-center gap-1"><Clock size={13} aria-hidden /> {c.minRead(p.readingMinutes)}</span>
            <span>{c.updated} <time dateTime={p.updated}>{fmtPostDate(p.updated, locale)}</time></span>
          </p>
          <h1 className="rise mt-5 text-balance text-[36px] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[54px]" style={delay(2)}>
            {p.title}
          </h1>
          <p className="rise mt-5 text-pretty text-[18px] leading-relaxed text-ink-2 sm:text-[20px]" style={delay(3)}>{p.description}</p>
        </header>

        <PostEventsRail data={events} range={range} locale={locale} />

        {p.resumen.length > 0 && (
          <section aria-labelledby="de-un-vistazo" className="post-glance rise mt-10 rounded-[20px] border border-line bg-bg-2/60 p-5 sm:p-6" style={delay(6)}>
            <h2 id="de-un-vistazo" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{c.glance}</h2>
            <ul className="mt-4 space-y-3">
              {p.resumen.map((r, i) => (
                <li key={i} className="flex gap-3 text-[16px] leading-snug text-ink">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold tabular-nums text-white">{i + 1}</span>
                  <span className="text-pretty">{r}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {cover?.cover_image_url && (
          <figure className="unveil -mx-5 mt-10 sm:mx-0">
            <div className="relative aspect-[16/9] overflow-hidden bg-bg-2 sm:rounded-[20px]">
              <Image src={cover.cover_image_url} alt={`${cover.name}, ${cover.state}`} fill sizes="680px" className="object-cover" />
            </div>
            <figcaption className="mt-2 px-5 text-[12px] text-ink-3 sm:px-0">
              {cover.name}, {cover.state}{cover.drive_from_cdmx ? ` · ${c.fromCdmx(cover.drive_from_cdmx)}` : ""}
            </figcaption>
          </figure>
        )}

        {toc.length > 2 && (
          <nav aria-label={c.toc} className="reveal mt-10 border-l-2 border-line pl-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{c.toc}</p>
            <ol className="mt-4 space-y-2.5">
              {toc.map((t, i) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="group flex items-baseline gap-4 text-[15px] text-ink-2 transition-colors hover:text-ink">
                    <span className="w-5 shrink-0 text-[12px] tabular-nums text-ink-3 transition-colors group-hover:text-accent">{String(i + 1).padStart(2, "0")}</span>
                    <span className={t.id === "eventos" ? "font-semibold text-accent transition-transform duration-300 group-hover:translate-x-1" : "transition-transform duration-300 group-hover:translate-x-1"}>{t.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="post-body mt-6" dangerouslySetInnerHTML={{ __html: before }} />

        {showEvents && <PostEvents data={events} munis={munis} range={range} title={eventsTitle} locale={locale} />}

        {after && <div className="post-body mt-2" dangerouslySetInnerHTML={{ __html: after }} />}

        {p.faq.length > 0 && (
          <section aria-labelledby="preguntas" className="reveal faq-list mt-16">
            <h2 id="preguntas" className="scroll-mt-20 text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">{c.faq}</h2>
            <div className="mt-5 border-b border-line">
              {p.faq.map((f) => (
                <details key={f.q} className="faq group border-t border-line">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[16px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Plus size={18} className="faq-icon mt-0.5 shrink-0 text-ink-3 group-hover:text-accent" />
                  </summary>
                  <p className="pb-6 pr-10 text-[15px] leading-relaxed text-ink-2 [&_a]:link-line" dangerouslySetInnerHTML={{ __html: inlineHtml(f.a) }} />
                </details>
              ))}
            </div>
          </section>
        )}
      </article>

      <aside aria-label={c.shareTitle} className="reveal mt-14 rounded-[20px] bg-ink p-6 text-on-ink">
        <p className="text-[20px] font-bold tracking-[-0.015em]">{c.shareTitle}</p>
        <p className="mt-1 text-[15px] text-on-ink/70">{c.shareBody}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={whatsappShare(`${c.shareText(p.ogTitle ?? p.title)} ${absUrl(path)}`)} target="_blank" rel="noreferrer" data-track="share_whatsapp" data-label={path}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-whatsapp px-4 text-[14px] font-semibold text-white">
            <MessageCircle size={16} /> {c.shareWa}
          </a>
          <CopyLink url={absUrl(path)} label={c.copyLink} done={c.copied} />
        </div>
      </aside>

      {munis.length > 0 && (
        <section aria-labelledby="pueblos" className="reveal mt-16">
          <h2 id="pueblos" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{c.towns}</h2>
          <ul className="no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
            {munis.map((m) => (
              <li key={m.slug} className="w-[148px] shrink-0 snap-start">
                <Link href={`/municipio/${m.slug}`} hrefLang="es-MX" className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-[14px] bg-bg-2">
                    {m.cover_image_url
                      ? <Image src={m.cover_image_url} alt="" fill sizes="148px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                      : <span aria-hidden className="absolute inset-0 grid place-items-center bg-accent-soft font-display text-[44px] font-extrabold text-accent">{m.name.charAt(0)}</span>}
                  </div>
                  <p className="mt-2 truncate text-[14px] font-semibold text-ink group-hover:underline">{m.name}</p>
                  <p className="truncate text-[12px] text-ink-3">{m.drive_from_cdmx ? c.fromCdmx(m.drive_from_cdmx) : m.state}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <nav aria-labelledby="sigue-leyendo" className="reveal mt-16">
          <h2 id="sigue-leyendo" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{c.related}</h2>
          <ul className="mt-4 border-b border-line">
            {related.map((r) => {
              const img = coverOf(r, bySlug)?.cover_image_url;
              return (
                <li key={r.slug} className="border-t border-line">
                  <Link href={postPath(r.slug, locale)} className="group flex items-center gap-4 py-4">
                    {img && (
                      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[12px] bg-bg-2">
                        <Image src={img} alt="" fill sizes="72px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                      </div>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="link-grow font-display text-balance text-[17px] font-bold leading-snug tracking-[-0.015em] text-ink">{r.ogTitle ?? r.title}</span>
                      <span className="mt-1 line-clamp-1 block text-[14px] text-ink-3">{r.description}</span>
                    </span>
                    <ArrowUpRight size={18} className="shrink-0 text-ink-3 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <aside className="reveal mt-16 border-t border-line pt-8">
        <p className="text-[18px] font-bold tracking-[-0.01em] text-ink">{c.ctaTitle}</p>
        <p className="mt-1 text-[15px] text-ink-2">{c.ctaBody}</p>
        <Link href="/publicar" className="group mt-4 inline-flex items-center gap-2 text-[15px] font-semibold text-accent">
          {c.ctaLink}
          <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </aside>

      {events.events.length > 0 && <EventsPill label={c.pill(events.events.length)} />}
      <BottomNav />
    </main>
  );
}
