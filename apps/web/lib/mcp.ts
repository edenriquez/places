import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

/**
 * Servidor MCP para capturar eventos desde ChatGPT/Claude (solo admins).
 * Todo entra como pendiente a /admin/review: nada se publica desde aquí.
 * Cada llamada usa el token OAuth del usuario, así que RLS e is_admin() aplican igual que en el admin web.
 */

const CATEGORIES = [
  "feria", "fiesta_patronal", "concierto", "taller", "exposicion", "gastronomia",
  "deporte", "teatro", "danza", "cine", "mercado", "religioso", "infantil", "otro",
] as const;

const MAX_FLYER_BYTES = 15 * 1024 * 1024; // mismo límite que el bucket
const FLYER_TYPES: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

/** Cliente de Supabase que actúa como el usuario del token (RLS aplica). */
export function userClient(token: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://entrelugares-web-mauve.vercel.app").replace(/\/$/, "");
}

// ChatGPT (Apps SDK) entrega los archivos del chat como { download_url, file_id }; otros clientes mandan una URL o data: URL.
const flyerSchema = z.union([
  z.string().describe("URL https pública de la imagen del flyer, o data:image/...;base64,..."),
  z.object({ download_url: z.string(), file_id: z.string().optional() }).loose(),
]);
type FlyerInput = z.infer<typeof flyerSchema>;

function isPrivateHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "::1") return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return /^(fc|fd|fe80)/.test(h) && h.includes(":");
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

async function readFlyer(input: FlyerInput): Promise<{ bytes: Uint8Array; type: string }> {
  const src = typeof input === "string" ? input.trim() : input.download_url;
  if (src.startsWith("data:")) {
    const m = src.match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!m) throw new Error("data: URL inválida; se espera data:image/jpeg|png|webp;base64,...");
    return { bytes: Uint8Array.from(Buffer.from(m[2], "base64")), type: m[1] };
  }
  const url = new URL(src);
  if (url.protocol !== "https:" || isPrivateHost(url.hostname)) throw new Error("El flyer debe ser una URL https pública.");
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (isPrivateHost(new URL(res.url).hostname)) throw new Error("El flyer debe ser una URL https pública.");
  if (!res.ok) throw new Error(`No se pudo descargar el flyer (${res.status}).`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_FLYER_BYTES) throw new Error("El flyer pesa más de 15 MB.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  return { bytes, type };
}

/** Sube el flyer al bucket con la misma ruta que el uploader del admin (uploads/<sha[0:2]>/<sha>.<ext>). */
async function storeFlyer(sb: SupabaseClient, input: FlyerInput) {
  const { bytes, type } = await readFlyer(input);
  const ext = FLYER_TYPES[type];
  if (!ext) throw new Error(`Tipo de imagen no soportado (${type || "desconocido"}); usa JPG, PNG o WebP.`);
  if (bytes.byteLength > MAX_FLYER_BYTES) throw new Error("El flyer pesa más de 15 MB.");
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const sha = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const path = `uploads/${sha.slice(0, 2)}/${sha}${ext}`;
  const { error } = await sb.storage.from("flyers").upload(path, bytes, { upsert: true, contentType: type });
  if (error) throw new Error(`No se pudo guardar el flyer: ${error.message}`);
  const { data: dup } = await sb.from("raw_ingestions").select("id, status, event_id").eq("media_sha256", sha).maybeSingle();
  return { path, sha, dup };
}

async function sourceId(sb: SupabaseClient) {
  const { data } = await sb.from("sources").select("id").eq("kind", "manual").eq("name", "mcp").maybeSingle();
  if (data) return data.id as string;
  const { data: created, error } = await sb.from("sources").insert({ name: "mcp", kind: "manual", trust_score: 0.8 }).select("id").single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

function toIso(date: string, time?: string | null) {
  // hora local de México (UTC-6 sin horario de verano desde 2022), igual que el admin
  return new Date(`${date}T${(time || "00:00").slice(0, 5)}:00-06:00`).toISOString();
}

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function tokenOf(ctx: { http?: { authInfo?: { token: string } } }) {
  const token = ctx.http?.authInfo?.token;
  if (!token) throw new Error("Sin sesión");
  return token;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:MM");

export function registerTools(server: McpServer) {
  server.registerTool(
    "buscar_municipio",
    {
      title: "Buscar municipio",
      description: "Busca municipios de entrelugares por nombre y devuelve su clave (cvegeo). Úsalo antes de crear un evento: crear_evento necesita el cvegeo.",
      inputSchema: z.object({ nombre: z.string().min(2) }),
      annotations: { readOnlyHint: true },
    },
    async ({ nombre }, ctx) => {
      const { data, error } = await userClient(tokenOf(ctx)).rpc("mcp_search_municipalities", { q: nombre, max_results: 5 });
      return error ? fail(error.message) : text(data);
    },
  );

  server.registerTool(
    "buscar_lugar",
    {
      title: "Buscar lugar",
      description: "Busca lugares registrados (plazas, casas de cultura, templos...) dentro de un municipio. Si alguno coincide con el del flyer (similarity alta), pasa su id como lugar_id en crear_evento.",
      inputSchema: z.object({ municipio: z.string().regex(/^\d{5}$/).describe("cvegeo del municipio"), nombre: z.string().min(2) }),
      annotations: { readOnlyHint: true },
    },
    async ({ municipio, nombre }, ctx) => {
      const { data, error } = await userClient(tokenOf(ctx)).rpc("mcp_search_places", { municipality: municipio, q: nombre, max_results: 8 });
      return error ? fail(error.message) : text(data);
    },
  );

  server.registerTool(
    "buscar_duplicados",
    {
      title: "Buscar duplicados",
      description: "Revisa si ya existe un evento parecido en el mismo municipio alrededor de esa fecha (±1 día). Úsalo antes de crear_evento.",
      inputSchema: z.object({ titulo: z.string().min(3), municipio: z.string().regex(/^\d{5}$/), fecha: date }),
      annotations: { readOnlyHint: true },
    },
    async ({ titulo, municipio, fecha }, ctx) => {
      const { data, error } = await userClient(tokenOf(ctx)).rpc("mcp_find_duplicates", { title: titulo, municipality: municipio, first_date: fecha });
      if (error) return fail(error.message);
      return text(data?.length ? data.map((e: { slug: string }) => ({ ...e, url: `${siteUrl()}/evento/${e.slug}` })) : "Sin duplicados.");
    },
  );

  server.registerTool(
    "crear_evento",
    {
      title: "Crear evento (a revisión)",
      description:
        "Crea un evento con los datos que leíste del flyer o del post. Queda PENDIENTE en /admin/review hasta que el admin lo apruebe. " +
        "Antes: buscar_municipio (cvegeo), buscar_lugar (lugar_id si hay coincidencia) y buscar_duplicados. Fechas en hora de México.",
      inputSchema: z.object({
        titulo: z.string().min(3).max(160),
        categoria: z.enum(CATEGORIES),
        municipio: z.string().regex(/^\d{5}$/).describe("cvegeo de buscar_municipio"),
        fechas: z.array(z.object({ fecha: date, inicio: time.optional(), fin: time.optional(), nota: z.string().max(200).optional() })).min(1),
        descripcion: z.string().max(1200).optional().describe("1 a 3 frases con lo esencial"),
        lugar_id: z.string().uuid().optional().describe("id de buscar_lugar"),
        lugar_texto: z.string().max(200).optional().describe("nombre del lugar tal como aparece"),
        gratis: z.boolean().optional(),
        precio_min: z.number().nonnegative().optional(),
        precio_max: z.number().nonnegative().optional(),
        organizador: z.string().max(160).optional(),
        url_origen: z.string().url().optional().describe("post o página de donde salió"),
        flyer: flyerSchema.optional().describe("imagen del flyer para la tarjeta del evento"),
        confianza: z.number().min(0).max(1).optional().describe("qué tan seguro estás de los datos (0 a 1)"),
      }),
      _meta: { "openai/fileParams": ["flyer"] },
    },
    async (a, ctx) => {
      const sb = userClient(tokenOf(ctx));
      const userId = (ctx.http?.authInfo?.extra?.userId as string | undefined) ?? null;
      try {
        const flyer = a.flyer ? await storeFlyer(sb, a.flyer) : null;
        if (flyer?.dup) return fail(`Ese flyer ya estaba registrado (ingesta ${flyer.dup.id}, estado ${flyer.dup.status}).`);
        const src = await sourceId(sb);
        const isFree = a.gratis ?? false;
        const conf = Math.round((a.confianza ?? 0.8) * 100) / 100;
        // mismo formato que FlyerEvent del modelo local, así la vista de revisión lo precarga igual
        const extraction = {
          title: a.titulo,
          dates: a.fechas.map((d) => ({ date: d.fecha, start_time: d.inicio?.slice(0, 5) ?? null, end_time: d.fin?.slice(0, 5) ?? null, note: d.nota ?? null })),
          place_text: a.lugar_texto ?? null,
          municipality: null,
          price_min: isFree ? null : (a.precio_min ?? null),
          price_max: isFree ? null : (a.precio_max ?? a.precio_min ?? null),
          is_free: a.gratis ?? null,
          organizer: a.organizador ?? null,
          category: a.categoria,
          description: a.descripcion ?? null,
          confidence: conf,
        };
        const { data: ing, error: ingErr } = await sb.from("raw_ingestions").insert({
          source_id: src,
          status: "processing",
          media_path: flyer?.path ?? null,
          media_sha256: flyer?.sha ?? null,
          origin_url: a.url_origen ?? null,
          uploaded_by: userId,
          municipality_hint: a.municipio,
          organizer_hint: a.organizador ?? null,
          payload: { via: "mcp", client: ctx.http?.authInfo?.clientId ?? null },
          extraction,
          extraction_model: "mcp",
          confidence: conf,
          processed_at: new Date().toISOString(),
        }).select("id").single();
        if (ingErr) throw new Error(ingErr.message);

        const { data: ev, error: evErr } = await sb.from("events").insert({
          slug: `${slugify(a.titulo)}-${ing.id.slice(0, 8)}`,
          title: a.titulo,
          description: a.descripcion ?? null,
          category: a.categoria,
          place_id: a.lugar_id ?? null,
          place_text: a.lugar_texto ?? null,
          municipality_cvegeo: a.municipio,
          price_min: extraction.price_min,
          price_max: extraction.price_max,
          is_free: isFree,
          image_path: flyer?.path ?? null,
          status: "pending",
          confidence: conf,
          source_id: src,
          raw_ingestion_id: ing.id,
        }).select("id, slug").single();
        if (evErr) {
          await sb.from("raw_ingestions").update({ status: "failed", error: evErr.message }).eq("id", ing.id);
          throw new Error(evErr.message);
        }
        const { error: occErr } = await sb.from("event_occurrences").insert(a.fechas.map((d) => ({
          event_id: ev.id,
          starts_at: toIso(d.fecha, d.inicio),
          ends_at: d.fin ? toIso(d.fecha, d.fin) : null,
          is_all_day: !d.inicio,
          note: d.nota ?? null,
        })));
        await sb.from("raw_ingestions").update({ status: "needs_review", event_id: ev.id, error: occErr?.message ?? null }).eq("id", ing.id);
        return text({ ok: true, estado: "pendiente de revisión", revisar: `${siteUrl()}/admin/review/${ing.id}`, flyer: flyer ? "guardado" : "sin flyer" });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "subir_flyer",
    {
      title: "Subir flyer a la cola",
      description: "Solo sube la imagen del flyer a la cola; el OCR y el modelo local de la Mac extraen los datos después. Si tú ya leíste el flyer, mejor usa crear_evento con flyer.",
      inputSchema: z.object({
        flyer: flyerSchema,
        municipio: z.string().regex(/^\d{5}$/).optional().describe("cvegeo si lo sabes"),
        organizador: z.string().max(160).optional(),
        url_origen: z.string().url().optional(),
      }),
      _meta: { "openai/fileParams": ["flyer"] },
    },
    async (a, ctx) => {
      const sb = userClient(tokenOf(ctx));
      try {
        const flyer = await storeFlyer(sb, a.flyer);
        if (flyer.dup) return fail(`Ese flyer ya estaba en la cola (ingesta ${flyer.dup.id}, estado ${flyer.dup.status}).`);
        const { error } = await sb.from("raw_ingestions").insert({
          source_id: await sourceId(sb),
          status: "queued",
          media_path: flyer.path,
          media_sha256: flyer.sha,
          origin_url: a.url_origen ?? null,
          uploaded_by: (ctx.http?.authInfo?.extra?.userId as string | undefined) ?? null,
          municipality_hint: a.municipio ?? null,
          organizer_hint: a.organizador ?? null,
          payload: { via: "mcp", client: ctx.http?.authInfo?.clientId ?? null },
        });
        if (error) throw new Error(error.message);
        return text({ ok: true, estado: "en cola; la Mac lo procesa cuando esté en línea", cola: `${siteUrl()}/admin/upload` });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    },
  );
}
