import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { BottomNav } from "@/components/bottom-nav";
import { JsonLd } from "@/components/json-ld";
import { EmptyState } from "@/components/ui";
import { fmtPostDate, listPosts } from "@/lib/blog";
import { absUrl, pageMetadata, SITE_URL } from "@/lib/site";
import { breadcrumbs } from "@/lib/structured-data";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Guías: ferias, fiestas y escapadas cerca de la CDMX",
  ogTitle: "Guías de Entre Lugares",
  description: "Guías para salir de la CDMX: qué fiestas y ferias hay en los pueblos de Morelos y Estado de México, qué días conviene ir, cuánto se hace de camino y qué eventos ya están confirmados.",
  path: "/blog",
});

export default async function BlogPage() {
  const posts = await listPosts();
  return (
    <main className="mx-auto max-w-[720px] px-5 pb-28 pt-6">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Blog",
            "@id": absUrl("/blog#blog"),
            name: "Guías de Entre Lugares",
            url: absUrl("/blog"),
            publisher: { "@id": `${SITE_URL}/#organization` },
            inLanguage: "es-MX",
            blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: absUrl(`/blog/${p.slug}`), datePublished: p.published, dateModified: p.updated })),
          },
          breadcrumbs([{ name: "Explorar", path: "/" }, { name: "Guías", path: "/blog" }]),
        ]}
      />
      <BackButton className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-bg-2" />
      <h1 className="mt-5 text-[30px] font-extrabold leading-tight text-ink">Guías para salir de la CDMX</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-2">
        Fiestas, ferias y escapadas en los pueblos de Morelos y el Estado de México: qué ver, qué días ir y qué eventos ya están confirmados.
      </p>

      {posts.length ? (
        <ul className="mt-8 divide-y divide-line">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="group block py-5">
                <h2 className="text-[19px] font-bold leading-snug text-ink group-hover:underline">{p.title}</h2>
                <p className="mt-1.5 line-clamp-3 text-[15px] leading-relaxed text-ink-2">{p.description}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-3">
                  <time dateTime={p.updated}>{fmtPostDate(p.updated)}</time> · {p.readingMinutes} min
                  <ArrowRight size={14} className="ml-auto text-ink-2 transition group-hover:translate-x-0.5" />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="-mx-5 mt-8"><EmptyState title="Pronto habrá guías aquí" /></div>
      )}

      <BottomNav />
    </main>
  );
}
