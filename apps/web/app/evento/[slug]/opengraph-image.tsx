import { eventBySlug } from "@/lib/queries";
import { flyerUrl, fmtPrice, fmtWhenLong } from "@/lib/format";
import { OG_SIZE, ogPhoto, renderOg } from "@/lib/og";
import { CATEGORY_LABEL } from "@/lib/types";

export const alt = "Flyer, fecha, lugar y precio del evento";
export const size = OG_SIZE;
export const contentType = "image/jpeg";

/** Lo que se ve al compartir el evento por WhatsApp o redes: flyer, título, cuándo, dónde y precio. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await eventBySlug(slug);
  if (!data) return renderOg({ icon: "calendar", title: "Evento no disponible", subtitle: "Mira lo que viene cerca de ti" }, { jpeg: true });

  const { event, occurrences, place, municipality } = data;
  const next = occurrences.find((o) => new Date(o.ends_at ?? o.starts_at) >= new Date()) ?? occurrences[0];
  const where = [place?.name ?? event.place_text, municipality?.name].filter(Boolean).join(" · ");
  const price = fmtPrice(event.is_free, event.price_min, event.price_max);
  const more = occurrences.length > 1 ? `${occurrences.length} fechas` : null;

  return renderOg({
    icon: "calendar",
    photo: await ogPhoto(flyerUrl(event.image_path)),
    photoSide: "left",
    eyebrow: [CATEGORY_LABEL[event.category], municipality?.state].filter(Boolean).join(" · "),
    title: event.title,
    subtitle: [next ? fmtWhenLong(next.starts_at, next.ends_at, next.is_all_day) : null, where],
    freeChip: event.is_free ? "Gratis" : undefined,
    chips: [...(!event.is_free && price !== "Consultar" ? [price] : []), ...(more ? [more] : [])],
  }, { jpeg: true });
}
