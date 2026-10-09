-- Punto de enfoque del flyer (0–100 %, como object-position): las tarjetas recortan el flyer a 4:3 y la
-- miniatura a casi cuadrado; el admin elige qué parte queda a la vista. 50/50 = centro (lo de siempre).
alter table public.events
  add column image_focus_x smallint not null default 50 check (image_focus_x between 0 and 100),
  add column image_focus_y smallint not null default 50 check (image_focus_y between 0 and 100);

-- las funciones cambian de tipo de retorno: hay que borrarlas y recrearlas (con sus permisos)
drop function public.events_near(double precision, double precision, integer, timestamptz, timestamptz);
create function public.events_near(
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
  distance_m double precision, image_focus_x smallint, image_focus_y smallint
)
language sql stable as $$
  with pt as (select ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography g)
  select e.id, e.slug, e.title, e.category, e.is_free, e.price_min, e.price_max, e.image_path,
         o.starts_at, o.ends_at, o.is_all_day,
         p.id, coalesce(p.name, e.place_text), e.municipality_cvegeo, m.name,
         ST_Distance(coalesce(p.geom, m.centroid)::geography, pt.g),
         e.image_focus_x, e.image_focus_y
  from public.event_occurrences o
  join public.events e on e.id = o.event_id and e.status = 'published'
  join public.municipalities m on m.cvegeo = e.municipality_cvegeo
  left join public.places p on p.id = e.place_id
  cross join pt
  where o.starts_at <= to_ts
    and coalesce(o.ends_at, o.starts_at) >= from_ts
    and ST_DWithin(coalesce(p.geom, m.centroid)::geography, pt.g, radius_m)
  order by o.starts_at, 16
$$;

drop function public.events_live_near(double precision, double precision, integer, timestamptz);
create function public.events_live_near(
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
  distance_m double precision, image_focus_x smallint, image_focus_y smallint
)
language sql stable as $$
  with pt as (select ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography g)
  select e.id, e.slug, e.title, e.category, e.is_free, e.price_min, e.price_max, e.image_path,
         o.starts_at, o.ends_at, o.is_all_day,
         p.id, coalesce(p.name, e.place_text), e.municipality_cvegeo, m.name,
         ST_Distance(coalesce(p.geom, m.centroid)::geography, pt.g),
         e.image_focus_x, e.image_focus_y
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

grant execute on function public.events_near(double precision, double precision, integer, timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.events_live_near(double precision, double precision, integer, timestamptz) to anon, authenticated, service_role;

-- columnas nuevas al final: create or replace basta
create or replace view public.event_points_view
with (security_invoker = true) as
select e.id as event_id, e.slug, e.title, e.category, e.is_free, e.price_min, e.price_max, e.image_path,
       e.municipality_cvegeo, m.name as municipality_name,
       coalesce(p.name, e.place_text) as place_name,
       ST_Y(coalesce(p.geom, m.centroid)) as lat, ST_X(coalesce(p.geom, m.centroid)) as lng,
       o.id as occurrence_id, o.starts_at, o.ends_at, o.is_all_day,
       e.image_focus_x, e.image_focus_y
from public.events e
join public.municipalities m on m.cvegeo = e.municipality_cvegeo
join public.event_occurrences o on o.event_id = e.id
left join public.places p on p.id = e.place_id
where e.status = 'published';
