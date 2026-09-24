"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function admin() {
  const sb = await createClient();
  const { data: ok } = await sb.rpc("is_admin");
  if (!ok) throw new Error("No autorizado");
  return sb;
}

/** Link de solo lectura para el comercio: uno vigente por evento (si ya hay, se reutiliza). */
export async function createReportLink(eventId: string) {
  const sb = await admin();
  const { data: existing } = await sb.from("event_report_links").select("token").eq("event_id", eventId).is("revoked_at", null).maybeSingle();
  if (existing) return existing.token as string;
  const { data: { user } } = await sb.auth.getUser();
  const token = randomBytes(32).toString("base64url");
  const { error } = await sb.from("event_report_links").insert({ token, event_id: eventId, created_by: user?.id });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${eventId}/metricas`);
  return token;
}

export async function revokeReportLink(eventId: string) {
  const sb = await admin();
  await sb.from("event_report_links").update({ revoked_at: new Date().toISOString() }).eq("event_id", eventId).is("revoked_at", null);
  revalidatePath(`/admin/events/${eventId}/metricas`);
}
