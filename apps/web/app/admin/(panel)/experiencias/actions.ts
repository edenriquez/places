"use server";

import { revalidatePath, updateTag } from "next/cache";
import { EVENTS_TAG } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { EXPERIENCE_KINDS } from "@/lib/experiences";
import { PLACE_KIND_LABEL } from "@/lib/types";

async function admin() {
  const sb = await createClient();
  const { data: ok } = await sb.rpc("is_admin");
  if (!ok) throw new Error("No autorizado");
  return sb;
}

export type ExperienceInput = {
  id: string | null;
  title: string;
  kind: string;
  description: string;
  municipality: string;
  placeId: string | null;
  placeText: string;
  /** lugar nuevo para el catálogo (si no estaba) */
  newPlaceKind: string | null;
  /** "19.2275, -98.8021" como lo copia Google Maps; vacío = el punto del lugar o del municipio */
  point: string;
  organizer: string;
  durationText: string;
  distanceKm: number | null;
  difficulty: string | null;
  isFree: boolean;
  priceMin: number | null;
  priceMax: number | null;
  priceNote: string;
  availabilityText: string;
  hours: { days: string; time: string }[];
  seasonText: string;
  bring: string[];
  contactPhone: string;
  contactWhatsapp: boolean;
  bookingNote: string;
  website: string;
  instagram: string;
  facebook: string;
  /** fotos ya subidas al bucket, en orden; la primera es la portada */
  photos: string[];
  imageFocusX: number;
  imageFocusY: number;
  verifiedAt: string;
  validUntil: string;
  status: "draft" | "published" | "archived";
};

const MAX_PHOTOS = 10;
const PHOTO_RE = /^(experiences|gallery)\/[\w-]+\/[\w.-]+$/;
const pct = (n: number) => Math.min(100, Math.max(0, Math.round(Number.isFinite(n) ? n : 50)));
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const text = (s: string) => s.trim() || null;
const num = (n: number | null) => (n != null && Number.isFinite(n) && n >= 0 ? n : null);

function url(v: string, base?: string) {
  const s = v.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return `https://${s}`;
  return base ? `${base}${s.replace(/^@/, "")}` : `https://${s}`;
}

function phoneDigits(v: string) {
  const d = v.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "");
  return d || null;
}

/** "19.2275, -98.8021" → EWKT para PostGIS; null si no se entiende. */
function parsePoint(v: string) {
  const m = v.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const [lat, lng] = [Number(m[1]), Number(m[2])];
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return `SRID=4326;POINT(${lng} ${lat})`;
}

export async function saveExperience(input: ExperienceInput): Promise<{ ok: true; id: string; slug: string } | { ok: false; error: string }> {
  const sb = await admin();
  const title = input.title.trim();
  if (title.length < 3) return { ok: false, error: "Falta el nombre." };
  if (!(input.kind in EXPERIENCE_KINDS)) return { ok: false, error: "Elige el tipo de experiencia." };
  if (!input.municipality) return { ok: false, error: "Elige el municipio." };
  const point = input.point.trim() ? parsePoint(input.point) : null;
  if (input.point.trim() && !point) return { ok: false, error: "La ubicación debe ser «latitud, longitud» (cópiala de Google Maps)." };
  const photos = [...new Set(input.photos.filter((p) => typeof p === "string" && PHOTO_RE.test(p)))].slice(0, MAX_PHOTOS);
  if (input.status === "published" && !photos.length) return { ok: false, error: "Para publicar, sube al menos una foto." };

  try {
    // lugar nuevo: se agrega al catálogo del municipio para que tenga su página
    let placeId = input.placeId;
    if (!placeId && input.newPlaceKind && input.placeText.trim()) {
      if (!(input.newPlaceKind in PLACE_KIND_LABEL)) return { ok: false, error: "Tipo de lugar desconocido." };
      const { data: place, error } = await sb.from("places").insert({
        name: input.placeText.trim(),
        slug: slugify(input.placeText),
        kind: input.newPlaceKind,
        municipality_cvegeo: input.municipality,
        source: "manual",
        ...(point && { geom: point }),
      }).select("id").single();
      if (error) throw error;
      placeId = place.id;
    }

    let orgId: string | null = null;
    if (input.organizer.trim()) {
      const orgSlug = slugify(input.organizer);
      const { data: org } = await sb.from("organizations").select("id").eq("slug", orgSlug).maybeSingle();
      orgId = org?.id ?? null;
      if (!orgId) {
        const { data: created, error } = await sb.from("organizations").insert({ name: input.organizer.trim(), slug: orgSlug, kind: "otro", municipality_cvegeo: input.municipality }).select("id").single();
        if (error) throw error;
        orgId = created.id;
      }
    }

    const row = {
      title,
      kind: input.kind,
      description: text(input.description),
      municipality_cvegeo: input.municipality,
      place_id: placeId,
      place_text: placeId ? null : text(input.placeText),
      ...(point && { geom: point }),
      org_id: orgId,
      duration_text: text(input.durationText),
      distance_km: num(input.distanceKm),
      difficulty: input.difficulty && ["facil", "moderada", "dificil"].includes(input.difficulty) ? input.difficulty : null,
      is_free: input.isFree,
      price_min: input.isFree ? null : num(input.priceMin),
      price_max: input.isFree ? null : num(input.priceMax),
      price_note: input.isFree ? null : text(input.priceNote),
      availability_text: text(input.availabilityText),
      hours: input.hours.map((h) => ({ days: h.days.trim(), time: h.time.trim() })).filter((h) => h.days || h.time),
      season_text: text(input.seasonText),
      bring: input.bring.map((b) => b.trim()).filter(Boolean).slice(0, 12),
      contact_phone: phoneDigits(input.contactPhone),
      contact_whatsapp: input.contactWhatsapp,
      booking_note: text(input.bookingNote),
      website_url: url(input.website),
      instagram_url: url(input.instagram, "https://instagram.com/"),
      facebook_url: url(input.facebook, "https://facebook.com/"),
      image_path: photos[0] ?? null,
      gallery_paths: photos.slice(1),
      image_focus_x: pct(input.imageFocusX),
      image_focus_y: pct(input.imageFocusY),
      verified_at: input.verifiedAt ? new Date(`${input.verifiedAt}T12:00:00-06:00`).toISOString() : null,
      valid_until: input.validUntil || null,
      status: input.status,
    };

    let id = input.id;
    let slug: string;
    if (id) {
      const { data: cur } = await sb.from("experiences").select("published_at").eq("id", id).single();
      const { data, error } = await sb.from("experiences")
        .update({ ...row, published_at: input.status === "published" ? (cur?.published_at ?? new Date().toISOString()) : cur?.published_at ?? null })
        .eq("id", id).select("slug").single();
      if (error) throw error;
      slug = data.slug;
    } else {
      // slug limpio si está libre; si no, con un sufijo corto
      const base = slugify(title).slice(0, 70);
      const { data: taken } = await sb.from("experiences").select("id").eq("slug", base).maybeSingle();
      slug = taken ? `${base}-${crypto.randomUUID().slice(0, 6)}` : base;
      const { data, error } = await sb.from("experiences")
        .insert({ ...row, slug, published_at: input.status === "published" ? new Date().toISOString() : null })
        .select("id").single();
      if (error) throw error;
      id = data.id as string;
    }

    revalidatePath("/admin/experiencias");
    updateTag(EVENTS_TAG);
    return { ok: true, id: id!, slug };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : (e as { message?: string })?.message ?? "No se pudo guardar." };
  }
}

export async function setExperienceStatus(id: string, status: "draft" | "published" | "archived") {
  const sb = await admin();
  const { data: cur } = await sb.from("experiences").select("published_at, image_path").eq("id", id).single();
  if (status === "published" && !cur?.image_path) return { ok: false as const, error: "Para publicar, sube al menos una foto." };
  await sb.from("experiences").update({ status, published_at: status === "published" ? (cur?.published_at ?? new Date().toISOString()) : cur?.published_at ?? null }).eq("id", id);
  revalidatePath("/admin/experiencias");
  updateTag(EVENTS_TAG);
  return { ok: true as const };
}
