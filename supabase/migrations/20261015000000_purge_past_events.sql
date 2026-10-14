-- Purga de eventos pasados: una semana después de su última fecha, el evento pierde su contenido (flyer, fotos,
-- descripción, contacto, texto del OCR) y los datos ligados a personas (guardados, interesados, planes en grupo).
-- Queda una fila esqueleto (título, categoría, municipio, lugar, fechas) para que la analítica, los reportes del
-- comercio y el generador de fiestas sigan funcionando. Los totales que se pierden con las filas borradas se
-- congelan antes en final_stats. La corre a diario /api/cron/purgar-eventos, que además quita las fotos del bucket.

alter table public.events
  add column purged_at   timestamptz,
  add column keep        boolean not null default false,   -- "Conservar": el admin lo saca de la purga
  add column final_stats jsonb;                            -- guardados, interesados y planes al momento de purgar

create or replace function public.purge_past_events(p_grace interval default interval '7 days')
returns table (event_id uuid, photo_paths text[])
language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  -- la última fecha manda: un evento con alguna fecha por venir nunca entra
  select coalesce(array_agg(x.id), '{}') into ids
  from events x
  where x.purged_at is null and not x.keep
    and exists (select 1 from event_occurrences o where o.event_id = x.id)
    and (select max(coalesce(o.ends_at, o.starts_at)) from event_occurrences o where o.event_id = x.id) < now() - p_grace;
  if cardinality(ids) = 0 then return; end if;

  drop table if exists _purge;
  create temp table _purge on commit drop as
  select x.id,
         array_remove(array_cat(array[x.image_path, r.media_path], x.gallery_paths), null) as paths,
         jsonb_build_object(
           'saves',        (select count(*) from saved_events s where s.event_id = x.id),
           'interests',    (select count(*) from event_interests i where i.event_id = x.id),
           'plans',        (select count(*) from plans p where p.event_id = x.id),
           'plan_members', (select count(*) from plan_members pm join plans p on p.id = pm.plan_id where p.event_id = x.id)
         ) as stats
  from events x left join raw_ingestions r on r.id = x.raw_ingestion_id
  where x.id = any (ids);

  delete from plans p where p.event_id = any (ids);
  delete from saved_events s where s.event_id = any (ids);
  delete from event_interests i where i.event_id = any (ids);
  update raw_ingestions r
     set media_path = null, ocr_text = null, extraction = null, correction = null, payload = '{}'::jsonb
   where r.id in (select x.raw_ingestion_id from events x where x.id = any (ids));
  update events x
     set description = null, departure_text = null, image_path = null, gallery_paths = '{}',
         contact_phone = null, instagram_url = null, facebook_url = null, tiktok_url = null, website_url = null,
         final_stats = p.stats, purged_at = now()
    from _purge p where p.id = x.id;

  -- solo las fotos que ya nadie más usa (la de una fiesta se reutiliza cada año; una foto puede ser de una experiencia)
  return query
  select p.id, coalesce(array(
    select distinct u.path from unnest(p.paths) as u(path)
    where not exists (select 1 from events e where e.image_path = u.path or u.path = any (e.gallery_paths))
      and not exists (select 1 from festivities f where f.image_path = u.path)
      and not exists (select 1 from experiences xp where xp.image_path = u.path or u.path = any (xp.gallery_paths))
      and not exists (select 1 from raw_ingestions r where r.media_path = u.path)
  ), '{}')
  from _purge p;
end $$;
revoke execute on function public.purge_past_events(interval) from public, anon, authenticated;
grant execute on function public.purge_past_events(interval) to service_role;

-- reporte del evento: ya purgado, guardados e interesados salen de lo congelado
create or replace function public._event_report(ev uuid, f timestamp with time zone, t timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with
  e as (select * from analytics_events where event_id = ev and ts >= f and ts < t),
  pv as (select * from e where type = 'pageview'),
  meta as (
    select x.id, x.title, x.slug, x.category, x.created_at, x.municipality_cvegeo,
           coalesce(p.geom, m.centroid) as pt,
           (select min(o.starts_at) from event_occurrences o where o.event_id = x.id and coalesce(o.ends_at, o.starts_at) >= now()) as next_at
    from events x
    left join places p on p.id = x.place_id
    left join municipalities m on m.cvegeo = x.municipality_cvegeo
    where x.id = ev
  ),
  kpi as (
    select
      count(*) filter (where type = 'pageview')                                   as views,
      count(distinct visitor_id) filter (where type = 'pageview')                 as visitors,
      count(*) filter (where type in ('call', 'whatsapp_contact'))                as contact,
      count(*) filter (where type in ('maps', 'waze'))                            as directions,
      count(*) filter (where type = 'share_whatsapp')                             as shares,
      count(*) filter (where type in ('social', 'website'))                       as links,
      count(distinct visitor_id) filter (where type in ('call','whatsapp_contact','maps','waze','share_whatsapp','social','website','save','interest')) as acting
    from e
  ),
  days as (
    select d::date as day
    from generate_series(date_trunc('day', f at time zone 'America/Mexico_City'),
                         date_trunc('day', (t - interval '1 second') at time zone 'America/Mexico_City'), interval '1 day') d
  ),
  daily as (
    select days.day,
           count(e.id) filter (where e.type = 'pageview') as views,
           count(e.id) filter (where e.type not in ('pageview','unsave','uninterest','flyer_zoom')) as actions
    from days left join e on (e.ts at time zone 'America/Mexico_City')::date = days.day
    group by days.day order by days.day
  ),
  -- un punto por visitante (su última ubicación conocida)
  vpt as (
    select distinct on (visitor_id) visitor_id, geo_lat, geo_lng, geo_cvegeo, geo_city, geo_region, device
    from pv order by visitor_id, ts desc
  ),
  dist as (
    select case
             when d < 10 then '<10 km' when d < 30 then '10–30 km' when d < 60 then '30–60 km' else '>60 km'
           end as bucket, count(*) as n
    from (
      select ST_Distance(ST_SetSRID(ST_MakePoint(v.geo_lng, v.geo_lat), 4326)::geography, meta.pt::geography) / 1000 as d
      from vpt v, meta where v.geo_lat is not null and meta.pt is not null
    ) s group by 1
  ),
  -- fuente de llegada: la de la primera vista de la sesión en que vio el evento; si fue interna,
  -- la primera fuente externa de esa persona; si no hay, "interno"
  landing as (
    select distinct on (v.visitor_id) v.visitor_id,
      coalesce(
        (select a.source from analytics_events a
          where a.type = 'pageview' and a.source <> 'interno'
            and ((v.session_id is not null and a.session_id = v.session_id) or a.visitor_id = v.visitor_id)
            and a.ts <= v.ts
          order by (a.session_id is not distinct from v.session_id) desc, a.ts desc limit 1),
        'interno') as source
    from pv v order by v.visitor_id, v.ts
  ),
  audience as (select distinct visitor_id from pv),
  audience_users as (
    select distinct user_id from e where user_id is not null
    union select vu.user_id from visitor_users vu join audience a using (visitor_id)
  ),
  likes as (
    select category, sum(w) as w from (
      select x.category, 1 as w
      from analytics_events o join audience a using (visitor_id) join events x on x.id = o.event_id
      where o.type = 'pageview' and o.event_id <> ev
      union all
      select unnest(pr.categories), 1 from profiles pr join audience_users u using (user_id)
    ) s group by category
  ),
  bench as (
    select percentile_cont(0.5) within group (order by v) as med_views
    from (
      select a.event_id, count(*) as v
      from analytics_events a join events x on x.id = a.event_id
      where a.type = 'pageview' and a.event_id <> ev and x.category = (select category from meta)
        and a.ts >= f and a.ts < t
      group by a.event_id
    ) s
  )
  select jsonb_build_object(
    'event', (select jsonb_build_object('id', id, 'title', title, 'slug', slug, 'category', category, 'created_at', created_at, 'next_at', next_at) from meta),
    'range', jsonb_build_object('from', f, 'to', t),
    'kpi', (select to_jsonb(kpi) from kpi) || jsonb_build_object(
              'saves', coalesce((select (final_stats->>'saves')::bigint from events where id = ev), (select count(*) from saved_events where event_id = ev)),
              'interests', coalesce((select (final_stats->>'interests')::bigint from events where id = ev), (select count(*) from event_interests where event_id = ev))),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'actions', actions) order by day) from daily), '[]'),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'n', n) order by n desc)
                         from (select source, count(*) as n from landing group by source) s), '[]'),
    'places', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'state', state, 'n', n) order by n desc)
                        from (select coalesce(m.name, v.geo_city, 'Sin ubicación') as label,
                                     coalesce(m.state, v.geo_region) as state, count(*) as n
                              from vpt v left join municipalities m on m.cvegeo = v.geo_cvegeo
                              group by 1, 2 order by n desc limit 10) s), '[]'),
    'searched', coalesce((select jsonb_agg(jsonb_build_object('label', m.name, 'n', n) order by n desc)
                          from (select search_cvegeo, count(distinct visitor_id) as n from pv where search_cvegeo is not null group by 1 order by 2 desc limit 8) s
                          join municipalities m on m.cvegeo = s.search_cvegeo), '[]'),
    'distance', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'n', n)) from dist), '[]'),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('device', coalesce(device, 'desktop'), 'n', n))
                         from (select device, count(*) as n from vpt group by 1) s), '[]'),
    'likes', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'w', w) order by w desc)
                       from (select * from likes order by w desc limit 6) s), '[]'),
    'heatmap', coalesce((select jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'n', n))
                         from (select extract(isodow from ts at time zone 'America/Mexico_City')::int as dow,
                                      extract(hour from ts at time zone 'America/Mexico_City')::int as hour, count(*) as n
                               from pv group by 1, 2) s), '[]'),
    'benchmark', (select jsonb_build_object('median_views', med_views) from bench)
  )
$function$

;
