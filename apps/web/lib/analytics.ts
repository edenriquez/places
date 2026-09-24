/** Tipos de evento que acepta /api/t (el check de la tabla dice lo mismo). */
export const TRACK_TYPES = [
  "pageview", "share_whatsapp", "call", "whatsapp_contact", "maps", "waze", "social", "website",
  "flyer_zoom", "save", "unsave", "interest", "uninterest", "login_start", "search", "filter",
] as const;
export type TrackType = (typeof TRACK_TYPES)[number];

/** Lo que manda el navegador (el servidor agrega ubicación, fuente clasificada y dispositivo). */
export type TrackPayload = {
  type: TrackType;
  path: string;
  referrer?: string;
  sessionId?: string;
  event?: string; // uuid del evento cuando la acción es sobre uno
  props?: Record<string, string | number | boolean>;
};

/** Acciones que cuentan como "hizo algo" con un evento. */
export const ACTION_LABEL: Record<string, string> = {
  call: "Llamadas",
  whatsapp_contact: "WhatsApp al organizador",
  maps: "Abrir en Maps",
  waze: "Waze",
  share_whatsapp: "Compartidos",
  social: "Redes del evento",
  website: "Sitio web",
  save: "Guardados",
  interest: "Me interesa",
};

export const SOURCE_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  google: "Google",
  buscador: "Otros buscadores",
  interno: "entrelugares",
  directo: "Directo",
  otro: "Otros sitios",
  "sin dato": "Sin dato",
};

const has = (s: string | null | undefined, re: RegExp) => !!s && re.test(s);

/**
 * Fuente de una visita. Primero la UTM (los links que compartimos la llevan), luego pistas de la URL
 * (fbclid…) y al final el referer. WhatsApp casi nunca manda referer: sin la UTM cae en "directo".
 */
export function classifySource(url: URL, referrer: string | undefined, selfHost: string): { source: string; referrerHost: string | null } {
  let refHost: string | null = null;
  try {
    refHost = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : null;
  } catch {
    refHost = referrer?.startsWith("android-app://") ? referrer.slice(14).split("/")[0] : null;
  }
  const utm = url.searchParams.get("utm_source")?.toLowerCase() ?? "";
  if (utm) {
    for (const s of ["whatsapp", "facebook", "instagram", "tiktok", "google"]) if (utm.includes(s)) return { source: s, referrerHost: refHost };
    if (utm === "wa" || utm === "wa.me") return { source: "whatsapp", referrerHost: refHost };
    return { source: "otro", referrerHost: refHost ?? utm };
  }
  if (url.searchParams.has("fbclid")) return { source: "facebook", referrerHost: refHost };
  if (url.searchParams.has("igshid")) return { source: "instagram", referrerHost: refHost };
  if (url.searchParams.has("gclid")) return { source: "google", referrerHost: refHost };
  if (!refHost) return { source: "directo", referrerHost: null };
  if (refHost === selfHost) return { source: "interno", referrerHost: refHost };
  if (has(refHost, /(^|\.)(wa\.me|whatsapp\.com)$|com\.whatsapp/)) return { source: "whatsapp", referrerHost: refHost };
  if (has(refHost, /(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$|com\.facebook/)) return { source: "facebook", referrerHost: refHost };
  if (has(refHost, /(^|\.)instagram\.com$|com\.instagram/)) return { source: "instagram", referrerHost: refHost };
  if (has(refHost, /(^|\.)tiktok\.com$|musically/)) return { source: "tiktok", referrerHost: refHost };
  if (has(refHost, /(^|\.)google\.[a-z.]+$|com\.google/)) return { source: "google", referrerHost: refHost };
  if (has(refHost, /(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org)$/)) return { source: "buscador", referrerHost: refHost };
  return { source: "otro", referrerHost: refHost };
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp\/|preview|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch/i;
export const isBot = (ua: string | null) => !ua || BOT.test(ua);
export const deviceOf = (ua: string | null) => (ua && /mobi|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop");

/** Estados (ISO 3166-2:MX sin el prefijo) que manda Vercel en x-vercel-ip-country-region. */
export const REGION_LABEL: Record<string, string> = {
  AGU: "Aguascalientes", BCN: "Baja California", BCS: "Baja California Sur", CAM: "Campeche", CHP: "Chiapas",
  CHH: "Chihuahua", CMX: "Ciudad de México", COA: "Coahuila", COL: "Colima", DUR: "Durango", GUA: "Guanajuato",
  GRO: "Guerrero", HID: "Hidalgo", JAL: "Jalisco", MEX: "Estado de México", MIC: "Michoacán", MOR: "Morelos",
  NAY: "Nayarit", NLE: "Nuevo León", OAX: "Oaxaca", PUE: "Puebla", QUE: "Querétaro", ROO: "Quintana Roo",
  SLP: "San Luis Potosí", SIN: "Sinaloa", SON: "Sonora", TAB: "Tabasco", TAM: "Tamaulipas", TLA: "Tlaxcala",
  VER: "Veracruz", YUC: "Yucatán", ZAC: "Zacatecas",
};
export const regionLabel = (r: string | null | undefined) => (r ? REGION_LABEL[r] ?? r : "Sin dato");
