export type Loc = { lat: number; lng: number; radiusKm: number; label: string; cvegeo?: string };

export const DEFAULT_LOC: Loc = { lat: 18.9853, lng: -99.0997, radiusKm: 30, label: "Tepoztlán", cvegeo: "17020" };
export const LOC_COOKIE = "el_loc";
export const RADII = [10, 30, 60] as const;

export function parseLoc(raw: string | undefined): Loc {
  if (!raw) return DEFAULT_LOC;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    if (typeof v.lat === "number" && typeof v.lng === "number") {
      return {
        lat: v.lat,
        lng: v.lng,
        radiusKm: RADII.includes(v.radiusKm) ? v.radiusKm : 30,
        label: typeof v.label === "string" ? v.label.slice(0, 60) : "Tu ubicación",
        cvegeo: typeof v.cvegeo === "string" ? v.cvegeo : undefined,
      };
    }
  } catch {}
  return DEFAULT_LOC;
}

export function serializeLoc(loc: Loc) {
  return encodeURIComponent(JSON.stringify(loc));
}
