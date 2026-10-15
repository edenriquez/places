import { postBySlug } from "./blog";
import { BLOG_COPY, type Locale } from "./blog-copy";
import { ogPhoto, renderOg } from "./og";
import { municipalities } from "./queries";

/** Tarjeta para compartir de una guía: portada del primer pueblo que tenga foto, título y cuántos pueblos cubre. */
export async function renderPostOg(slug: string, locale: Locale) {
  const c = BLOG_COPY[locale];
  const p = await postBySlug(slug, locale);
  if (!p) return renderOg({ icon: "fileText", title: c.indexOgTitle }, { jpeg: true });
  const munis = await municipalities().catch(() => []);
  const cover = p.municipios.map((s) => munis.find((m) => m.slug === s)).find((m) => m?.cover_image_url);
  return renderOg({
    icon: "fileText",
    photo: await ogPhoto(cover?.cover_image_url),
    eyebrow: c.guide,
    title: p.ogTitle ?? p.title,
    chips: [c.townCount(p.municipios.length), c.minRead(p.readingMinutes)],
  }, { jpeg: true });
}

export function renderBlogOg(locale: Locale) {
  const c = BLOG_COPY[locale];
  return renderOg({ icon: "fileText", eyebrow: c.blog, title: c.indexOgTitle, subtitle: c.indexOgSubtitle });
}
