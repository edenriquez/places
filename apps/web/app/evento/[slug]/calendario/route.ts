import { ics, icsResponse } from "@/lib/ics";
import { eventBySlug } from "@/lib/queries";
import { clip, SITE_URL } from "@/lib/site";

/** "Agregar al calendario" desde Mis planes: la próxima fecha del evento, con aviso un día y dos horas antes. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await eventBySlug(slug);
  if (!d) return new Response("No encontrado", { status: 404 });
  const { event, occurrences, place, municipality } = d;
  const now = Date.now();
  const occ = occurrences.find((o) => new Date(o.ends_at ?? o.starts_at).getTime() >= now) ?? occurrences.at(-1);
  if (!occ) return new Response("Sin fechas", { status: 404 });
  const url = `${SITE_URL}/evento/${event.slug}?utm_source=calendario&utm_medium=ics`;
  const body = ics([{
    uid: occ.id,
    title: event.title,
    start: new Date(occ.starts_at),
    end: occ.ends_at ? new Date(occ.ends_at) : null,
    allDay: occ.is_all_day,
    description: `${event.description ? `${clip(event.description, 400)}\n\n` : ""}${url}`,
    location: [place?.name ?? event.place_text, municipality?.name].filter(Boolean).join(", "),
    url,
    alarms: occ.is_all_day ? [1440] : [1440, 120],
  }]);
  return icsResponse(body, event.slug);
}
