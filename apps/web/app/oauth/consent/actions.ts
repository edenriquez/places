"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Aprueba o rechaza la autorización OAuth pendiente y regresa al cliente (ChatGPT/Claude) con el código. */
export async function decide(formData: FormData) {
  const id = String(formData.get("authorization_id") ?? "");
  const approve = formData.get("decision") === "approve";
  const sb = await createClient();
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (!isAdmin && approve) throw new Error("No autorizado");
  const { data, error } = approve
    ? await sb.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
    : await sb.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (error || !data) throw new Error(error?.message ?? "No se pudo completar la autorización");
  redirect(data.redirect_url);
}
