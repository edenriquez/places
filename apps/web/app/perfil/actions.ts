"use server";

import { CATEGORY_LABEL } from "@/lib/types";
import { COMPANIONS, type Profile } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

const CATS = new Set(Object.keys(CATEGORY_LABEL));
const COMP = new Set<string>(COMPANIONS.map((c) => c.id));

/** Guarda las preferencias declaradas (se llama en cada cambio de chip o de pueblo). */
export async function savePreferences(p: Profile) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, error: "Necesitas entrar" };
  const { error } = await sb.from("profiles").upsert({
    user_id: user.id,
    home_municipality: p.home_municipality || null,
    categories: p.categories.filter((c) => CATS.has(c)),
    companions: p.companions.filter((c) => COMP.has(c)),
  });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
