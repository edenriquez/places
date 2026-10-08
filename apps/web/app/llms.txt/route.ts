import { fmtPrice, fmtWhenShort } from "@/lib/format";
import { municipalities, publishedEventsIndex } from "@/lib/queries";
import { absUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * /llms.txt (llmstxt.org): resumen en Markdown para asistentes y buscadores con IA. Dice qué es el sitio,
 * cómo están armadas las URLs y lista municipios y próximos eventos con link, para que puedan citarlos.
 */
export async function GET() {
  const [munis, events] = await Promise.all([municipalities(), publishedEventsIndex()]);
  const byCve = new Map(munis.map((m) => [m.cvegeo, m]));
  const now = Date.now();

  const upcoming = events
    .map((e) => ({ e, next: e.event_occurrences.filter((o) => new Date(o.ends_at ?? o.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] }))
    .filter((x) => !!x.next)
    .sort((a, b) => a.next.starts_at.localeCompare(b.next.starts_at))
    .slice(0, 60);

  const states = [...new Set(munis.map((m) => m.state))];
  const body = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "Cada evento sale de un flyer o de la convocatoria del organizador y lo revisa una persona antes de publicarse. " +
      "Las fiestas que se repiten cada año aparecen con fecha estimada hasta que llega la confirmación. " +
      "Horarios en hora del centro de México (America/Mexico_City); precios en pesos mexicanos (MXN).",
    "",
    "## Secciones",
    "",
    `- [Explorar](${absUrl("/")}): lo que pasa hoy y los próximos días cerca de una ubicación, por fecha.`,
    `- [Mapa](${absUrl("/mapa")}): los mismos eventos en el mapa, filtrados por tiempo de camino.`,
    `- [Publicar un evento](${absUrl("/publicar")}): los organizadores suben el flyer gratis.`,
    `- [Aviso de privacidad](${absUrl("/privacidad")})`,
    `- [Términos y condiciones](${absUrl("/terminos")})`,
    `- [Sitemap](${absUrl("/sitemap.xml")})`,
    "",
    "## URLs",
    "",
    `- Evento: ${absUrl("/evento/{slug}")}. Trae fecha, lugar, precio, contacto y datos estructurados schema.org/Event.`,
    `- Municipio: ${absUrl("/municipio/{slug}")}. Próximos eventos, fiestas del año y lugares para visitar.`,
    "",
    ...states.flatMap((state) => [
      `## Municipios de ${state}`,
      "",
      ...munis.filter((m) => m.state === state).map((m) => {
        const notes = [m.is_pueblo_magico ? "Pueblo Mágico" : null, m.drive_from_cdmx ? `${m.drive_from_cdmx} desde la CDMX` : null].filter(Boolean).join(", ");
        return `- [${m.name}](${absUrl(`/municipio/${m.slug}`)})${notes ? `: ${notes}` : ""}`;
      }),
      "",
    ]),
    "## Próximos eventos",
    "",
    ...(upcoming.length
      ? upcoming.map(({ e, next }) => {
          const m = byCve.get(e.municipality_cvegeo);
          const where = m ? `${m.name}, ${m.state}` : "";
          const price = e.is_free ? fmtPrice(true, null, null) : null;
          return `- [${e.title}](${absUrl(`/evento/${e.slug}`)}): ${[fmtWhenShort(next.starts_at), where, price].filter(Boolean).join(" · ")}`;
        })
      : ["Aún no hay eventos próximos publicados."]),
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
