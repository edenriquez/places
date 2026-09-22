export type Category =
  | "feria" | "fiesta_patronal" | "concierto" | "taller" | "exposicion" | "gastronomia"
  | "deporte" | "teatro" | "danza" | "cine" | "mercado" | "religioso" | "infantil" | "otro";

export const CATEGORY_LABEL: Record<Category, string> = {
  feria: "Feria",
  fiesta_patronal: "Fiesta patronal",
  concierto: "Concierto",
  taller: "Taller",
  exposicion: "Exposición",
  gastronomia: "Gastronomía",
  deporte: "Deporte",
  teatro: "Teatro",
  danza: "Danza",
  cine: "Cine",
  mercado: "Mercado",
  religioso: "Religioso",
  infantil: "Familia",
  otro: "Otro",
};

/** Fila que devuelven events_near / events_live_near */
export type NearRow = {
  event_id: string;
  slug: string;
  title: string;
  category: Category;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  image_path: string | null;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  place_id: string | null;
  place_name: string | null;
  municipality_cvegeo: string;
  municipality_name: string;
  distance_m: number;
  lat?: number | null;
  lng?: number | null;
};

export type Municipality = {
  cvegeo: string;
  name: string;
  slug: string;
  state: string;
  is_pueblo_magico: boolean;
  drive_from_cdmx: string | null;
  cover_image_url: string | null;
  description: string | null;
  lat: number;
  lng: number;
};

export type Event = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: Category;
  org_id: string | null;
  place_id: string | null;
  place_text: string | null;
  municipality_cvegeo: string;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
  image_path: string | null;
  status: "pending" | "published" | "cancelled" | "rejected";
  confidence: number | null;
  raw_ingestion_id: string | null;
  created_at: string;
};

export type Occurrence = {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  note: string | null;
};

export type Place = {
  id: string;
  name: string;
  kind: string;
  address: string | null;
  municipality_cvegeo: string;
  lat: number | null;
  lng: number | null;
};

export type Festivity = {
  id: string;
  name: string;
  locality: string | null;
  month: number | null;
  day: number | null;
  movable_rule: string | null;
  duration_days: number;
  description: string | null;
};

export type RawIngestion = {
  id: string;
  source_id: string | null;
  status: "queued" | "processing" | "needs_review" | "approved" | "rejected" | "failed" | "duplicate";
  media_path: string | null;
  origin_url: string | null;
  municipality_hint: string | null;
  organizer_hint: string | null;
  payload: Record<string, unknown>;
  ocr_text: string | null;
  ocr_engine: string | null;
  extraction: Record<string, unknown> | null;
  extraction_model: string | null;
  confidence: number | null;
  error: string | null;
  event_id: string | null;
  received_at: string;
  processed_at: string | null;
};

export type Source = {
  id: string;
  name: string;
  kind: "facebook_page" | "instagram" | "website" | "manual" | "public_form" | "sic" | "denue" | "user_report" | "correspondent";
  url: string | null;
  municipality_cvegeo: string | null;
  interval_hours: number;
  enabled: boolean;
  run_requested_at: string | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  new_items_last_run: number;
};
