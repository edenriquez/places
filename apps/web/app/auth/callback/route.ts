import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// acciones que se completan al volver de Google (lo que la persona intentó antes de entrar)
const ACTIONS = { save: "saved_events", interest: "event_interests" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Solo rutas internas: "/x" sí; "//evil.com" o "/\evil.com" no (open redirect). */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/";
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
  }
  // si canceló en Google (sin code) simplemente vuelve; sigue pudiendo explorar sin cuenta
  return NextResponse.redirect(new URL(next, origin));
}
