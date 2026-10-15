import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { SectionHeader } from "../ui";
import { listPosts } from "@/lib/blog";
import { BLOG_BASE, BLOG_COPY, postPath } from "@/lib/blog-copy";

/** Las guías más nuevas en la portada: enlaces internos desde la página con más autoridad del sitio. */
export async function HomeGuides({ n = 4 }: { n?: number }) {
  const posts = (await listPosts("es")).slice(0, n);
  if (!posts.length) return null;
  const c = BLOG_COPY.es;
  return (
    <section aria-label={c.homeGuides} className="pb-4">
      <SectionHeader
        title={c.homeGuides}
        subtitle={c.homeGuidesLead}
        action={<Link href={BLOG_BASE.es} className="text-[14px] font-semibold text-accent">{c.allGuides}</Link>}
      />
      <ul className="mx-5 divide-y divide-line rounded-card border border-line lg:grid lg:grid-cols-2 lg:divide-y-0 lg:[&>li:nth-child(n+3)]:border-t lg:[&>li:nth-child(even)]:border-l lg:[&>li]:border-line">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={postPath(p.slug, "es")} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-2/60">
              <BookOpen size={18} className="shrink-0 text-ink-2" />
              <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug">{p.ogTitle ?? p.title}</span>
              <ChevronRight size={18} className="shrink-0 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
