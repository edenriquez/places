-- events_near: incluir ocurrencias que se SOLAPAN con el rango (ferias de varios días ya iniciadas),
-- no solo las que empiezan dentro de él.
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
  where o.starts_at <= to_ts
    and coalesce(o.ends_at, o.starts_at) >= from_ts
    and ST_DWithin(coalesce(p.geom, m.centroid)::geography, pt.g, radius_m)
  order by o.starts_at, 16
$$;
