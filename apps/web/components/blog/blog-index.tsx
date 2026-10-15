import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BottomNav } from "../bottom-nav";
import { JsonLd } from "../json-ld";
import { BlogHeader } from "./blog-header";
import { fmtPostDate, listPosts } from "@/lib/blog";
import { BLOG_BASE, BLOG_COPY, LANG_TAG, LOCALES, postPath, type Locale } from "@/lib/blog-copy";
import { absUrl, SITE_URL } from "@/lib/site";
import { breadcrumbs } from "@/lib/structured-data";

const delay = (i: number) => ({ "--i": i }) as React.CSSProperties;

export async function BlogIndex({ locale }: { locale: Locale }) {
  const c = BLOG_COPY[locale];
  const posts = await listPosts(locale);
  const other = LOCALES.find((l) => l !== locale)!;
  const otherHasPosts = (await listPosts(other)).length > 0;

  return (
    <main lang={LANG_TAG[locale]} className="mx-auto max-w-[760px] px-5 pb-28 pt-6 lg:pt-10">
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

      {posts.length ? (
        <ol className="mt-16 border-b border-line sm:mt-20">
          {posts.map((p, i) => (
            <li key={p.slug} className="rise border-t border-line" style={delay(4 + i)}>
              <Link href={postPath(p.slug, locale)} className="group grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-4 py-7 sm:grid-cols-[3rem_1fr_auto] sm:py-9">
                <span className="text-[13px] tabular-nums text-ink-3 transition-colors duration-300 group-hover:text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="link-grow font-display text-balance text-[22px] font-bold leading-snug tracking-[-0.02em] text-ink sm:text-[28px]">{p.title}</span>
                  <span className="mt-2 line-clamp-2 block text-[15px] leading-relaxed text-ink-2">{p.description}</span>
                  <span className="mt-3 block text-[12px] text-ink-3">
                    <time dateTime={p.updated}>{fmtPostDate(p.updated, locale)}</time> · {c.minShort(p.readingMinutes)}
                  </span>
                </span>
                <ArrowUpRight size={22} className="self-center text-ink-3 transition duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-accent" />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-16 border-t border-line pt-8 text-[15px] text-ink-2">{c.empty}</p>
      )}

      <BottomNav />
    </main>
  );
}
