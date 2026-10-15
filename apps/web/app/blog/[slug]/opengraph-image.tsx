import { postBySlug } from "@/lib/blog";
import { OG_SIZE, ogPhoto, renderOg } from "@/lib/og";
import { municipalities } from "@/lib/queries";

export const alt = "Guía para salir de la CDMX";
export const size = OG_SIZE;
export const contentType = "image/jpeg";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await postBySlug(slug);
  if (!p) return renderOg({ icon: "fileText", title: "Guías para salir de la CDMX" }, { jpeg: true });
  const munis = await municipalities().catch(() => []);
  const cover = p.municipios.map((s) => munis.find((m) => m.slug === s)).find((m) => m?.cover_image_url);
  return renderOg({
    icon: "fileText",
    photo: await ogPhoto(cover?.cover_image_url),
    eyebrow: "Guía",
    title: p.ogTitle ?? p.title,
    chips: [`${p.municipios.length} ${p.municipios.length === 1 ? "pueblo" : "pueblos"}`, `${p.readingMinutes} min de lectura`],
  }, { jpeg: true });
}
