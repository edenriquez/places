const TZ = "America/Mexico_City";

const dayShort = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const dayLong = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const time = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
const monthShort = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: TZ });

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function clean(s: string) {
  return s.replace(/\./g, "").replace(/,/g, "");
}

/** "Sáb 27 sep · 19:00" */
export function fmtWhenShort(startsAt: string, isAllDay = false) {
  const d = new Date(startsAt);
  const day = cap(clean(dayShort.format(d)));
  return isAllDay ? day : `${day} · ${time.format(d)}`;
}

/** "Sábado 27 de septiembre · 19:00 a 23:00" */
export function fmtWhenLong(startsAt: string, endsAt: string | null, isAllDay = false) {
  const s = new Date(startsAt);
  const day = cap(dayLong.format(s));
  if (isAllDay) return `${day} · todo el día`;
  const t1 = time.format(s);
  if (endsAt) return `${day} · ${t1} a ${time.format(new Date(endsAt))}`;
  return `${day} · ${t1}`;
}

export function fmtTime(iso: string) {
  return time.format(new Date(iso));
}

export function fmtMonthShort(month: number) {
  return cap(clean(monthShort.format(new Date(2026, month - 1, 15))));
}

export function fmtPrice(isFree: boolean, min: number | null, max: number | null) {
  if (isFree) return "Gratis";
  if (min == null && max == null) return "Consultar";
  const f = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
  if (min != null && max != null && max > min) return `${f(min)} – ${f(max)}`;
  return f((min ?? max)!);
}

export function fmtDistance(m: number) {
  if (m < 950) return `${Math.round(m / 50) * 50} m`;
  return `${Math.round(m / 1000)} km`;
}

export function relativeTime(iso: string | null) {
  if (!iso) return "nunca";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
  return `hace ${Math.round(diff / 86400)} d`;
}

export function flyerUrl(path: string | null) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/flyers/${path}`;
}

export function isWithinMinutes(iso: string | null | undefined, minutes: number) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < minutes * 60 * 1000;
}
