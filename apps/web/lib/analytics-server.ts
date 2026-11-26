import type { SupabaseClient } from "@supabase/supabase-js";

// cuentas admin (user_id → es admin); en memoria mientras viva la función
const adminIds = new Map<string, boolean>();
export async function isAdminUser(sb: SupabaseClient, uid: string) {
  if (!adminIds.has(uid)) {
    const { data } = await sb.from("admin_users").select("user_id").eq("user_id", uid).maybeSingle();
    if (adminIds.size > 2000) adminIds.clear();
    adminIds.set(uid, !!data);
  }
  return adminIds.get(uid)!;
}
