-- entrelugares.mx — esquema inicial (MVP)
-- Postgres + PostGIS en Supabase. Ver plan §5.2.

create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create or replace function public.slugify(txt text)
returns text language sql immutable strict as $$
  select trim(both '-' from regexp_replace(
           lower(public.unaccent(txt)), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Municipios (INEGI CVEGEO = cve_ent || cve_mun, 5 dígitos)
-- ---------------------------------------------------------------------------

create table public.municipalities (
  cvegeo            text primary key check (cvegeo ~ '^[0-9]{5}$'),
  cve_ent           text not null,
  cve_mun           text not null,
  state             text not null,
  name              text not null,
  slug              text not null unique,
  geom              geometry(MultiPolygon, 4326),
  centroid          geometry(Point, 4326),
  is_pueblo_magico  boolean not null default false,
  population        integer,
  cover_image_url   text,
  description       text,
  drive_from_cdmx   text,                -- "1 h 40"
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index municipalities_geom_gix on public.municipalities using gist (geom);

-- ---------------------------------------------------------------------------
-- Lugares (SIC, DENUE, OSM, manual)
-- ---------------------------------------------------------------------------

create table public.places (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null,
  kind                text not null check (kind in (
                        'museo','teatro','casa_cultura','centro_cultural','galeria','auditorio',
                        'zona_arqueologica','templo','plaza','explanada','mercado','ex_hacienda',
                        'parque','bar','restaurante','deportivo','escuela','otro')),
  geom                geometry(Point, 4326),
  address             text,
  locality            text,
  municipality_cvegeo text not null references public.municipalities (cvegeo),
  source              text not null check (source in ('sic','denue','osm','manual','extraction')),
  source_ref          text,
  phone               text,
  website             text,
  photos              text[] not null default '{}',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (source, source_ref)
);
create index places_geom_gix on public.places using gist (geom);
create index places_name_trgm on public.places using gin (name gin_trgm_ops);
create index places_muni_idx on public.places (municipality_cvegeo);
create index places_slug_muni_idx on public.places (municipality_cvegeo, slug);
create trigger places_updated_at before update on public.places
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Organizadores (ayuntamientos, casas de cultura, promotores)
-- ---------------------------------------------------------------------------

create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  kind                text not null check (kind in (
                        'ayuntamiento','casa_cultura','parroquia','promotor','colectivo','venue','gobierno_estatal','otro')),
  municipality_cvegeo text references public.municipalities (cvegeo),
  whatsapp            text,
  facebook_url        text,
  instagram_url       text,
  website             text,
  logo_url            text,
  trust_score         numeric(3,2) not null default 0.50 check (trust_score between 0 and 1),
  crm_external_id     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index organizations_name_trgm on public.organizations using gin (name gin_trgm_ops);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Fuentes que alimenta el job local (scrapers, carga manual, seeds)
-- ---------------------------------------------------------------------------

create table public.sources (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  kind                text not null check (kind in (
                        'facebook_page','instagram','website','manual','public_form',
                        'sic','denue','user_report','correspondent')),
  url                 text,
  org_id              uuid references public.organizations (id),
  municipality_cvegeo text references public.municipalities (cvegeo),
  interval_hours      integer not null default 24,
  enabled             boolean not null default true,
  trust_score         numeric(3,2) not null default 0.50 check (trust_score between 0 and 1),
  config              jsonb not null default '{}'::jsonb,   -- selectores, cuenta, límites
  run_requested_at    timestamptz,                          -- "correr ahora" desde admin
  last_run_at         timestamptz,
  last_success_at     timestamptz,
  last_error          text,
  new_items_last_run  integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger sources_updated_at before update on public.sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ingestas crudas: cada flyer/post que entra. La web encola, la Mac consume.
-- ---------------------------------------------------------------------------

create table public.raw_ingestions (
  id                  uuid primary key default gen_random_uuid(),
  source_id           uuid references public.sources (id),
  status              text not null default 'queued' check (status in (
                        'queued','processing','needs_review','approved','rejected','failed','duplicate')),
  media_path          text,                 -- ruta en el bucket "flyers"
  media_sha256        text,
  origin_url          text,                 -- post de Facebook, sitio, etc.
  uploaded_by         uuid,                 -- auth.users.id cuando viene de admin
  municipality_hint   text references public.municipalities (cvegeo),
  organizer_hint      text,
  payload             jsonb not null default '{}'::jsonb,   -- texto del post, metadatos del scraper
  ocr_text            text,
  ocr_engine          text,
  extraction          jsonb,                -- JSON del modelo local (FlyerEvent)
  extraction_model    text,
  confidence          numeric(3,2),
  correction          jsonb,                -- lo que corrigió el revisor (para afinar el prompt)
  error               text,
  attempts            integer not null default 0,
  event_id            uuid,
  received_at         timestamptz not null default now(),
  processed_at        timestamptz,
  reviewed_at         timestamptz,
  updated_at          timestamptz not null default now()
);
create unique index raw_ingestions_sha_uniq on public.raw_ingestions (media_sha256) where media_sha256 is not null;
create index raw_ingestions_status_idx on public.raw_ingestions (status, received_at);
create trigger raw_ingestions_updated_at before update on public.raw_ingestions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Eventos y ocurrencias
-- ---------------------------------------------------------------------------

create table public.events (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  title               text not null,
  description         text,
  category            text not null default 'otro' check (category in (
                        'feria','fiesta_patronal','concierto','taller','exposicion','gastronomia',
                        'deporte','teatro','danza','cine','mercado','religioso','infantil','otro')),
  org_id              uuid references public.organizations (id),
  place_id            uuid references public.places (id),
  place_text          text,                 -- como venía en el flyer
  municipality_cvegeo text not null references public.municipalities (cvegeo),
  price_min           numeric(10,2),
  price_max           numeric(10,2),
  is_free             boolean not null default false,
  image_path          text,                 -- flyer en el bucket
  status              text not null default 'pending' check (status in ('pending','published','cancelled','rejected')),
  confidence          numeric(3,2),
  source_id           uuid references public.sources (id),
  raw_ingestion_id    uuid references public.raw_ingestions (id),
  canonical_of        uuid references public.events (id),   -- si es duplicado de otro
  verified_at         timestamptz,
  published_at        timestamptz,
  search_tsv          tsvector generated always as (
                        to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(place_text,''))
                      ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index events_status_idx on public.events (status);
create index events_muni_idx on public.events (municipality_cvegeo);
create index events_title_trgm on public.events using gin (title gin_trgm_ops);
create index events_search_idx on public.events using gin (search_tsv);
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

alter table public.raw_ingestions
  add constraint raw_ingestions_event_fk foreign key (event_id) references public.events (id) on delete set null;

create table public.event_occurrences (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  is_all_day    boolean not null default false,
  is_confirmed  boolean not null default true,
  note          text
);
create index event_occurrences_starts_idx on public.event_occurrences (starts_at);
create index event_occurrences_event_idx on public.event_occurrences (event_id);

-- ---------------------------------------------------------------------------
-- Capa 1: fiestas y ferias recurrentes por municipio ("Fiestas del año")
-- ---------------------------------------------------------------------------

create table public.festivities (
  id                  uuid primary key default gen_random_uuid(),
  municipality_cvegeo text not null references public.municipalities (cvegeo),
  name                text not null,
  locality            text,
  month               integer check (month between 1 and 12),
  day                 integer check (day between 1 and 31),
  movable_rule        text,   -- 'carnaval' | 'semana_santa' | 'pentecostes' | 'corpus' | null
  duration_days       integer not null default 1,
  description         text,
  place_id            uuid references public.places (id),
  source              text not null default 'manual',
  created_at          timestamptz not null default now()
);
create index festivities_muni_idx on public.festivities (municipality_cvegeo);

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

create table public.admin_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Consulta núcleo: eventos cerca de un punto en un rango de fechas
-- ---------------------------------------------------------------------------

create or replace function public.events_near(
  lat double precision,
  lng double precision,
  radius_m integer default 30000,
  from_ts timestamptz default now(),
  to_ts timestamptz default now() + interval '14 days'
)
returns table (
  event_id uuid, slug text, title text, category text, is_free boolean,
  price_min numeric, price_max numeric, image_path text,
  starts_at timestamptz, ends_at timestamptz, is_all_day boolean,
  place_id uuid, place_name text, municipality_cvegeo text, municipality_name text,
  distance_m double precision
)
language sql stable as $$
  with pt as (select ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography g)
  select e.id, e.slug, e.title, e.category, e.is_free, e.price_min, e.price_max, e.image_path,
         o.starts_at, o.ends_at, o.is_all_day,
         p.id, coalesce(p.name, e.place_text), e.municipality_cvegeo, m.name,
         ST_Distance(coalesce(p.geom, m.centroid)::geography, pt.g)
  from public.event_occurrences o
  join public.events e on e.id = o.event_id and e.status = 'published'
  join public.municipalities m on m.cvegeo = e.municipality_cvegeo
  left join public.places p on p.id = e.place_id
  cross join pt
  where o.starts_at between from_ts and to_ts
    and ST_DWithin(coalesce(p.geom, m.centroid)::geography, pt.g, radius_m)
  order by o.starts_at, 16
$$;

-- "Sucediendo ahora": ocurrencias en curso cerca de un punto. En curso = ya empezó y
-- (no ha terminado, o empezó hace menos de 4 h si no tiene hora de fin).
create or replace function public.events_live_near(
  lat double precision,
  lng double precision,
  radius_m integer default 30000,
  at_ts timestamptz default now()
)
returns table (
  event_id uuid, slug text, title text, category text, is_free boolean,
  price_min numeric, price_max numeric, image_path text,
  starts_at timestamptz, ends_at timestamptz, is_all_day boolean,
  place_id uuid, place_name text, municipality_cvegeo text, municipality_name text,
  distance_m double precision
)
language sql stable as $$
  with pt as (select ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography g)
  select e.id, e.slug, e.title, e.category, e.is_free, e.price_min, e.price_max, e.image_path,
         o.starts_at, o.ends_at, o.is_all_day,
         p.id, coalesce(p.name, e.place_text), e.municipality_cvegeo, m.name,
         ST_Distance(coalesce(p.geom, m.centroid)::geography, pt.g)
  from public.event_occurrences o
  join public.events e on e.id = o.event_id and e.status = 'published'
  join public.municipalities m on m.cvegeo = e.municipality_cvegeo
  left join public.places p on p.id = e.place_id
  cross join pt
  where o.starts_at <= at_ts
    and (
      (o.ends_at is not null and o.ends_at >= at_ts)
      or (o.ends_at is null and o.is_all_day and o.starts_at::date = at_ts::date)
      or (o.ends_at is null and not o.is_all_day and o.starts_at >= at_ts - interval '4 hours')
    )
    and ST_DWithin(coalesce(p.geom, m.centroid)::geography, pt.g, radius_m)
  order by 16, o.starts_at
$$;

-- ---------------------------------------------------------------------------
-- RLS: lectura pública de lo publicado, escritura solo admin / service role
-- ---------------------------------------------------------------------------

alter table public.municipalities     enable row level security;
alter table public.places             enable row level security;
alter table public.organizations      enable row level security;
alter table public.sources            enable row level security;
alter table public.raw_ingestions     enable row level security;
alter table public.events             enable row level security;
alter table public.event_occurrences  enable row level security;
alter table public.festivities        enable row level security;
alter table public.admin_users        enable row level security;

create policy "public read municipalities" on public.municipalities for select using (is_active);
create policy "public read places"         on public.places         for select using (is_active);
create policy "public read organizations"  on public.organizations  for select using (true);
create policy "public read festivities"    on public.festivities    for select using (true);
create policy "public read published events" on public.events for select
  using (status = 'published' or public.is_admin());
create policy "public read occurrences of published events" on public.event_occurrences for select
  using (exists (select 1 from public.events e where e.id = event_id and (e.status = 'published' or public.is_admin())));

create policy "admin all municipalities"    on public.municipalities    for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all places"            on public.places            for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all organizations"     on public.organizations     for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all sources"           on public.sources           for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all raw_ingestions"    on public.raw_ingestions    for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all events"            on public.events            for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all occurrences"       on public.event_occurrences for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all festivities"       on public.festivities       for all using (public.is_admin()) with check (public.is_admin());
create policy "admin read admin_users"      on public.admin_users       for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: bucket público de flyers (lectura pública, escritura admin)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flyers', 'flyers', true, 15728640, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "public read flyers" on storage.objects for select using (bucket_id = 'flyers');
create policy "admin write flyers" on storage.objects for insert to authenticated
  with check (bucket_id = 'flyers' and public.is_admin());
create policy "admin update flyers" on storage.objects for update to authenticated
  using (bucket_id = 'flyers' and public.is_admin());
create policy "admin delete flyers" on storage.objects for delete to authenticated
  using (bucket_id = 'flyers' and public.is_admin());
