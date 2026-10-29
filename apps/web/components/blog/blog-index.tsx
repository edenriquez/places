import Image from "next/image";
import Link from "next/link";
import { BottomNav } from "../bottom-nav";
import { JsonLd } from "../json-ld";
import { BlogHeader } from "./blog-header";
import { coverOf, municipalityMap } from "./post-view";
import { fmtPostDate, listPosts } from "@/lib/blog";
import { BLOG_BASE, BLOG_COPY, LANG_TAG, LOCALES, postPath, type Locale } from "@/lib/blog-copy";
import { absUrl, SITE_URL } from "@/lib/site";
import { breadcrumbs } from "@/lib/structured-data";

const delay = (i: number) => ({ "--i": i }) as React.CSSProperties;

export async function BlogIndex({ locale }: { locale: Locale }) {
  const c = BLOG_COPY[locale];
  const posts = await listPosts(locale);
  const other = LOCALES.find((l) => l !== locale)!;
  const [otherPosts, bySlug] = await Promise.all([listPosts(other), municipalityMap()]);
  const otherHasPosts = otherPosts.length > 0;
  const [featured, ...rest] = posts;
  const featuredCover = featured && coverOf(featured, bySlug)?.cover_image_url;

  return (
    <main lang={LANG_TAG[locale]} className="mx-auto max-w-[760px] px-5 pb-28 pt-6 lg:pt-10">
      <div className="guide-aura" aria-hidden />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Blog",
            "@id": absUrl(`${BLOG_BASE[locale]}#blog`),
            name: `${c.blog} · Entre Lugares`,
            url: absUrl(BLOG_BASE[locale]),
            publisher: { "@id": `${SITE_URL}/#organization` },
            inLanguage: LANG_TAG[locale],
            blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: absUrl(postPath(p.slug, locale)), datePublished: p.published, dateModified: p.updated })),
          },
          breadcrumbs([{ name: c.explore, path: "/" }, { name: c.blog, path: BLOG_BASE[locale] }]),
        ]}
      />
      <BlogHeader
        back="/"
        backLabel="entrelugares"
        switchTo={otherHasPosts ? { href: BLOG_BASE[other], label: BLOG_COPY[locale].switchTo, lang: LANG_TAG[other] } : null}
      />

      <header className="mt-16 sm:mt-24">
        <p className="rise text-[11px] font-semibold uppercase tracking-[0.16em] text-accent" style={delay(1)}>{c.blog}</p>
        <h1 className="rise mt-4 text-balance text-[44px] font-extrabold leading-[0.98] tracking-[-0.04em] text-ink sm:text-[72px]" style={delay(2)}>
          {c.indexTitle}
        </h1>
        <p className="rise mt-6 max-w-[560px] text-pretty text-[18px] leading-relaxed text-ink-2" style={delay(3)}>{c.indexLead}</p>
      </header>

      {featured ? (
        <>
          <Link href={postPath(featured.slug, locale)} className="rise group mt-14 block sm:mt-16" style={delay(4)}>
            {featuredCover ? (
              <div className="relative -mx-5 aspect-[16/9] overflow-hidden bg-bg-2 sm:mx-0 sm:rounded-[20px]">
                <Image src={featuredCover} alt="" fill priority sizes="760px" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{c.latest}</span>
              </div>
            ) : (
              <span className="inline-block rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{c.latest}</span>
            )}
            <span className="mt-5 block font-display text-balance text-[26px] font-extrabold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[34px]">
              <span className="link-grow">{featured.title}</span>
            </span>
            <span className="mt-3 line-clamp-3 block text-[16px] leading-relaxed text-ink-2">{featured.resumen[0] ?? featured.description}</span>
            <span className="mt-3 block text-[12px] text-ink-3">
              <time dateTime={featured.updated}>{fmtPostDate(featured.updated, locale)}</time> · {c.minShort(featured.readingMinutes)}
            </span>
          </Link>

          {rest.length > 0 && (
            <ol className="mt-12 border-b border-line">
              {rest.map((p, i) => {
                const img = coverOf(p, bySlug)?.cover_image_url;
                return (
                  <li key={p.slug} className="rise border-t border-line" style={delay(5 + i)}>
                    <Link href={postPath(p.slug, locale)} className="group flex items-start gap-4 py-6 sm:gap-6 sm:py-7">
                      <span className="min-w-0 flex-1">
                        <span className="link-grow font-display text-balance text-[19px] font-bold leading-snug tracking-[-0.02em] text-ink sm:text-[24px]">{p.title}</span>
                        <span className="mt-2 line-clamp-2 block text-[14px] leading-relaxed text-ink-2 sm:text-[15px]">{p.description}</span>
                        <span className="mt-2 block text-[12px] text-ink-3">
                          <time dateTime={p.updated}>{fmtPostDate(p.updated, locale)}</time> · {c.minShort(p.readingMinutes)}
                        </span>
                      </span>
                      {img && (
                        <span className="relative aspect-square w-[88px] shrink-0 overflow-hidden rounded-[14px] bg-bg-2 sm:w-[132px]">
                          <Image src={img} alt="" fill sizes="132px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : (
        <p className="mt-16 border-t border-line pt-8 text-[15px] text-ink-2">{c.empty}</p>
      )}

      <BottomNav />
    </main>
  );
}
