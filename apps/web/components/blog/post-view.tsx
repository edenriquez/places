import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { BottomNav } from "../bottom-nav";
import { JsonLd } from "../json-ld";
import { BlogHeader } from "./blog-header";
import { PostEvents, PostEventsSkeleton } from "./post-events";
import { eventWindow, fmtPostDate, inlineHtml, postBySlug, relatedPosts, translationOf } from "@/lib/blog";
import { BLOG_BASE, BLOG_COPY, LANG_TAG, postPath, type Locale } from "@/lib/blog-copy";
import { municipalities } from "@/lib/queries";
import { breadcrumbs, postGraph } from "@/lib/structured-data";
import type { Municipality } from "@/lib/types";

/** Municipios de la guía en el orden del encabezado; sin BD la guía sale sin ellos. */
async function postMunicipalities(slugs: string[]): Promise<Municipality[]> {
  try {
    const bySlug = new Map((await municipalities()).map((m) => [m.slug, m]));
    return slugs.map((s) => bySlug.get(s)).filter((m): m is Municipality => !!m);
  } catch {
    return [];
  }
}

const delay = (i: number) => ({ "--i": i }) as React.CSSProperties;

export async function PostView({ slug, locale }: { slug: string; locale: Locale }) {
  const p = await postBySlug(slug, locale);
  if (!p) notFound();
  const c = BLOG_COPY[locale];
  const [munis, translation, related] = await Promise.all([postMunicipalities(p.municipios), translationOf(p), relatedPosts(p)]);
  const cover = munis.find((m) => m.cover_image_url);
  const range = p.eventos && eventWindow(p.eventos);
  const eventsTitle = !p.eventos || "desde" in p.eventos ? c.events : p.eventos.rango === "fin-de-semana" ? c.eventsWeekend : c.eventsNext(p.eventos.dias);
  const toc = [
    ...p.toc.slice(0, p.eventsAt),
    ...(range ? [{ id: "eventos", label: eventsTitle }] : []),
    ...p.toc.slice(p.eventsAt),
    ...(p.faq.length ? [{ id: "preguntas", label: c.faq }] : []),
  ];
  const path = postPath(p.slug, locale);

  return (
    <main lang={LANG_TAG[locale]} className="mx-auto max-w-[680px] px-5 pb-28 pt-6 lg:pt-10">
      <div className="read-progress" aria-hidden />
      <JsonLd
        data={[
          ...postGraph(p, munis, translation),
          breadcrumbs([{ name: c.explore, path: "/" }, { name: c.blog, path: BLOG_BASE[locale] }, { name: p.ogTitle ?? p.title, path }]),
        ]}
      />
      <BlogHeader
        back={BLOG_BASE[locale]}
        backLabel={c.blog}
        switchTo={translation && { href: postPath(translation.slug, translation.locale), label: c.switchTo, lang: LANG_TAG[translation.locale] }}
      />

      <article>
        <header className="mt-14 sm:mt-20">
          <p className="rise text-[11px] font-semibold uppercase tracking-[0.16em] text-accent" style={delay(1)}>
            {c.guide} · {c.minShort(p.readingMinutes)}
          </p>
          <h1 className="rise mt-4 text-balance text-[36px] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[54px]" style={delay(2)}>
            {p.title}
          </h1>
          <p className="rise mt-5 text-pretty text-[18px] leading-relaxed text-ink-2 sm:text-[20px]" style={delay(3)}>{p.description}</p>
          <p className="rise mt-6 text-[13px] text-ink-3" style={delay(4)}>
            {c.updated} <time dateTime={p.updated}>{fmtPostDate(p.updated, locale)}</time>
          </p>
          <div className="draw-line mt-10 h-px bg-line-2" />
        </header>

        {cover?.cover_image_url && (
          <div className="unveil relative -mx-5 mt-10 aspect-[16/9] overflow-hidden bg-bg-2 sm:mx-0 sm:rounded-[20px]">
            <Image src={cover.cover_image_url} alt={`${cover.name}, ${cover.state}`} fill priority sizes="680px" className="object-cover" />
          </div>
        )}

        {toc.length > 2 && (
          <nav aria-label={c.toc} className="rise mt-10" style={delay(5)}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{c.toc}</p>
            <ol className="mt-4 space-y-2.5">
              {toc.map((t, i) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="group flex items-baseline gap-4 text-[15px] text-ink-2 transition-colors hover:text-ink">
                    <span className="w-5 shrink-0 text-[12px] tabular-nums text-ink-3 transition-colors group-hover:text-accent">{String(i + 1).padStart(2, "0")}</span>
                    <span className="transition-transform duration-300 group-hover:translate-x-1">{t.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="post-body mt-6" dangerouslySetInnerHTML={{ __html: p.before }} />

        {range && (
          <Suspense fallback={<PostEventsSkeleton />}>
            <PostEvents munis={munis} desde={range.desde} hasta={range.hasta} title={eventsTitle} locale={locale} />
          </Suspense>
        )}

        {p.after && <div className="post-body mt-2" dangerouslySetInnerHTML={{ __html: p.after }} />}

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

      {munis.length > 0 && (
        <section aria-labelledby="pueblos" className="reveal mt-16">
          <h2 id="pueblos" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{c.towns}</h2>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-[16px]">
            {munis.map((m) => (
              <li key={m.slug}>
                <Link href={`/municipio/${m.slug}`} hrefLang="es-MX" className="link-line font-medium">{m.name}</Link>
                {m.drive_from_cdmx && <span className="ml-1.5 text-[13px] text-ink-3">{m.drive_from_cdmx}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <nav aria-labelledby="sigue-leyendo" className="reveal mt-16">
          <h2 id="sigue-leyendo" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{c.related}</h2>
          <ul className="mt-4 border-b border-line">
            {related.map((r) => (
              <li key={r.slug} className="border-t border-line">
                <Link href={postPath(r.slug, locale)} className="group flex items-baseline justify-between gap-6 py-5">
                  <span className="min-w-0">
                    <span className="link-grow font-display text-balance text-[18px] font-bold leading-snug tracking-[-0.015em] text-ink">{r.ogTitle ?? r.title}</span>
                    <span className="mt-1 line-clamp-1 block text-[14px] text-ink-3">{r.description}</span>
                  </span>
                  <ArrowUpRight size={18} className="shrink-0 self-center text-ink-3 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                </Link>
              </li>
            ))}
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

      <BottomNav />
    </main>
  );
}
