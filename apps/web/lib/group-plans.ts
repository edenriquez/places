import { fmtWhenShort } from "./format";
import type { IcsEvent } from "./ics";
import { SITE_URL } from "./site";

/** De las personas solo se ve el primer nombre y la foto de su cuenta. */
export type Person = { id: string; name: string; avatar: string | null };

/** A dónde va el plan: un evento (una de sus fechas) o una experiencia (el día que eligió quien lo armó). */
export type PlanTarget = {
  kind: "event" | "experience";
  id: string;
  slug: string;
  title: string;
  image_path: string | null;
  image_focus_x: number;
  image_focus_y: number;
  place_name: string | null;
  municipality_name: string;
  lat: number | null;
  lng: number | null;
};

/** Lo que devuelven create_plan, join_plan, my_plans, plan_by_code, plans_for y open_plans_near. */
export type GroupPlan = {
  id: string;
  /** link de invitación: solo lo ven quienes ya están en el plan */
  code: string | null;
  role: "host" | "member" | null;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  /** abierto: lo ven y se pueden sumar personas cerca o interesadas en el mismo evento */
  is_open: boolean;
  max_people: number;
  meeting_point: string | null;
  note: string | null;
  status: "active" | "cancelled";
  going: number;
  /** null y people vacío para visitantes sin cuenta en listados */
  host: Person | null;
  people: Person[];
  target: PlanTarget;
  /** open_plans_near: a quien pregunta le interesa ese evento */
  interested?: boolean;
};

export const targetHref = (t: Pick<PlanTarget, "kind" | "slug">) => (t.kind === "event" ? `/evento/${t.slug}` : `/experiencia/${t.slug}`);

export const planUrl = (code: string, source: string) =>
  `${SITE_URL}/plan/${code}?utm_source=${source}&utm_medium=share&utm_campaign=plan`;

export const planIsOver = (p: Pick<GroupPlan, "starts_at" | "ends_at" | "is_all_day">, now = Date.now()) =>
  (p.ends_at ? new Date(p.ends_at).getTime() : new Date(p.starts_at).getTime() + (p.is_all_day ? 24 : 6) * 3600e3) < now;

export const spotsLeft = (p: Pick<GroupPlan, "max_people" | "going">) => Math.max(0, p.max_people - p.going);

const list = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`);

/** "Vas con Ana y Luis" · "Vas con Ana, Luis y 3 más" · "Por ahora solo tú" */
export function withWhom(people: Person[], meId: string | undefined) {
  const others = people.filter((p) => p.id !== meId).map((p) => p.name);
  if (!others.length) return "Por ahora solo tú";
  if (others.length <= 3) return `Vas con ${list(others)}`;
  return `Vas con ${others.slice(0, 2).join(", ")} y ${others.length - 2} más`;
}

/** "Ana y 2 más van" para quien todavía no está en el plan. */
export function whoGoes(p: Pick<GroupPlan, "host" | "going">) {
  const host = p.host?.name ?? "Alguien";
  return p.going <= 1 ? `${host} va` : `${host} y ${p.going - 1} ${p.going === 2 ? "persona más van" : "personas más van"}`;
}

/** El plan en el calendario: "Feria del Elote · con Ana y Luis", con quién va, dónde se ven y la nota. */
export function planIcsEvent(p: GroupPlan, meId?: string): IcsEvent {
  const others = p.people.filter((x) => x.id !== meId).map((x) => x.name);
  const url = p.code ? `${SITE_URL}/plan/${p.code}?utm_source=calendario&utm_medium=ics` : `${SITE_URL}${targetHref(p.target)}`;
  const place = [p.target.place_name, p.target.municipality_name].filter(Boolean).join(", ");
  return {
    uid: `plan-${p.id}`,
    title: others.length ? `${p.target.title} · con ${list(others.slice(0, 4))}${others.length > 4 ? " y más" : ""}` : p.target.title,
    start: new Date(p.starts_at),
    end: p.ends_at ? new Date(p.ends_at) : null,
    allDay: p.is_all_day,
    description: [
      `Van: ${p.people.map((x) => (x.id === meId ? "tú" : x.name)).join(", ")}`,
      p.meeting_point && `Se ven en ${p.meeting_point}`,
      p.note && `“${p.note}”`,
      url,
    ].filter(Boolean).join("\n"),
    location: p.meeting_point ? `${p.meeting_point} · ${place}` : place,
    url,
    alarms: p.is_all_day ? [1440] : [1440, 120],
  };
}

export function planInviteText(p: Pick<GroupPlan, "target" | "starts_at" | "is_all_day" | "meeting_point">, code: string) {
  const where = p.meeting_point ? ` · nos vemos en ${p.meeting_point}` : "";
  return `¿Te apuntas? Armé un plan: ${p.target.title} · ${fmtWhenShort(p.starts_at, p.is_all_day)} en ${p.target.municipality_name}${where}. `
    + `Si te unes, nos aparece a todos en el calendario 👉 ${planUrl(code, "whatsapp")}`;
}
