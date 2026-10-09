import type { EventData } from "@/components/event-detail";
import type { ExperienceData } from "@/components/experience-detail";
import { EXPERIENCE_KINDS } from "./experiences";
import { flyerUrl } from "./format";
import { absUrl, CONTACT_EMAIL, SITE_DESCRIPTION, SITE_NAME, SITE_REGIONS, SITE_URL } from "./site";
import { CATEGORY_LABEL, type ExperienceRow, type Municipality, type NearRow, type Occurrence } from "./types";

/** schema.org para buscadores y asistentes con IA: lo mismo que se ve en la página, en forma que se puede citar. */

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

export function siteGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: SITE_NAME,
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: absUrl("/icon-512.png"), width: 512, height: 512 },
        email: CONTACT_EMAIL,
        areaServed: SITE_REGIONS.map((name) => ({ "@type": "State", name, containedInPlace: { "@type": "Country", name: "México" } })),
      },
      {
        "@type": "WebSite",
        "@id": SITE_ID,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        inLanguage: "es-MX",
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absUrl(it.path) })),
  };
}

/** Fecha sola (YYYY-MM-DD, hora de la CDMX) para eventos de todo el día; con hora y zona para el resto. */
const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date(iso));
const when = (o: Occurrence) => ({
  startDate: o.is_all_day ? day(o.starts_at) : o.starts_at,
  ...(o.ends_at && { endDate: o.is_all_day ? day(o.ends_at) : o.ends_at }),
});

function municipalityPlace(m: Municipality) {
  return {
    "@type": "City",
    name: m.name,
    geo: { "@type": "GeoCoordinates", latitude: m.lat, longitude: m.lng },
    containedInPlace: { "@type": "State", name: m.state },
  };
}

/**
 * Un Event por fecha (Google pide uno por ocurrencia); se omiten las que ya pasaron salvo si no queda ninguna.
 * El precio solo va si lo sabemos: inventar un 0 haría que el resultado diga "Gratis" sin serlo.
 */
export function eventGraph(d: EventData) {
  const { event, occurrences, place, municipality, organization } = d;
  const url = absUrl(`/evento/${event.slug}`);
  const images = [event.image_path, ...(event.gallery_paths ?? [])].map((p) => flyerUrl(p)).filter((s): s is string => !!s);
  const now = Date.now();
  const upcoming = occurrences.filter((o) => new Date(o.ends_at ?? o.starts_at).getTime() >= now);
  const dates = (upcoming.length ? upcoming : occurrences.slice(-1)).slice(0, 12);

  const address = {
    "@type": "PostalAddress",
    ...(place?.address && { streetAddress: place.address }),
    ...(municipality && { addressLocality: municipality.name, addressRegion: municipality.state }),
    addressCountry: "MX",
  };
  const lat = place?.lat ?? municipality?.lat;
  const lng = place?.lng ?? municipality?.lng;
  const location = {
    "@type": "Place",
    name: place?.name ?? event.place_text ?? municipality?.name ?? "Por confirmar",
    address,
    ...(lat != null && lng != null && { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } }),
    ...(municipality && { containedInPlace: municipalityPlace(municipality) }),
  };
  const price = event.is_free ? 0 : event.price_min ?? event.price_max;
  const offers = price != null
    ? {
        "@type": "Offer",
        url,
        price,
        priceCurrency: "MXN",
        availability: "https://schema.org/InStock",
        ...(event.price_max != null && event.price_min != null && event.price_max > event.price_min && {
          priceSpecification: { "@type": "PriceSpecification", minPrice: event.price_min, maxPrice: event.price_max, priceCurrency: "MXN" },
        }),
      }
    : undefined;
  const organizer = organization
    ? { "@type": "Organization", name: organization.name, ...(event.website_url && { url: event.website_url }) }
    : undefined;
  const sameAs = [event.website_url, event.facebook_url, event.instagram_url, event.tiktok_url].filter(Boolean);

  return dates.map((o, i) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${url}#${i + 1}`,
    name: event.title,
    ...(event.description && { description: event.description }),
    url,
    ...when(o),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location,
    ...(images.length > 0 && { image: images }),
    isAccessibleForFree: event.is_free,
    ...(offers && { offers }),
    ...(organizer && { organizer }),
    ...(sameAs.length && { sameAs }),
    keywords: [CATEGORY_LABEL[event.category], municipality?.name, municipality?.state].filter(Boolean).join(", "),
    inLanguage: "es-MX",
  }));
}

/** Experiencia: atracción turística sin fecha; sus salidas con guía son Event aparte en sus páginas. */
export function experienceGraph(d: ExperienceData) {
  const { experience: x, place, municipality, organization } = d;
  const url = absUrl(`/experiencia/${x.slug}`);
  const images = [x.image_path, ...(x.gallery_paths ?? [])].map((p) => flyerUrl(p)).filter((s): s is string => !!s);
  const price = x.is_free ? 0 : x.price_min ?? x.price_max;
  return {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    "@id": `${url}#experiencia`,
    name: x.title,
    ...(x.description && { description: x.description }),
    url,
    ...(images.length > 0 && { image: images }),
    ...(x.lat != null && x.lng != null && { geo: { "@type": "GeoCoordinates", latitude: x.lat, longitude: x.lng } }),
    address: {
      "@type": "PostalAddress",
      ...(place?.address && { streetAddress: place.address }),
      ...(municipality && { addressLocality: municipality.name, addressRegion: municipality.state }),
      addressCountry: "MX",
    },
    ...(municipality && { containedInPlace: municipalityPlace(municipality) }),
    isAccessibleForFree: x.is_free,
    ...(price != null && { offers: { "@type": "Offer", url, price, priceCurrency: "MXN", ...(x.price_note && { description: x.price_note }) } }),
    ...(organization && { provider: { "@type": "Organization", name: organization.name } }),
    touristType: EXPERIENCE_KINDS[x.kind]?.label,
    ...(d.outings.length > 0 && {
      subjectOf: d.outings.slice(0, 6).map((o) => ({ "@type": "Event", name: o.event.title, startDate: o.starts_at, url: absUrl(`/evento/${o.event.slug}`) })),
    }),
    inLanguage: "es-MX",
  };
}

/** Página del municipio: el lugar (destino turístico) y la lista de eventos que se ven en ella. */
export function municipalityGraph(m: Municipality, events: NearRow[], experiences: ExperienceRow[] = []) {
  const url = absUrl(`/municipio/${m.slug}`);
  return [
    {
      "@context": "https://schema.org",
      "@type": "TouristDestination",
      "@id": `${url}#lugar`,
      name: m.name,
      url,
      ...(m.description && { description: m.description }),
      ...(m.cover_image_url && { image: m.cover_image_url }),
      geo: { "@type": "GeoCoordinates", latitude: m.lat, longitude: m.lng },
      containedInPlace: { "@type": "State", name: m.state, containedInPlace: { "@type": "Country", name: "México" } },
      ...(m.is_pueblo_magico && { keywords: "Pueblo Mágico" }),
    },
    ...(events.length
      ? [{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Próximos eventos en ${m.name}`,
          itemListOrder: "https://schema.org/ItemListOrderAscending",
          numberOfItems: events.length,
          itemListElement: events.map((e, i) => ({ "@type": "ListItem", position: i + 1, url: absUrl(`/evento/${e.slug}`), name: e.title })),
        }]
      : []),
    ...(experiences.length
      ? [{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Qué hacer en ${m.name} cualquier día`,
          numberOfItems: experiences.length,
          itemListElement: experiences.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: absUrl(`/experiencia/${x.slug}`), name: x.title })),
        }]
      : []),
  ];
}
