"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin/upload");
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) redirect(`/admin/login?error=bad&next=${encodeURIComponent(next)}`);
  // /oauth/consent: autorizar a ChatGPT/Claude en el MCP después de entrar
  redirect(next.startsWith("/admin") || next.startsWith("/oauth/consent?") ? next : "/admin/upload");
}
