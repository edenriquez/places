import { planIcsEvent, type GroupPlan } from "@/lib/group-plans";
import { ics, icsResponse, type IcsEvent } from "@/lib/ics";
import { SITE_URL } from "@/lib/site";
import { createAnonClient } from "@/lib/supabase/server";

type FeedEvent = {
  event_id: string; occurrence_id: string; slug: string; title: string; starts_at: string; ends_at: string | null;
  is_all_day: boolean; place_name: string | null; municipality_name: string;
};
type Feed = { me: string; plans: GroupPlan[]; events: FeedEvent[] };

/**
 * Calendario suscrito (webcal) de una persona: sus planes en grupo y lo que marcó con "Me interesa".
 * Apple, Google y Outlook lo vuelven a pedir solos: si alguien se une o el plan se cancela, se actualiza.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!/^[0-9a-f]{36}$/.test(token)) return new Response("No encontrado", { status: 404 });
  const { data } = await createAnonClient().rpc("plans_feed", { p_token: token });
  if (!data) return new Response("No encontrado", { status: 404 });
  const feed = data as Feed;
  const events: IcsEvent[] = [
    ...feed.plans.map((p) => planIcsEvent(p, feed.me)),
    ...feed.events.map((e) => {
      const url = `${SITE_URL}/evento/${e.slug}?utm_source=calendario&utm_medium=webcal`;
      return {
        uid: e.occurrence_id,
        title: e.title,
        start: new Date(e.starts_at),
        end: e.ends_at ? new Date(e.ends_at) : null,
        allDay: e.is_all_day,
        description: url,
        location: [e.place_name, e.municipality_name].filter(Boolean).join(", "),
        url,
        alarms: e.is_all_day ? [1440] : [1440, 120],
      };
    }),
  ];
  return icsResponse(ics(events, "Mis planes · Entre Lugares"), "mis-planes", { personal: true, inline: true });
}
