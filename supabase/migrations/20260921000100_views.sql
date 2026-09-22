-- Vistas con lat/lng planos para la web (PostgREST no expone geometry cómodamente).

create or replace view public.municipalities_view
with (security_invoker = true) as
select cvegeo, cve_ent, cve_mun, state, name, slug, is_pueblo_magico, population,
       cover_image_url, description, drive_from_cdmx, is_active,
       ST_Y(centroid) as lat, ST_X(centroid) as lng
from public.municipalities;

create or replace view public.places_view
with (security_invoker = true) as
select id, name, slug, kind, address, locality, municipality_cvegeo, source, source_ref,
       phone, website, photos, is_active,
       ST_Y(geom) as lat, ST_X(geom) as lng
from public.places;

-- Puntos para el mapa: eventos publicados con coordenadas (lugar o centroide del municipio)
create or replace view public.event_points_view
with (security_invoker = true) as
select e.id as event_id, e.slug, e.title, e.category, e.is_free, e.price_min, e.price_max, e.image_path,
       e.municipality_cvegeo, m.name as municipality_name,
       coalesce(p.name, e.place_text) as place_name,
       ST_Y(coalesce(p.geom, m.centroid)) as lat, ST_X(coalesce(p.geom, m.centroid)) as lng,
       o.id as occurrence_id, o.starts_at, o.ends_at, o.is_all_day
from public.events e
join public.municipalities m on m.cvegeo = e.municipality_cvegeo
join public.event_occurrences o on o.event_id = e.id
left join public.places p on p.id = e.place_id
where e.status = 'published';

grant select on public.municipalities_view, public.places_view, public.event_points_view to anon, authenticated;
