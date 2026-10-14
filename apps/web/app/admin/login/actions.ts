"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin/upload");
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) redirect(`/admin/login?error=bad&next=${encodeURIComponent(next)}`);
  // el proxy también la pone en /admin, pero el redirect de esta acción no pasa por él
  (await cookies()).set(STAFF_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365 * 2, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  // /oauth/consent: autorizar a ChatGPT/Claude en el MCP después de entrar
  redirect(next.startsWith("/admin") || next.startsWith("/oauth/consent?") ? next : "/admin/upload");
}
