import { SITE_HOST, SITE_NAME } from "./site";

/** iCalendar mínimo (RFC 5545): sirve para Apple Calendar, Google Calendar y Outlook. */

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const ymd = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d).replace(/-/g, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
// líneas de máximo 75 octetos; aquí basta cortar por caracteres
const fold = (line: string) => line.match(/.{1,72}/gu)?.join("\r\n ") ?? line;

export type IcsEvent = {
  uid: string;
  title: string;
  start: Date;
  end?: Date | null;
  allDay?: boolean;
  description?: string;
  location?: string;
  url?: string;
  /** "RRULE:FREQ=WEEKLY;BYDAY=TH" */
  rrule?: string;
  /** minutos antes del inicio: [1440, 120] = un día y dos horas antes */
  alarms?: number[];
};

export function ics(events: IcsEvent[], calName = SITE_NAME) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${SITE_NAME}//planes//ES`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(calName)}`];
  for (const e of events) {
    const end = e.end ?? new Date(e.start.getTime() + (e.allDay ? 86400e3 : 2 * 3600e3));
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@${SITE_HOST}`,
      `DTSTAMP:${utc(new Date())}`,
      ...(e.allDay
        ? [`DTSTART;VALUE=DATE:${ymd(e.start)}`, `DTEND;VALUE=DATE:${ymd(new Date(Math.max(end.getTime(), e.start.getTime() + 86400e3)))}`]
        : [`DTSTART:${utc(e.start)}`, `DTEND:${utc(end)}`]),
      `SUMMARY:${esc(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      ...(e.rrule ? [e.rrule] : []),
      ...(e.alarms ?? []).flatMap((m) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${m}M`, "END:VALARM"]),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function icsResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}.ics"`,
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}
