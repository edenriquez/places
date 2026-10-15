import type { MetadataRoute } from "next";
import { listPosts } from "@/lib/blog";
import { flyerUrl } from "@/lib/format";
import { municipalities, publishedEventsIndex, publishedExperiencesIndex } from "@/lib/queries";
import { absUrl } from "@/lib/site";

// se arma al pedirlo (la BD no está disponible en el build) y queda en caché una hora
export const dynamic = "force-dynamic";

/** Páginas públicas: portada, mapa, publicar, municipios, experiencias vigentes, eventos (los que vienen, con su flyer como imagen) y guías. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [munis, events, experiences, posts] = await Promise.all([municipalities(), publishedEventsIndex(), publishedExperiencesIndex(), listPosts()]);
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const latest = events[0]?.updated_at ?? new Date().toISOString();

  const eventEntries = events.map((e) => {
    const end = Math.max(0, ...e.event_occurrences.map((o) => new Date(o.ends_at ?? o.starts_at).getTime()));
    const upcoming = end >= now;
    const img = flyerUrl(e.image_path);
    return {
      url: absUrl(`/evento/${e.slug}`),
      lastModified: e.updated_at,
      changeFrequency: upcoming ? ("daily" as const) : ("yearly" as const),
      priority: upcoming ? 0.8 : 0.3,
      ...(img && { images: [img] }),
    };
  });

  return [
    { url: absUrl("/"), lastModified: latest, changeFrequency: "hourly", priority: 1 },
    { url: absUrl("/mapa"), lastModified: latest, changeFrequency: "hourly", priority: 0.9 },
    ...munis.map((m) => ({
      url: absUrl(`/municipio/${m.slug}`),
      lastModified: latest,
      changeFrequency: "daily" as const,
      priority: m.is_pueblo_magico ? 0.8 : 0.7,
      ...(m.cover_image_url && { images: [m.cover_image_url] }),
    })),
    ...experiences
      .filter((x) => !x.valid_until || x.valid_until >= today)
      .map((x) => {
        const img = flyerUrl(x.image_path);
        return { url: absUrl(`/experiencia/${x.slug}`), lastModified: x.updated_at, changeFrequency: "weekly" as const, priority: 0.7, ...(img && { images: [img] }) };
      }),
    ...eventEntries,
    { url: absUrl("/blog"), lastModified: posts[0]?.updated, changeFrequency: "weekly", priority: 0.7 },
    ...posts.map((p) => ({ url: absUrl(`/blog/${p.slug}`), lastModified: p.updated, changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: absUrl("/publicar"), changeFrequency: "monthly", priority: 0.5 },
    { url: absUrl("/privacidad"), changeFrequency: "yearly", priority: 0.2 },
    { url: absUrl("/terminos"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
