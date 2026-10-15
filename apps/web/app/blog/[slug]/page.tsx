import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { MapPin } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { BottomNav } from "@/components/bottom-nav";
import { JsonLd } from "@/components/json-ld";
import { PostEvents, PostEventsSkeleton } from "@/components/post-events";
import { fmtPostDate, inlineHtml, postBySlug } from "@/lib/blog";
import { municipalities } from "@/lib/queries";
import { pageMetadata } from "@/lib/site";
import { breadcrumbs, postGraph } from "@/lib/structured-data";
import type { Municipality } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await postBySlug(slug);
  if (!p) return { title: "Guía no encontrada", robots: { index: false, follow: true } };
  const meta = pageMetadata({
    title: p.title,
    ogTitle: p.ogTitle,
    description: p.description,
    path: `/blog/${p.slug}`,
    type: "article",
    images: [{ url: `/blog/${p.slug}/opengraph-image`, alt: p.ogTitle ?? p.title, type: "image/jpeg" }],
  });
  return { ...meta, openGraph: { ...meta.openGraph, type: "article", publishedTime: p.published, modifiedTime: p.updated } };
}

/** Municipios de la guía en el orden del encabezado; sin BD la guía sale sin ellos. */
async function postMunicipalities(slugs: string[]): Promise<Municipality[]> {
  try {
    const bySlug = new Map((await municipalities()).map((m) => [m.slug, m]));
    return slugs.map((s) => bySlug.get(s)).filter((m): m is Municipality => !!m);
  } catch {
    return [];
  }
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params;
  const p = await postBySlug(slug);
  if (!p) notFound();
  const munis = await postMunicipalities(p.municipios);
  const cover = munis.find((m) => m.cover_image_url);
  const toc = [
    ...p.toc.slice(0, p.eventsAt),
    ...(p.eventos ? [{ id: "eventos", label: "Eventos en estas fechas" }] : []),
    ...p.toc.slice(p.eventsAt),
    ...(p.faq.length ? [{ id: "preguntas", label: "Preguntas frecuentes" }] : []),
  ];

  return (
    <main className="mx-auto max-w-[720px] px-5 pb-28 pt-6">
      <JsonLd data={[...postGraph(p, munis), breadcrumbs([{ name: "Explorar", path: "/" }, { name: "Guías", path: "/blog" }, { name: p.ogTitle ?? p.title, path: `/blog/${p.slug}` }])]} />
      <div className="flex items-center gap-3">
        <BackButton className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line hover:bg-bg-2" />
        <nav aria-label="Migas de pan" className="text-[13px] text-ink-2">
          <Link href="/blog" className="hover:text-ink hover:underline">Guías</Link>
        </nav>
      </div>

      <article>
        <header className="mt-5">
          <h1 className="text-[30px] font-extrabold leading-[1.1] text-ink sm:text-[36px]">{p.title}</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{p.description}</p>
          <p className="mt-3 text-[13px] text-ink-3">
            Actualizada el <time dateTime={p.updated}>{fmtPostDate(p.updated)}</time> · {p.readingMinutes} min de lectura
          </p>
        </header>

        {cover?.cover_image_url && (
          <div className="relative -mx-5 mt-6 aspect-[16/9] overflow-hidden bg-bg-2 sm:mx-0 sm:rounded-card">
            <Image src={cover.cover_image_url} alt={`${cover.name}, ${cover.state}`} fill priority sizes="720px" className="object-cover" />
          </div>
        )}

        {toc.length > 2 && (
          <nav aria-label="En esta guía" className="mt-6 rounded-card border border-line bg-bg-2/50 px-5 py-4">
            <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink">En esta guía</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] text-ink-2">
              {toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="hover:text-ink hover:underline">{t.label}</a></li>)}
            </ol>
          </nav>
        )}

        <div className="post-body mt-6" dangerouslySetInnerHTML={{ __html: p.before }} />

        {p.eventos && (
          <Suspense fallback={<PostEventsSkeleton />}>
            <PostEvents munis={munis} desde={p.eventos.desde} hasta={p.eventos.hasta} />
          </Suspense>
        )}

        {p.after && <div className="post-body mt-6" dangerouslySetInnerHTML={{ __html: p.after }} />}

        {p.faq.length > 0 && (
          <section aria-labelledby="preguntas" className="mt-10">
            <h2 id="preguntas" className="scroll-mt-24 text-[22px] font-bold leading-tight text-ink">Preguntas frecuentes</h2>
            <div className="mt-3 divide-y divide-line rounded-card border border-line">
              {p.faq.map((f) => (
                <details key={f.q} className="group px-4 py-3 [&_a]:font-medium [&_a]:text-ink [&_a]:underline">
                  <summary className="cursor-pointer list-none text-[15px] font-semibold text-ink marker:hidden">
                    <span className="flex items-start justify-between gap-3">{f.q}<span className="text-ink-3 transition group-open:rotate-45">+</span></span>
                  </summary>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-2" dangerouslySetInnerHTML={{ __html: inlineHtml(f.a) }} />
                </details>
              ))}
            </div>
          </section>
        )}
      </article>

      {munis.length > 0 && (
        <section aria-labelledby="pueblos" className="mt-10">
          <h2 id="pueblos" className="text-[18px] font-bold text-ink">Los pueblos de esta guía</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {munis.map((m) => (
              <Link key={m.slug} href={`/municipio/${m.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium hover:border-ink">
                <MapPin size={14} className="text-ink-2" />
                {m.name}{m.drive_from_cdmx ? <span className="text-ink-3">· {m.drive_from_cdmx}</span> : null}
              </Link>
            ))}
          </div>
        </section>
      )}

      <aside className="mt-10 rounded-card bg-ink px-5 py-5 text-white">
        <p className="text-[16px] font-semibold">¿Organizas algo en estas fechas?</p>
        <p className="mt-1 text-[14px] text-white/80">Sube el flyer y aparece en la cartelera y en esta guía. Es gratis.</p>
        <Link href="/publicar" className="mt-3 inline-flex rounded-control bg-white px-4 py-2 text-[14px] font-semibold text-ink">Publicar un evento</Link>
      </aside>

      <BottomNav />
    </main>
  );
}
