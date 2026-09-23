/**
 * Dónde busca la persona. Dos modos:
 * - radio: punto (pueblo o GPS) + radiusKm
 * - estado: stateCve (clave INEGI de 2 dígitos, prefijo del cvegeo); lat/lng es el centro del estado
 */
export type Loc = { lat: number; lng: number; radiusKm: number; label: string; cvegeo?: string; stateCve?: string; gps?: boolean };

export const DEFAULT_LOC: Loc = { lat: 18.9853, lng: -99.0997, radiusKm: 30, label: "Tepoztlán", cvegeo: "17020" };
export const LOC_COOKIE = "el_loc";
export const RADII = [10, 30, 60] as const;
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
        radiusKm: RADII.includes(v.radiusKm) || v.radiusKm === EXPLORE ? v.radiusKm : 30,
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

/** "a menos de 30 km de Tlalmanalco" · "en Morelos" */
export function whereText(loc: Loc) {
  if (loc.stateCve) return `en ${loc.label}`;
  return loc.radiusKm === EXPLORE ? `en toda la región` : `a menos de ${loc.radiusKm} km de ${loc.label}`;
}

/** "cerca de Tlalmanalco" · "en Morelos" */
export function nearText(loc: Loc) {
  return loc.stateCve ? `en ${loc.label}` : `cerca de ${loc.label}`;
}
