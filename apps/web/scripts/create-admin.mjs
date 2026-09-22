#!/usr/bin/env node
/**
 * Crea (o promueve) un usuario administrador.
 * Uso: node scripts/create-admin.mjs correo@dominio.mx 'contraseña'
 * Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del entorno o de packages/ingest/.env (local).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8").split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
}
const ingestEnv = loadEnv(resolve(process.cwd(), "../../packages/ingest/.env"));
const url = process.env.SUPABASE_URL ?? ingestEnv.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ingestEnv.SUPABASE_SERVICE_KEY;
const [email, password] = process.argv.slice(2);
if (!url || !key || !email || !password) {
  console.error("uso: node scripts/create-admin.mjs <email> <password>  (necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
let userId;
const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  if (!/already/i.test(error.message)) { console.error(error.message); process.exit(1); }
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 200 });
  userId = list.users.find((u) => u.email === email)?.id;
} else {
  userId = data.user.id;
}
const { error: e2 } = await sb.from("admin_users").upsert({ user_id: userId, note: "creado por scripts/create-admin.mjs" });
if (e2) { console.error(e2.message); process.exit(1); }
console.log(`admin listo: ${email} (${userId})`);
