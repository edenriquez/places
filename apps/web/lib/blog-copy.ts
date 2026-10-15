/** Idiomas del blog: el español vive en /blog y el inglés en /en/blog. El resto del sitio es solo en español. */
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const BLOG_BASE: Record<Locale, string> = { es: "/blog", en: "/en/blog" };
export const postPath = (slug: string, locale: Locale) => `${BLOG_BASE[locale]}/${slug}`;

/** Para <html lang>, hreflang y schema.org */
export const LANG_TAG: Record<Locale, string> = { es: "es-MX", en: "en" };

export const BLOG_COPY = {
  es: {
    blog: "Guías",
    indexTitle: "Guías para salir de la CDMX",
    indexLead: "Fiestas, ferias y escapadas en los pueblos de Morelos y el Estado de México: qué ver, qué días ir y qué eventos ya están confirmados.",
    indexMetaTitle: "Guías: ferias, fiestas y escapadas cerca de la CDMX",
    indexMetaDescription: "Guías para salir de la CDMX: qué fiestas y ferias hay en los pueblos de Morelos y Estado de México, qué días conviene ir, cuánto se hace de camino y qué eventos ya están confirmados.",
    indexOgTitle: "Ferias, fiestas y escapadas cerca de la CDMX",
    indexOgSubtitle: "Qué ver, qué días ir y a cuánto queda cada pueblo",
    empty: "Pronto habrá guías aquí",
    updated: "Actualizada el",
    minRead: (n: number) => `${n} min de lectura`,
    minShort: (n: number) => `${n} min`,
    toc: "En esta guía",
    events: "Eventos en estas fechas",
    eventsLead: "Lo que ya está en la cartelera. Cada evento lo revisa una persona; las fiestas sin flyer aparecen con fecha estimada.",
    eventsPast: "Esta temporada ya pasó. Las fechas del próximo año aparecen en cada pueblo:",
    eventsEmpty: "Aún no hay eventos confirmados para estas fechas",
    eventsEmptyHint: "Los agregamos conforme llegan los flyers. Mientras, revisa cada pueblo:",
    faq: "Preguntas frecuentes",
    towns: "Los pueblos de esta guía",
    ctaTitle: "¿Organizas algo en estas fechas?",
    ctaBody: "Sube el flyer y aparece en la cartelera y en esta guía. Es gratis.",
    ctaLink: "Publicar un evento",
    switchTo: "Read in English",
    guide: "Guía",
    townCount: (n: number) => `${n} ${n === 1 ? "pueblo" : "pueblos"}`,
    explore: "Explorar",
    notFound: "Guía no encontrada",
  },
  en: {
    blog: "Guides",
    indexTitle: "Day trips from Mexico City",
    indexLead: "Festivals, fairs and town traditions in Morelos and the State of Mexico: what to see, which days to go and which events are already confirmed.",
    indexMetaTitle: "Guides: festivals, fairs and day trips from Mexico City",
    indexMetaDescription: "Guides for getting out of Mexico City: festivals and fairs in the towns of Morelos and the State of Mexico, the best days to go, travel times and confirmed events.",
    indexOgTitle: "Festivals and day trips from Mexico City",
    indexOgSubtitle: "What to see, when to go and how far each town is",
    empty: "Guides are coming soon",
    updated: "Updated",
    minRead: (n: number) => `${n} min read`,
    minShort: (n: number) => `${n} min`,
    toc: "In this guide",
    events: "Events on these dates",
    eventsLead: "What is already on the Entre Lugares listings (in Spanish). Every event is checked by a person; festivals without a flyer show an estimated date.",
    eventsPast: "This season is over. Next year's dates appear on each town's page:",
    eventsEmpty: "No confirmed events for these dates yet",
    eventsEmptyHint: "We add them as flyers come in. Meanwhile, check each town:",
    faq: "Frequently asked questions",
    towns: "Towns in this guide",
    ctaTitle: "Organizing something on these dates?",
    ctaBody: "Upload the flyer and it shows up in the listings and in this guide. It's free.",
    ctaLink: "Publish an event",
    switchTo: "Leer en español",
    guide: "Guide",
    townCount: (n: number) => `${n} ${n === 1 ? "town" : "towns"}`,
    explore: "Explore",
    notFound: "Guide not found",
  },
} satisfies Record<Locale, Record<string, unknown>>;
