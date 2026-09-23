"use server";

import { revalidatePath, updateTag } from "next/cache";
import { EVENTS_TAG } from "@/lib/queries";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function admin() {
  const sb = await createClient();
  const { data: ok } = await sb.rpc("is_admin");
  if (!ok) throw new Error("No autorizado");
  return sb;
}

/** Registra en raw_ingestions un archivo ya subido al bucket desde el cliente. */
export async function enqueueUpload(input: { mediaPath: string; sha256: string; originUrl?: string; municipality?: string; organizer?: string; filename: string }) {
  const sb = await admin();
  const { data: { user } } = await sb.auth.getUser();
  const { data: src } = await sb.from("sources").select("id").eq("kind", "manual").eq("name", "admin-web").maybeSingle();
  let sourceId = src?.id as string | undefined;
  if (!sourceId) {
    const { data: created } = await sb.from("sources").insert({ name: "admin-web", kind: "manual", trust_score: 0.8 }).select("id").single();
    sourceId = created?.id;
  }
  const { error } = await sb.from("raw_ingestions").insert({
    source_id: sourceId,
    status: "queued",
    media_path: input.mediaPath,
    media_sha256: input.sha256,
    origin_url: input.originUrl || null,
    municipality_hint: input.municipality || null,
    organizer_hint: input.organizer || null,
    uploaded_by: user?.id,
    payload: { filename: input.filename },
  });
  if (error) {
    if (error.code === "23505") return { ok: false as const, error: "Ese flyer ya estaba en la cola." };
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/admin/upload");
  return { ok: true as const };
}

type ReviewInput = {
  ingestionId: string;
  eventId: string | null;
  title: string;
  category: string;
  description: string;
  placeId: string | null;
  placeText: string;
  departureText: string;
  contactPhone: string;
  contactWhatsapp: boolean;
  instagram: string;
  facebook: string;
  tiktok: string;
  website: string;
  municipality: string;
  isFree: boolean;
  priceMin: number | null;
  priceMax: number | null;
  organizer: string;
  dates: { date: string; start: string; end: string }[];
};

/** Acepta "@usuario", "usuario" o la URL completa y devuelve la URL de la red. */
function socialUrl(v: string, base: string) {
  const s = v.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}\//i.test(s)) return `https://${s}`;
  return `${base}${s.replace(/^@/, "")}`;
}

function phoneDigits(v: string) {
  const d = v.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "");
  return d || null;
}

function toIso(date: string, time: string) {
  // hora local de México (UTC-6 sin horario de verano desde 2022)
  return new Date(`${date}T${time || "00:00"}:00-06:00`).toISOString();
}

async function upsertEvent(sb: Awaited<ReturnType<typeof admin>>, input: ReviewInput, status: "pending" | "published") {
  const slugBase = input.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  const base = {
    title: input.title,
    category: input.category,
    description: input.description || null,
    place_id: input.placeId,
    place_text: input.placeText || null,
    departure_text: input.departureText.trim() || null,
    contact_phone: phoneDigits(input.contactPhone),
    contact_whatsapp: input.contactWhatsapp,
    instagram_url: socialUrl(input.instagram, "https://instagram.com/"),
    facebook_url: socialUrl(input.facebook, "https://facebook.com/"),
    tiktok_url: socialUrl(input.tiktok, "https://tiktok.com/@"),
    website_url: input.website.trim() ? (/^https?:\/\//i.test(input.website.trim()) ? input.website.trim() : `https://${input.website.trim()}`) : null,
    municipality_cvegeo: input.municipality,
    is_free: input.isFree,
    price_min: input.isFree ? null : input.priceMin,
    price_max: input.isFree ? null : input.priceMax,
    status,
    verified_at: new Date().toISOString(),
  };
  let eventId = input.eventId;
  if (eventId) {
    // editar un evento ya publicado conserva su fecha de publicación original
    const { data: cur } = await sb.from("events").select("published_at").eq("id", eventId).single();
    const published_at = status === "published" ? (cur?.published_at ?? new Date().toISOString()) : null;
    const { error } = await sb.from("events").update({ ...base, published_at }).eq("id", eventId);
    if (error) throw error;
    await sb.from("event_occurrences").delete().eq("event_id", eventId);
  } else {
    const { data: ing } = await sb.from("raw_ingestions").select("media_path, source_id").eq("id", input.ingestionId).single();
    const { data, error } = await sb.from("events").insert({
      ...base,
      published_at: status === "published" ? new Date().toISOString() : null,
      slug: `${slugBase}-${input.ingestionId.slice(0, 8)}`,
      image_path: ing?.media_path,
      source_id: ing?.source_id,
      raw_ingestion_id: input.ingestionId,
      confidence: 1,
    }).select("id").single();
    if (error) throw error;
    eventId = data.id;
  }
  if (input.dates.length) {
    const rows = input.dates.filter((d) => d.date).map((d) => ({
      event_id: eventId,
      starts_at: toIso(d.date, d.start),
      ends_at: d.end ? toIso(d.date, d.end) : null,
      is_all_day: !d.start,
    }));
    const { error } = await sb.from("event_occurrences").insert(rows);
    if (error) throw error;
  }
  // organizador opcional: crear/reusar por nombre
  if (input.organizer) {
    const orgSlug = input.organizer.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { data: org } = await sb.from("organizations").select("id").eq("slug", orgSlug).maybeSingle();
    let orgId = org?.id;
    if (!orgId) {
      const { data: created } = await sb.from("organizations").insert({ name: input.organizer, slug: orgSlug, kind: "otro", municipality_cvegeo: input.municipality }).select("id").single();
      orgId = created?.id;
    }
    if (orgId) await sb.from("events").update({ org_id: orgId }).eq("id", eventId);
  }
  return eventId!;
}

export async function approveIngestion(input: ReviewInput) {
  const sb = await admin();
  const eventId = await upsertEvent(sb, input, "published");
  await sb.from("raw_ingestions").update({ status: "approved", event_id: eventId, reviewed_at: new Date().toISOString(), correction: input }).eq("id", input.ingestionId);
  revalidatePath("/admin/review");
  revalidatePath("/");
  updateTag(EVENTS_TAG);
  redirect("/admin/review");
}

/** Guarda sin cambiar el estado: un evento publicado sigue publicado, uno nuevo queda pending. */
export async function saveCorrection(input: ReviewInput) {
  const sb = await admin();
  const { data: cur } = input.eventId ? await sb.from("events").select("status").eq("id", input.eventId).single() : { data: null };
  const eventId = await upsertEvent(sb, input, cur?.status === "published" ? "published" : "pending");
  await sb.from("raw_ingestions").update({ event_id: eventId, correction: input }).eq("id", input.ingestionId);
  revalidatePath(`/admin/review/${input.ingestionId}`);
  revalidatePath("/admin/events");
  revalidatePath("/");
  updateTag(EVENTS_TAG);
  return { ok: true };
}

export async function rejectIngestion(ingestionId: string, eventId: string | null) {
  const sb = await admin();
  if (eventId) await sb.from("events").update({ status: "rejected" }).eq("id", eventId);
  await sb.from("raw_ingestions").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", ingestionId);
  updateTag(EVENTS_TAG);
  revalidatePath("/admin/review");
  redirect("/admin/review");
}

export async function markDuplicate(ingestionId: string, eventId: string | null, canonicalEventId: string) {
  const sb = await admin();
  if (eventId && eventId !== canonicalEventId) await sb.from("events").update({ status: "rejected", canonical_of: canonicalEventId }).eq("id", eventId);
  await sb.from("raw_ingestions").update({ status: "duplicate", event_id: canonicalEventId, reviewed_at: new Date().toISOString() }).eq("id", ingestionId);
  updateTag(EVENTS_TAG);
  revalidatePath("/admin/review");
  redirect("/admin/review");
}

export async function requeueIngestion(ingestionId: string) {
  const sb = await admin();
  await sb.from("raw_ingestions").update({ status: "queued", error: null, attempts: 0 }).eq("id", ingestionId);
  revalidatePath("/admin/upload");
  revalidatePath("/admin/review");
}

export async function addSource(formData: FormData) {
  const sb = await admin();
  const { error } = await sb.from("sources").insert({
    name: String(formData.get("name") ?? "").trim(),
    kind: String(formData.get("kind") ?? "facebook_page"),
    url: String(formData.get("url") ?? "").trim() || null,
    municipality_cvegeo: String(formData.get("municipality") ?? "") || null,
    interval_hours: Number(formData.get("interval_hours") ?? 24) || 24,
    trust_score: 0.7,
  });
  if (error) throw error;
  revalidatePath("/admin/sources");
}

/** "Correr ahora": encola una tarea de scrape para esa fuente; la Mac la toma en su siguiente vuelta. */
export async function runSourceNow(id: string) {
  const sb = await admin();
  const { data: { user } } = await sb.auth.getUser();
  await sb.from("sources").update({ run_requested_at: new Date().toISOString() }).eq("id", id);
  await sb.from("jobs").insert({ kind: "scrape", params: { source_id: id, force: true }, origin: "admin", requested_by: user?.id, priority: 1 });
  revalidatePath("/admin/sources");
  revalidatePath("/admin/jobs");
}

// ---------------------------------------------------------------------------
// Tareas para la Mac (tabla jobs). La web solo escribe filas; el worker las reclama y reporta.
// ---------------------------------------------------------------------------

const JOB_KINDS = ["process", "scrape", "festivities", "seed", "doctor"] as const;

export async function enqueueJob(input: { kind: string; params: Record<string, unknown>; priority?: number }) {
  const sb = await admin();
  if (!(JOB_KINDS as readonly string[]).includes(input.kind)) return { ok: false as const, error: "Tipo de tarea desconocido" };
  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb.from("jobs").insert({
    kind: input.kind,
    params: input.params ?? {},
    origin: "admin",
    requested_by: user?.id,
    priority: input.priority ?? 0,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/jobs");
  return { ok: true as const };
}

/** En cola: se cancela de inmediato. Corriendo: se le pide al worker parar tras el flyer/fuente en curso. */
export async function cancelJob(id: string) {
  const sb = await admin();
  const { data: job } = await sb.from("jobs").select("status").eq("id", id).single();
  if (job?.status === "queued") {
    await sb.from("jobs").update({ status: "cancelled", progress_message: "cancelada antes de empezar", finished_at: new Date().toISOString() }).eq("id", id);
  } else if (job?.status === "running") {
    await sb.from("jobs").update({ cancel_requested_at: new Date().toISOString(), progress_message: "cancelación solicitada…" }).eq("id", id);
  }
  revalidatePath("/admin/jobs");
}

/** Vuelve a encolar una tarea (misma clase y parámetros) como tarea nueva. */
export async function retryJob(id: string) {
  const sb = await admin();
  const { data: job } = await sb.from("jobs").select("kind, params, priority").eq("id", id).single();
  if (!job) return;
  await enqueueJob({ kind: job.kind, params: job.params, priority: job.priority });
}

export async function toggleSource(id: string, enabled: boolean) {
  const sb = await admin();
  await sb.from("sources").update({ enabled }).eq("id", id);
  revalidatePath("/admin/sources");
}

export async function setEventStatus(id: string, status: "published" | "pending" | "cancelled" | "rejected") {
  const sb = await admin();
  await sb.from("events").update({ status, published_at: status === "published" ? new Date().toISOString() : null }).eq("id", id);
  revalidatePath("/admin/events");
  revalidatePath("/");
  updateTag(EVENTS_TAG);
}

/** Asigna imagen a un evento; si viene de una fiesta recurrente, la guarda también ahí para años futuros. */
export async function setEventImage(eventId: string, path: string) {
  const sb = await admin();
  const { data: ev, error } = await sb.from("events").update({ image_path: path }).eq("id", eventId).select("festivity_id").single();
  if (error) return { ok: false as const, error: error.message };
  if (ev?.festivity_id) await sb.from("festivities").update({ image_path: path }).eq("id", ev.festivity_id);
  revalidatePath("/admin/events");
  revalidatePath("/");
  updateTag(EVENTS_TAG);
  return { ok: true as const };
}
