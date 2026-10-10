"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { afterLoad } from "@/lib/idle";
import { setTrackUser, track } from "@/lib/track";
import { LoginSheet } from "./login-sheet";

/**
 * Qué quería hacer la persona cuando le pedimos entrar; el callback lo completa al volver de Google.
 * `join`: unirse a un plan (por link de invitación o abierto). `plan`: armar uno (al volver se abre el formulario).
 */
export type Intent =
  | { do: "save" | "interest"; eventId: string }
  | { do: "join"; planId?: string; code?: string }
  | { do: "plan" };

type Ctx = {
  user: User | null;
  ready: boolean;
  saved: Set<string>;
  interested: Set<string>;
  counts: Record<string, number>;
  /** Lo que intentó alguien sin cuenta: el botón se ve activo (y anima) mientras decide si entra. */
  pending: Intent | null;
  toggleSave: (eventId: string) => void;
  toggleInterest: (eventId: string) => void;
  /** Al armar o unirse a un plan de un evento, el servidor ya lo marcó con "Me interesa": reflejarlo sin recargar. */
  noteInterest: (eventId: string) => void;
  loadCounts: (eventIds: string[]) => void;
  openLogin: (intent?: Intent) => void;
  signIn: (intent?: Intent) => Promise<void>;
  signOut: () => Promise<void>;
};

const EMPTY: Set<string> = new Set();
/** Lo que dura la animación del CTA antes de pedir cuenta. */
const LOGIN_DELAY_MS = 850;

const SessionCtx = createContext<Ctx | null>(null);

// supabase-js (~70 KB br, con Realtime y auth) va en su propio chunk: no compite con el flyer ni con la
// hidratación; se baja después del load o al primer toque que lo necesite
let client: Promise<SupabaseClient> | undefined;
export const getClient = () => (client ??= import("@/lib/supabase/client").then((m) => m.createClient()));

export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession fuera de SessionProvider");
  return ctx;
}

const toggled = (s: Set<string>, id: string, on: boolean) => {
  const next = new Set(s);
  if (on) next.add(id);
  else next.delete(id);
  return next;
};

/**
 * Sesión del público, solo en el cliente: las páginas públicas están cacheadas y no leen cookies,
 * así que guardados, "me interesa" y conteos se hidratan aquí.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  // guardados e intereses de quién: al cambiar de cuenta (o salir) se ignoran los de la anterior
  const [mine, setMine] = useState<{ uid: string; saved: Set<string>; interested: Set<string> } | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [login, setLogin] = useState<{ intent?: Intent } | null>(null);
  const [pending, setPending] = useState<Intent | null>(null);
  const loginTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // sin cuenta: primero la animación de guardado/interés, después la hoja de login
  const requireLogin = useCallback((intent: Intent) => {
    setPending(intent);
    clearTimeout(loginTimer.current);
    loginTimer.current = setTimeout(() => setLogin({ intent }), LOGIN_DELAY_MS);
  }, []);
  const closeLogin = useCallback(() => {
    clearTimeout(loginTimer.current);
    setLogin(null);
    setPending(null);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let live = true;
    const cancel = afterLoad(() => {
      getClient().then((sb) => {
        if (!live) return;
        const { data } = sb.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
          setTrackUser(session?.user?.id ?? null);
          setReady(true);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      });
    });
    return () => { live = false; cancel(); unsubscribe?.(); };
  }, []);

  const uid = user?.id;
  const current = mine && mine.uid === uid ? mine : null;
  const saved = current?.saved ?? EMPTY;
  const interested = current?.interested ?? EMPTY;
  const setSaved = (f: (s: Set<string>) => Set<string>) => setMine((m) => (m ? { ...m, saved: f(m.saved) } : m));
  const setInterested = (f: (s: Set<string>) => Set<string>) => setMine((m) => (m ? { ...m, interested: f(m.interested) } : m));

  useEffect(() => {
    if (!uid) return;
    let live = true;
    getClient().then((sb) => Promise.all([
      sb.from("saved_events").select("event_id"),
      sb.from("event_interests").select("event_id"),
    ])).then(([s, i]) => {
      if (!live) return;
      setMine({
        uid,
        saved: new Set((s.data ?? []).map((r) => r.event_id as string)),
        interested: new Set((i.data ?? []).map((r) => r.event_id as string)),
      });
    });
    return () => { live = false; };
  }, [uid]);

  // conteos: se juntan las peticiones del mismo tick (móvil y escritorio montan el detalle a la vez)
  const requested = useRef(new Set<string>());
  const queued = useRef(new Set<string>());
  const loadCounts = useCallback((ids: string[]) => {
    const fresh = ids.filter((id) => !requested.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => { requested.current.add(id); queued.current.add(id); });
    setTimeout(async () => {
      const batch = [...queued.current];
      queued.current.clear();
      if (!batch.length) return;
      const { data } = await (await getClient()).rpc("interest_counts", { event_ids: batch });
      const got: Record<string, number> = Object.fromEntries(batch.map((id) => [id, 0]));
      for (const r of (data ?? []) as { event_id: string; n: number }[]) got[r.event_id] = r.n;
      setCounts((c) => ({ ...c, ...got }));
    }, 0);
  }, []);

  const signIn = useCallback(async (intent?: Intent) => {
    const eventId = intent && "eventId" in intent ? intent.eventId : undefined;
    track("login_start", { event: eventId, props: intent ? { intent: intent.do } : undefined });
    const params = new URLSearchParams({ next: location.pathname + location.search + (intent?.do === "plan" ? "#plan" : "") });
    if (intent) params.set("do", intent.do);
    if (eventId) params.set("event", eventId);
    if (intent?.do === "join") {
      if (intent.planId) params.set("plan", intent.planId);
      if (intent.code) params.set("code", intent.code);
    }
    await (await getClient()).auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?${params}` },
    });
  }, []);

  const signOut = useCallback(async () => {
    await (await getClient()).auth.signOut();
    router.refresh();
  }, [router]);

  const toggleSave = useCallback((eventId: string) => {
    if (!uid) return requireLogin({ do: "save", eventId });
    const on = !saved.has(eventId);
    track(on ? "save" : "unsave", { event: eventId });
    setSaved((s) => toggled(s, eventId, on));
    getClient().then((sb) => on
      ? sb.from("saved_events").insert({ user_id: uid, event_id: eventId })
      : sb.from("saved_events").delete().eq("user_id", uid).eq("event_id", eventId),
    ).then(({ error }) => {
      if (error && error.code !== "23505") setSaved((s) => toggled(s, eventId, !on));
      else if (location.pathname === "/guardados") router.refresh(); // la lista es de servidor
    });
  }, [uid, saved, router, requireLogin]);

  const toggleInterest = useCallback((eventId: string) => {
    if (!uid) return requireLogin({ do: "interest", eventId });
    const on = !interested.has(eventId);
    track(on ? "interest" : "uninterest", { event: eventId });
    const bump = (d: number) => setCounts((c) => ({ ...c, [eventId]: Math.max(0, (c[eventId] ?? 0) + d) }));
    setInterested((s) => toggled(s, eventId, on));
    bump(on ? 1 : -1);
    getClient().then((sb) => on
      ? sb.from("event_interests").insert({ user_id: uid, event_id: eventId })
      : sb.from("event_interests").delete().eq("user_id", uid).eq("event_id", eventId),
    ).then(({ error }) => {
      if (error && error.code !== "23505") {
        setInterested((s) => toggled(s, eventId, !on));
        bump(on ? -1 : 1);
      }
    });
  }, [uid, interested, requireLogin]);

  const noteInterest = useCallback((eventId: string) => {
    if (interested.has(eventId)) return;
    setInterested((s) => toggled(s, eventId, true));
    setCounts((c) => (c[eventId] === undefined ? c : { ...c, [eventId]: c[eventId] + 1 }));
  }, [interested]);

  const value: Ctx = {
    user, ready, saved, interested, counts, pending,
    toggleSave, toggleInterest, noteInterest, loadCounts,
    openLogin: (intent) => setLogin({ intent }),
    signIn, signOut,
  };

  return (
    <SessionCtx.Provider value={value}>
      {children}
      {login && <LoginSheet intent={login.intent} onClose={closeLogin} onGoogle={() => signIn(login.intent)} />}
    </SessionCtx.Provider>
  );
}
