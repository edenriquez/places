/**
 * Dónde busca la persona. Dos modos:
 * - radio: punto (pueblo o GPS) + radiusKm
 * - estado: stateCve (clave INEGI de 2 dígitos, prefijo del cvegeo); lat/lng es el centro del estado
 */
export type Loc = { lat: number; lng: number; radiusKm: number; label: string; cvegeo?: string; stateCve?: string; gps?: boolean };

/**
 * Radios por tiempo de camino. Las distancias son en línea recta; en el corredor Morelos–Edomex se maneja a
 * ~55–60 km/h promedio (carretera, sierra, pueblos) y el camino real es ~1.4× la línea recta: ~40 km de línea
 * recta por hora. Ajustar aquí si se siente corto o largo; todo lo demás (consultas, mapa, textos) sale de esto.
 */
export const KM_PER_HOUR = 40;
/** Pasos del deslizador del mapa (después del último va "Toda la región"). */
export const HOURS = [0.5, 1, 1.5, 2, 3] as const;
export const RADII = HOURS.map((h) => h * KM_PER_HOUR);
/** Radio con el que arranca quien no ha elegido: 1 h. */
export const DEFAULT_RADIUS = KM_PER_HOUR;

/** Tiempo de camino de un radio: "30 min", "1 h", "1 h 30 min" (short: "1½ h"). */
export function radiusLabel(km: number, short = false) {
  const h = Math.max(0.5, Math.round((km / KM_PER_HOUR) * 2) / 2);
  if (h < 1) return `${Math.round(h * 60)} min`;
  const whole = Math.floor(h);
  if (h === whole) return `${whole} h`;
  return short ? `${whole}½ h` : `${whole} h 30 min`;
}

export const DEFAULT_LOC: Loc = { lat: 18.9853, lng: -99.0997, radiusKm: DEFAULT_RADIUS, label: "Tepoztlán", cvegeo: "17020" };
export const LOC_COOKIE = "el_loc";

// cookies viejas (10/30/60 km) o cualquier valor fuera de la lista: al radio por tiempo más cercano hacia arriba
const snapRadius = (km: unknown) =>
  km === EXPLORE ? EXPLORE : typeof km === "number" && km > 0 ? (RADII.find((r) => r >= km) ?? RADII[RADII.length - 1]) : DEFAULT_RADIUS;
/** radiusKm = 0: "Explorar", sin límite de distancia (mapa libre, eventos de toda la región). */
export const EXPLORE = 0;

export function parseLoc(raw: string | undefined): Loc {
  if (!raw) return DEFAULT_LOC;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    if (typeof v.lat === "number" && typeof v.lng === "number") {
      return {
        lat: v.lat,
        lng: v.lng,
        radiusKm: snapRadius(v.radiusKm),
        label: typeof v.label === "string" ? v.label.slice(0, 60) : "Tu ubicación",
        cvegeo: typeof v.cvegeo === "string" ? v.cvegeo : undefined,
        stateCve: typeof v.stateCve === "string" && /^\d{2}$/.test(v.stateCve) ? v.stateCve : undefined,
        gps: v.gps === true || undefined,
      };
    }
  } catch {}
  return DEFAULT_LOC;
}

export function serializeLoc(loc: Loc) {
  return encodeURIComponent(JSON.stringify(loc));
}

/** "a menos de 1 h de Tlalmanalco" · "en Morelos" */
export function whereText(loc: Loc) {
  if (loc.stateCve) return `en ${loc.label}`;
  return loc.radiusKm === EXPLORE ? `en toda la región` : `a menos de ${radiusLabel(loc.radiusKm)} de ${loc.label}`;
}

/** "cerca de Tlalmanalco" · "en Morelos" */
export function nearText(loc: Loc) {
  return loc.stateCve ? `en ${loc.label}` : `cerca de ${loc.label}`;
}
