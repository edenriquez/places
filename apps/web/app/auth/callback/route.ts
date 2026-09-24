import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// acciones que se completan al volver de Google (lo que la persona intentó antes de entrar)
const ACTIONS = { save: "saved_events", interest: "event_interests" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Solo rutas internas: "/x" sí; "//evil.com" o "/\evil.com" no (open redirect). */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/";
}

/** Ata el navegador (cookie el_vid) a la cuenta, con la fuente de su primera visita: de ahí sale la adquisición. */
async function linkVisitor(request: NextRequest, userId: string) {
  const visitor = request.cookies.get("el_vid")?.value;
  const svc = createServiceClient();
  if (!svc || !visitor || !UUID.test(visitor)) return;
  const { data: first } = await svc.from("analytics_events").select("source")
    .eq("visitor_id", visitor).eq("type", "pageview").order("ts").limit(1).maybeSingle();
  await svc.from("visitor_users").upsert(
    { visitor_id: visitor, user_id: userId, first_source: (first?.source as string | undefined) ?? null },
    { onConflict: "visitor_id,user_id", ignoreDuplicates: true },
  );
}

/** Regreso de Google OAuth: canjea el código por sesión, completa la acción pendiente y vuelve a donde estaba. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");

  if (code) {
    const sb = await createClient();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    const table = ACTIONS[searchParams.get("do") as keyof typeof ACTIONS];
    const eventId = searchParams.get("event");
    if (!error && data.user && table && eventId && UUID.test(eventId)) {
      await sb.from(table).upsert({ user_id: data.user.id, event_id: eventId }, { onConflict: "user_id,event_id", ignoreDuplicates: true });
    }
    if (!error && data.user) await linkVisitor(request, data.user.id);
  }
  // si canceló en Google (sin code) simplemente vuelve; sigue pudiendo explorar sin cuenta
  return NextResponse.redirect(new URL(next, origin));
}
