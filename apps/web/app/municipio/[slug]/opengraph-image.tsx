import { municipalityBySlug, municipalityEvents } from "@/lib/queries";
import { OG_SIZE, ogPhoto, renderOg } from "@/lib/og";

export const alt = "Eventos, fiestas y lugares del municipio";
export const size = OG_SIZE;
export const contentType = "image/jpeg";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await municipalityBySlug(slug);
  if (!m) return renderOg({ icon: "landmark", title: "Qué hacer en los pueblos cerca de ti" }, { jpeg: true });
  const events = await municipalityEvents(m.cvegeo, 12, m);
  const free = events.filter((e) => e.is_free).length;
  return renderOg({
    icon: "landmark",
    photo: await ogPhoto(m.cover_image_url),
    eyebrow: [m.is_pueblo_magico ? "Pueblo Mágico" : null, m.state].filter(Boolean).join(" · "),
    title: `Qué hacer en ${m.name}`,
    subtitle: m.drive_from_cdmx ? `Ferias, fiestas y eventos a ${m.drive_from_cdmx} de la CDMX` : "Ferias, fiestas, eventos y lugares para visitar",
    chips: [
      events.length ? `${events.length} ${events.length === 1 ? "evento próximo" : "eventos próximos"}` : "Fiestas del año",
      ...(free ? [`${free} gratis`] : []),
    ],
  }, { jpeg: true });
}
