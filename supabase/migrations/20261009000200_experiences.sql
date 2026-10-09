-- Experiencias: algo que se puede hacer en un lugar sin depender de una fecha (una ruta, una cascada, un
-- taller). Un evento ocurre en una fecha; una experiencia puede generar eventos (salidas guiadas) y sigue
-- existiendo cuando esas fechas pasan. Jerarquía de descubrimiento: municipio → lugar → experiencias + eventos.

-- tipos de lugar al aire libre y de productores, donde suelen vivir las experiencias
alter table public.places drop constraint places_kind_check;
alter table public.places add constraint places_kind_check check (kind in (
  'museo','teatro','casa_cultura','centro_cultural','galeria','auditorio',
  'zona_arqueologica','templo','plaza','explanada','mercado','ex_hacienda',
  'parque','bar','restaurante','deportivo','escuela','otro',
  'parque_ecoturistico','cascada','sendero','mirador','bosque','rancho','vinedo','taller'));

create table public.experiences (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  title               text not null,
  kind                text not null check (kind in (
                        'senderismo','montanismo','ecoturismo','cascadas','aves','fauna','astronomia',
                        'ciclismo','campismo','interpretativo','fotografia','educacion_ambiental',
                        'gastronomia','taller_artesanal','cultural','agricola','cabalgata','productores',
                        'enoturismo','historico')),
  description         text,
  municipality_cvegeo text not null references public.municipalities (cvegeo),
  place_id            uuid references public.places (id),
  place_text          text,                 -- si el lugar no está en el catálogo
  geom                geometry(Point, 4326),-- punto de inicio (sendero); si falta, el del lugar o el municipio
  org_id              uuid references public.organizations (id),   -- prestador u organizador
  duration_text       text,                 -- "3–4 h"
  distance_km         numeric(6,1),
  difficulty          text check (difficulty in ('facil','moderada','dificil')),
  is_free             boolean not null default false,
  price_min           numeric(10,2),
  price_max           numeric(10,2),
  price_note          text,                 -- "acceso", "con guía", "por persona"
  availability_text   text,                 -- resumen para tarjetas: "Todos los días", "Sáb y dom · 6:30"
  hours               jsonb not null default '[]'::jsonb,   -- [{ "days": "Lun – Vie", "time": "8:00 – 17:00" }]
  season_text         text,                 -- "Mejor temporada: junio a noviembre"
  bring               text[] not null default '{}',         -- qué llevar
  contact_phone       text,
  contact_whatsapp    boolean not null default true,
  booking_note        text,                 -- "Reserva con 1 día de anticipación"
  website_url         text,
  instagram_url       text,
  facebook_url        text,
  image_path          text,                 -- portada (bucket flyers)
  image_focus_x       smallint not null default 50 check (image_focus_x between 0 and 100),
  image_focus_y       smallint not null default 50 check (image_focus_y between 0 and 100),
  gallery_paths       text[] not null default '{}' check (cardinality(gallery_paths) <= 9),
  verified_at         timestamptz,          -- cuándo se confirmó la información
  valid_until         date,                 -- vigencia: después de esta fecha deja de listarse
  status              text not null default 'draft' check (status in ('draft','published','archived')),
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index experiences_muni_idx on public.experiences (municipality_cvegeo);
create index experiences_place_idx on public.experiences (place_id);
create index experiences_status_idx on public.experiences (status);
create trigger experiences_updated_at before update on public.experiences
  for each row execute function public.set_updated_at();

-- un evento puede ser una fecha de una experiencia (salida guiada, taller con cupo)
alter table public.events add column experience_id uuid references public.experiences (id) on delete set null;
create index events_experience_idx on public.events (experience_id) where experience_id is not null;

alter table public.experiences enable row level security;
create policy "public read published experiences" on public.experiences for select
  using (status = 'published' or public.is_admin());
create policy "admin all experiences" on public.experiences for all using (public.is_admin()) with check (public.is_admin());

grant select on public.experiences to anon, authenticated;
grant select, insert, update, delete on public.experiences to authenticated;
grant all on public.experiences to service_role;

-- Experiencias publicadas y vigentes cerca de un punto, de la más cercana a la más lejana.
-- `upcoming`: cuántas fechas futuras tienen sus eventos publicados (salidas con guía).
create function public.experiences_near(
  lat double precision,
  lng double precision,
  radius_m integer default 30000
)
returns table (
  experience_id uuid, slug text, title text, kind text, is_free boolean,
  price_min numeric, price_max numeric, price_note text, image_path text,
  image_focus_x smallint, image_focus_y smallint,
  duration_text text, distance_km numeric, difficulty text, availability_text text,
  place_id uuid, place_name text, municipality_cvegeo text, municipality_name text,
  distance_m double precision, upcoming integer
)
language sql stable as $$
  with pt as (select ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography g)
  select x.id, x.slug, x.title, x.kind, x.is_free, x.price_min, x.price_max, x.price_note, x.image_path,
         x.image_focus_x, x.image_focus_y,
         x.duration_text, x.distance_km, x.difficulty, x.availability_text,
         p.id, coalesce(p.name, x.place_text), x.municipality_cvegeo, m.name,
         ST_Distance(coalesce(x.geom, p.geom, m.centroid)::geography, pt.g),
         (select count(*)::integer
            from public.events e
            join public.event_occurrences o on o.event_id = e.id
           where e.experience_id = x.id and e.status = 'published' and o.starts_at >= now())
  from public.experiences x
  join public.municipalities m on m.cvegeo = x.municipality_cvegeo
  left join public.places p on p.id = x.place_id
  cross join pt
  where x.status = 'published'
    and (x.valid_until is null or x.valid_until >= current_date)
    and ST_DWithin(coalesce(x.geom, p.geom, m.centroid)::geography, pt.g, radius_m)
  order by 20, x.title
$$;
grant execute on function public.experiences_near(double precision, double precision, integer) to anon, authenticated, service_role;

-- coordenadas planas para la web (PostgREST no expone geometry cómodamente)
create view public.experiences_view
with (security_invoker = true) as
select x.*, ST_Y(coalesce(x.geom, p.geom, m.centroid)) as lat, ST_X(coalesce(x.geom, p.geom, m.centroid)) as lng
from public.experiences x
join public.municipalities m on m.cvegeo = x.municipality_cvegeo
left join public.places p on p.id = x.place_id;
grant select on public.experiences_view to anon, authenticated;
grant all on public.experiences_view to service_role;
