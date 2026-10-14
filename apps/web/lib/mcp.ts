import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { McpServer } from "@modelcontextprotocol/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { EVENTS_TAG } from "@/lib/queries";
import { EXPERIENCE_KINDS, type ExperienceKind } from "@/lib/experiences";

/**
 * Servidor MCP para capturar eventos y experiencias desde ChatGPT/Claude (solo admins).
 * Nada se publica desde aquí: los eventos entran pendientes a /admin/review y las experiencias como borrador a /admin/experiencias.
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

/** Descarga/decodifica la imagen, la valida y la sube al bucket "flyers" en la ruta que arme `pathFor`. */
async function uploadImage(sb: SupabaseClient, input: FlyerInput, pathFor: (sha: string, ext: string) => string) {
  const { bytes, type } = await readFlyer(input);
  const ext = FLYER_TYPES[type];
  if (!ext) throw new Error(`Tipo de imagen no soportado (${type || "desconocido"}); usa JPG, PNG o WebP.`);
  if (bytes.byteLength > MAX_FLYER_BYTES) throw new Error("La imagen pesa más de 15 MB.");
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const sha = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const path = pathFor(sha, ext);
  const { error } = await sb.storage.from("flyers").upload(path, bytes, { upsert: true, contentType: type });
  if (error) throw new Error(`No se pudo guardar la imagen: ${error.message}`);
  return { path, sha };
}

/** Flyer de una ingesta: misma ruta que el uploader del admin (uploads/<sha[0:2]>/<sha>.<ext>) y aviso si ya existía. */
async function storeFlyer(sb: SupabaseClient, input: FlyerInput) {
  const { path, sha } = await uploadImage(sb, input, (sha, ext) => `uploads/${sha.slice(0, 2)}/${sha}${ext}`);
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
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Mismas reglas que saveExperience del admin: dominio sin https, o @usuario para redes. */
function normUrl(v: string | undefined, base?: string) {
  const s = v?.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return `https://${s}`;
  return base ? `${base}${s.replace(/^@/, "")}` : `https://${s}`;
}

/** Organización por slug (la crea si no existe), igual que el formulario de experiencias. */
async function orgId(sb: SupabaseClient, name: string, municipality: string) {
  const slug = slugify(name);
  const { data } = await sb.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (data) return data.id as string;
  const { data: created, error } = await sb.from("organizations").insert({ name: name.trim(), slug, kind: "otro", municipality_cvegeo: municipality }).select("id").single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

const MAX_EXPERIENCE_PHOTOS = 10; // portada + 9 en galería (check de gallery_paths)
const experiencePhotoPath = (id: string) => (sha: string, ext: string) => `experiences/${id}/${sha.slice(0, 16)}${ext}`;

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
      description: "Busca municipios de entrelugares por nombre y devuelve su clave (cvegeo). Úsalo antes de crear un evento o una experiencia: crear_evento y crear_experiencia necesitan el cvegeo.",
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
      description: "Busca lugares registrados (plazas, casas de cultura, templos, parques, cascadas...) dentro de un municipio. Si alguno coincide (similarity alta), pasa su id como lugar_id en crear_evento o crear_experiencia.",
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
          slug: `${slugify(a.titulo).slice(0, 70)}-${ing.id.slice(0, 8)}`,
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
        return text({
          ok: true,
          estado: "pendiente de revisión",
          evento_id: ev.id,
          slug: ev.slug,
          revisar: `${siteUrl()}/admin/review/${ing.id}`,
          imagen: flyer ? "guardada" : "sin imagen; súbela con agregar_imagen y este evento_id",
        });
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

  server.registerTool(
    "buscar_eventos_sin_imagen",
    {
      title: "Buscar eventos sin imagen",
      description:
        "Lista eventos pendientes o publicados que no tienen imagen, con su evento_id, fechas, municipio y la URL de origen (el post de donde salió, útil para encontrar el flyer). " +
        "Después usa agregar_imagen con cada evento_id.",
      inputSchema: z.object({
        estado: z.enum(["pendiente", "publicado", "todos"]).optional().describe("por defecto: todos (pendientes y publicados)"),
        municipio: z.string().regex(/^\d{5}$/).optional().describe("cvegeo para limitar a un municipio"),
        limite: z.number().int().min(1).max(50).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ estado = "todos", municipio, limite = 20 }, ctx) => {
      const sb = userClient(tokenOf(ctx));
      let q = sb.from("events")
        .select("id, slug, title, status, raw_ingestion_id, municipalities:municipality_cvegeo(name), event_occurrences(starts_at)", { count: "exact" })
        .is("image_path", null)
        .in("status", estado === "pendiente" ? ["pending"] : estado === "publicado" ? ["published"] : ["pending", "published"])
        .order("created_at", { ascending: false })
        .limit(limite);
      if (municipio) q = q.eq("municipality_cvegeo", municipio);
      const { data, count, error } = await q;
      if (error) return fail(error.message);
      const rows = (data ?? []) as unknown as { id: string; slug: string; title: string; status: string; raw_ingestion_id: string | null; municipalities: { name: string } | null; event_occurrences: { starts_at: string }[] }[];
      if (!rows.length) return text("No hay eventos sin imagen con ese filtro.");
      const ingIds = rows.map((r) => r.raw_ingestion_id).filter(Boolean) as string[];
      const { data: ings } = ingIds.length ? await sb.from("raw_ingestions").select("id, origin_url").in("id", ingIds) : { data: [] };
      const origin = new Map((ings ?? []).map((i) => [i.id as string, i.origin_url as string | null]));
      return text({
        total: count ?? rows.length,
        eventos: rows.map((r) => ({
          evento_id: r.id,
          titulo: r.title,
          estado: r.status === "published" ? "publicado" : "pendiente",
          municipio: r.municipalities?.name ?? null,
          fechas: r.event_occurrences.map((o) => o.starts_at).sort().slice(0, 3),
          url_origen: r.raw_ingestion_id ? origin.get(r.raw_ingestion_id) ?? null : null,
          url: `${siteUrl()}/evento/${r.slug}`,
        })),
      });
    },
  );

  server.registerTool(
    "agregar_imagen",
    {
      title: "Agregar imagen a un evento",
      description:
        "Sube la imagen (flyer o foto) de un evento que ya existe, usando el evento_id de crear_evento o buscar_eventos_sin_imagen. " +
        "Si el evento ya tiene imagen no la cambia salvo que pases reemplazar=true. Si el evento es de una fiesta anual, la imagen también queda para los próximos años.",
      inputSchema: z.object({
        evento_id: z.string().uuid(),
        imagen: flyerSchema,
        reemplazar: z.boolean().optional(),
      }),
      _meta: { "openai/fileParams": ["imagen"] },
    },
    async ({ evento_id, imagen, reemplazar = false }, ctx) => {
      const sb = userClient(tokenOf(ctx));
      try {
        const { data: ev, error } = await sb.from("events").select("id, slug, title, image_path, festivity_id, raw_ingestion_id").eq("id", evento_id).maybeSingle();
        if (error) throw new Error(error.message);
        if (!ev) return fail("No existe un evento con ese evento_id.");
        if (ev.image_path && !reemplazar) return fail(`“${ev.title}” ya tiene imagen. Pasa reemplazar=true para cambiarla.`);
        // misma ruta que el botón de imagen del admin (events/<id>/<sha16>.<ext>)
        const { path } = await uploadImage(sb, imagen, (sha, ext) => `events/${ev.id}/${sha.slice(0, 16)}${ext}`);
        const { error: upErr } = await sb.from("events").update({ image_path: path }).eq("id", ev.id);
        if (upErr) throw new Error(upErr.message);
        if (ev.festivity_id) await sb.from("festivities").update({ image_path: path }).eq("id", ev.festivity_id);
        // /admin/review muestra la imagen de la ingesta; si llegó sin flyer, esta pasa a ser la suya
        if (ev.raw_ingestion_id) await sb.from("raw_ingestions").update({ media_path: path }).eq("id", ev.raw_ingestion_id).is("media_path", null);
        revalidatePath("/admin/events");
        revalidatePath("/admin/review");
        revalidatePath(`/evento/${ev.slug}`);
        revalidateTag(EVENTS_TAG, "max");
        return text({ ok: true, evento: ev.title, imagen: ev.image_path ? "reemplazada" : "agregada", url: `${siteUrl()}/evento/${ev.slug}` });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "buscar_experiencias",
    {
      title: "Buscar experiencias",
      description:
        "Lista las experiencias ya registradas en un municipio (borradores, publicadas y archivadas). Úsalo antes de crear_experiencia para no duplicar: " +
        "compara por nombre, tipo y lugar.",
      inputSchema: z.object({ municipio: z.string().regex(/^\d{5}$/).describe("cvegeo de buscar_municipio") }),
      annotations: { readOnlyHint: true },
    },
    async ({ municipio }, ctx) => {
      const { data, error } = await userClient(tokenOf(ctx)).from("experiences")
        .select("id, slug, title, kind, status, place_text, places:place_id(name), gallery_paths, image_path")
        .eq("municipality_cvegeo", municipio)
        .order("title")
        .limit(100);
      if (error) return fail(error.message);
      const rows = (data ?? []) as unknown as { id: string; slug: string; title: string; kind: string; status: string; place_text: string | null; places: { name: string } | null; gallery_paths: string[]; image_path: string | null }[];
      if (!rows.length) return text("No hay experiencias en ese municipio.");
      const estado = { draft: "borrador", published: "publicada", archived: "archivada" } as Record<string, string>;
      return text(rows.map((x) => ({
        experiencia_id: x.id,
        titulo: x.title,
        tipo: x.kind,
        estado: estado[x.status] ?? x.status,
        lugar: x.places?.name ?? x.place_text,
        fotos: (x.image_path ? 1 : 0) + x.gallery_paths.length,
        url: x.status === "published" ? `${siteUrl()}/experiencia/${x.slug}` : `${siteUrl()}/admin/experiencias/${x.id}`,
      })));
    },
  );

  const kinds = Object.keys(EXPERIENCE_KINDS) as [ExperienceKind, ...ExperienceKind[]];
  server.registerTool(
    "crear_experiencia",
    {
      title: "Crear experiencia (borrador)",
      description:
        "Crea una experiencia: algo que se puede hacer en un lugar sin depender de una fecha (sendero, cascada, taller artesanal, recorrido, tour de productores, clase...). " +
        "Si tiene fecha concreta es un evento: usa crear_evento. Queda como BORRADOR en /admin/experiencias hasta que el admin la publique. " +
        "Antes: buscar_municipio (cvegeo), buscar_lugar (lugar_id si hay coincidencia) y buscar_experiencias (para no duplicar). " +
        "Tipos: " + kinds.map((k) => `${k} (${EXPERIENCE_KINDS[k].label})`).join(", ") + ". " +
        "Sube la portada en foto; para más fotos usa agregar_foto_experiencia con el experiencia_id. No inventes datos que no estén en la fuente.",
      inputSchema: z.object({
        titulo: z.string().min(3).max(160),
        tipo: z.enum(kinds),
        municipio: z.string().regex(/^\d{5}$/).describe("cvegeo de buscar_municipio"),
        descripcion: z.string().max(2000).optional().describe("qué se hace y qué la hace especial, en 2 a 5 frases"),
        lugar_id: z.string().uuid().optional().describe("id de buscar_lugar"),
        lugar_texto: z.string().max(200).optional().describe("nombre del lugar si no está en el catálogo"),
        ubicacion: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional()
          .describe("punto de inicio (p. ej. la entrada del sendero); si falta se usa el del lugar o el municipio"),
        organizador: z.string().max(160).optional().describe("prestador de servicios u organizador"),
        duracion: z.string().max(60).optional().describe("ej. \"3–4 h\""),
        distancia_km: z.number().nonnegative().max(9999).optional(),
        dificultad: z.enum(["facil", "moderada", "dificil"]).optional(),
        gratis: z.boolean().optional(),
        precio_min: z.number().nonnegative().optional(),
        precio_max: z.number().nonnegative().optional(),
        nota_precio: z.string().max(80).optional().describe("ej. \"acceso\", \"con guía\", \"por persona\""),
        disponibilidad: z.string().max(80).optional().describe("resumen para la tarjeta, ej. \"Todos los días\" o \"Sáb y dom · 6:30\""),
        horarios: z.array(z.object({ dias: z.string().max(60), horario: z.string().max(60) })).max(10).optional()
          .describe("ej. [{ dias: \"Lun – Vie\", horario: \"8:00 – 17:00\" }]"),
        temporada: z.string().max(160).optional().describe("ej. \"Mejor temporada: junio a noviembre\""),
        que_llevar: z.array(z.string().max(80)).max(12).optional(),
        telefono: z.string().max(30).optional(),
        whatsapp: z.boolean().optional().describe("si el teléfono recibe WhatsApp (por defecto sí)"),
        reservacion: z.string().max(200).optional().describe("ej. \"Reserva con 1 día de anticipación\""),
        sitio_web: z.string().max(300).optional(),
        instagram: z.string().max(300).optional().describe("URL o @usuario"),
        facebook: z.string().max(300).optional().describe("URL o usuario"),
        vigencia: date.optional().describe("después de esta fecha deja de listarse (YYYY-MM-DD)"),
        foto: flyerSchema.optional().describe("foto de portada"),
      }),
      _meta: { "openai/fileParams": ["foto"] },
    },
    async (a, ctx) => {
      const sb = userClient(tokenOf(ctx));
      try {
        // id propio para que las fotos queden en experiences/<id>/, la misma carpeta que usa el formulario del admin
        const id = crypto.randomUUID();
        const photo = a.foto ? await uploadImage(sb, a.foto, experiencePhotoPath(id)) : null;
        const isFree = a.gratis ?? false;
        const digits = a.telefono?.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "") || null;
        const base = slugify(a.titulo).slice(0, 70);
        const { data: taken } = await sb.from("experiences").select("id").eq("slug", base).maybeSingle();
        const slug = taken ? `${base}-${id.slice(0, 6)}` : base;
        const { error } = await sb.from("experiences").insert({
          id,
          slug,
          title: a.titulo.trim(),
          kind: a.tipo,
          description: a.descripcion?.trim() || null,
          municipality_cvegeo: a.municipio,
          place_id: a.lugar_id ?? null,
          place_text: a.lugar_id ? null : a.lugar_texto?.trim() || null,
          ...(a.ubicacion && { geom: `SRID=4326;POINT(${a.ubicacion.lng} ${a.ubicacion.lat})` }),
          org_id: a.organizador?.trim() ? await orgId(sb, a.organizador, a.municipio) : null,
          duration_text: a.duracion?.trim() || null,
          distance_km: a.distancia_km ?? null,
          difficulty: a.dificultad ?? null,
          is_free: isFree,
          price_min: isFree ? null : (a.precio_min ?? null),
          price_max: isFree ? null : (a.precio_max ?? a.precio_min ?? null),
          price_note: isFree ? null : a.nota_precio?.trim() || null,
          availability_text: a.disponibilidad?.trim() || null,
          hours: (a.horarios ?? []).map((h) => ({ days: h.dias.trim(), time: h.horario.trim() })).filter((h) => h.days || h.time),
          season_text: a.temporada?.trim() || null,
          bring: (a.que_llevar ?? []).map((b) => b.trim()).filter(Boolean),
          contact_phone: digits,
          contact_whatsapp: a.whatsapp ?? true,
          booking_note: a.reservacion?.trim() || null,
          website_url: normUrl(a.sitio_web),
          instagram_url: normUrl(a.instagram, "https://instagram.com/"),
          facebook_url: normUrl(a.facebook, "https://facebook.com/"),
          image_path: photo?.path ?? null,
          valid_until: a.vigencia ?? null,
          status: "draft",
        });
        if (error) throw new Error(error.message);
        revalidatePath("/admin/experiencias");
        return text({
          ok: true,
          estado: "borrador; el admin la revisa y la publica",
          experiencia_id: id,
          slug,
          editar: `${siteUrl()}/admin/experiencias/${id}`,
          fotos: photo ? "portada guardada; agrega más con agregar_foto_experiencia" : "sin fotos; para publicarla hace falta al menos una (agregar_foto_experiencia)",
        });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "agregar_foto_experiencia",
    {
      title: "Agregar foto a una experiencia",
      description:
        `Sube una foto a una experiencia existente (experiencia_id de crear_experiencia o buscar_experiencias). Máximo ${MAX_EXPERIENCE_PHOTOS} fotos. ` +
        "Si no tiene portada, esta lo será; con portada=true reemplaza la portada actual y la anterior pasa a la galería. Llámala una vez por foto.",
      inputSchema: z.object({
        experiencia_id: z.string().uuid(),
        imagen: flyerSchema,
        portada: z.boolean().optional(),
      }),
      _meta: { "openai/fileParams": ["imagen"] },
    },
    async ({ experiencia_id, imagen, portada = false }, ctx) => {
      const sb = userClient(tokenOf(ctx));
      try {
        const { data: x, error } = await sb.from("experiences").select("id, slug, title, status, image_path, gallery_paths").eq("id", experiencia_id).maybeSingle();
        if (error) throw new Error(error.message);
        if (!x) return fail("No existe una experiencia con ese experiencia_id.");
        const current = [x.image_path, ...(x.gallery_paths as string[])].filter(Boolean) as string[];
        if (current.length >= MAX_EXPERIENCE_PHOTOS) return fail(`“${x.title}” ya tiene ${MAX_EXPERIENCE_PHOTOS} fotos, el máximo.`);
        const { path } = await uploadImage(sb, imagen, experiencePhotoPath(x.id));
        if (current.includes(path)) return fail(`Esa foto ya estaba en “${x.title}”.`);
        const photos = portada ? [path, ...current] : [...current, path];
        const { error: upErr } = await sb.from("experiences").update({ image_path: photos[0], gallery_paths: photos.slice(1) }).eq("id", x.id);
        if (upErr) throw new Error(upErr.message);
        revalidatePath("/admin/experiencias");
        if (x.status === "published") {
          revalidatePath(`/experiencia/${x.slug}`);
          revalidateTag(EVENTS_TAG, "max");
        }
        return text({
          ok: true,
          experiencia: x.title,
          foto: photos[0] === path ? "es la portada" : "agregada a la galería",
          total: photos.length,
          url: x.status === "published" ? `${siteUrl()}/experiencia/${x.slug}` : `${siteUrl()}/admin/experiencias/${x.id}`,
        });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    },
  );
}
