-- Analítica propia (anónima): eventos de uso, vínculo visitante → cuenta, links de reporte para comercios
-- y las funciones que arman los dashboards del admin. Sin IPs: solo ciudad/estado y lat/lng a 2 decimales
-- (~1 km) que da Vercel. Escribe solo la ruta /api/t con service_role; lee solo el admin (o un token de reporte).

create table public.analytics_events (
  id             bigint generated always as identity primary key,
  ts             timestamptz not null default now(),
  type           text not null check (type in (
                   'pageview','share_whatsapp','call','whatsapp_contact','maps','waze','social','website',
                   'flyer_zoom','save','unsave','interest','uninterest','login_start','search','filter')),
  path           text not null,
  event_id       uuid references public.events (id) on delete set null,
  visitor_id     uuid not null,
  session_id     uuid,
  user_id        uuid,
  source         text not null default 'directo',
  referrer_host  text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  geo_city       text,
  geo_region     text,                 -- ISO 3166-2 sin país: MOR, MEX, CMX…
  geo_country    text,
  geo_lat        numeric(5,2),
  geo_lng        numeric(5,2),
  geo_cvegeo     text references public.municipalities (cvegeo),
  search_cvegeo  text,                 -- municipio elegido en el buscador (cookie el_loc)
  device         text check (device in ('mobile','desktop')),
  props          jsonb not null default '{}'::jsonb
);
create index analytics_events_ts_idx on public.analytics_events (ts);
create index analytics_events_event_idx on public.analytics_events (event_id, ts) where event_id is not null;
create index analytics_events_visitor_idx on public.analytics_events (visitor_id, ts);

-- municipio más cercano al punto aproximado de la IP (solo cubrimos los pueblos cargados)
create or replace function public.analytics_resolve_geo()
returns trigger language plpgsql as $$
begin
  if new.geo_lat is not null and new.geo_lng is not null and new.geo_cvegeo is null then
    select m.cvegeo into new.geo_cvegeo
    from public.municipalities m
    where m.centroid is not null
      and ST_DWithin(m.centroid::geography, ST_SetSRID(ST_MakePoint(new.geo_lng, new.geo_lat), 4326)::geography, 20000)
    order by m.centroid <-> ST_SetSRID(ST_MakePoint(new.geo_lng, new.geo_lat), 4326)
    limit 1;
  end if;
  -- zona buscada por GPS (sin municipio elegido): el pueblo más cercano a ese punto
  if new.search_cvegeo is null and new.props ? 'search_lat' then
    select m.cvegeo into new.search_cvegeo
    from public.municipalities m
    where m.centroid is not null
      and ST_DWithin(m.centroid::geography, ST_SetSRID(ST_MakePoint((new.props->>'search_lng')::float8, (new.props->>'search_lat')::float8), 4326)::geography, 20000)
    order by m.centroid <-> ST_SetSRID(ST_MakePoint((new.props->>'search_lng')::float8, (new.props->>'search_lat')::float8), 4326)
    limit 1;
    new.props := new.props - 'search_lat' - 'search_lng';
  end if;
  return new;
end $$;
create trigger analytics_events_geo before insert on public.analytics_events
  for each row execute function public.analytics_resolve_geo();

-- qué visitante se volvió cuenta (y por qué fuente llegó la primera vez)
create table public.visitor_users (
  visitor_id    uuid not null,
  user_id       uuid not null references auth.users (id) on delete cascade,
  first_source  text,
  linked_at     timestamptz not null default now(),
  primary key (visitor_id, user_id)
);
create index visitor_users_user_idx on public.visitor_users (user_id);

-- link privado de solo lectura para mandarle al comercio
create table public.event_report_links (
  token       text primary key,
  event_id    uuid not null references public.events (id) on delete cascade,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create index event_report_links_event_idx on public.event_report_links (event_id);

alter table public.analytics_events   enable row level security;
alter table public.visitor_users      enable row level security;
alter table public.event_report_links enable row level security;
create policy "admin read analytics" on public.analytics_events for select using (public.is_admin());
create policy "admin all report links" on public.event_report_links for all using (public.is_admin()) with check (public.is_admin());
create policy "admin read visitor users" on public.visitor_users for select using (public.is_admin());

revoke all on public.analytics_events, public.visitor_users, public.event_report_links from anon;
revoke insert, update, delete on public.analytics_events, public.visitor_users from authenticated;
grant select on public.analytics_events, public.visitor_users to authenticated;
grant select, insert, update, delete on public.event_report_links to authenticated;
grant all on public.analytics_events, public.visitor_users, public.event_report_links to service_role;

-- ---------------------------------------------------------------------------
-- Reporte de un evento
-- ---------------------------------------------------------------------------
create or replace function public._event_report(ev uuid, f timestamptz, t timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
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
              'saves', (select count(*) from saved_events where event_id = ev),
              'interests', (select count(*) from event_interests where event_id = ev)),
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
$$;
revoke execute on function public._event_report(uuid, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.event_report(p_event uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return public._event_report(p_event, p_from, p_to);
end $$;
revoke execute on function public.event_report(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.event_report(uuid, timestamptz, timestamptz) to authenticated, service_role;

-- el comercio: todo desde que se publicó el evento, con un token vigente
create or replace function public.event_report_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare ev uuid; since timestamptz;
begin
  select l.event_id, x.created_at into ev, since
  from event_report_links l join events x on x.id = l.event_id
  where l.token = p_token and l.revoked_at is null;
  if ev is null then return null; end if;
  return public._event_report(ev, date_trunc('day', since), now());
end $$;
revoke execute on function public.event_report_by_token(text) from public;
grant execute on function public.event_report_by_token(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Vista general del negocio
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;

  with
  e as (select * from analytics_events where ts >= p_from and ts < p_to),
  pv as (select * from e where type = 'pageview'),
  first_seen as (
    select visitor_id, min(ts) as first_ts from analytics_events group by visitor_id
  ),
  new_visitors as (select * from first_seen where first_ts >= p_from and first_ts < p_to),
  days as (
    select d::date as day
    from generate_series(date_trunc('day', p_from at time zone 'America/Mexico_City'),
                         date_trunc('day', (p_to - interval '1 second') at time zone 'America/Mexico_City'), interval '1 day') d
  ),
  daily as (
    select days.day,
           (select count(distinct visitor_id) from pv where (pv.ts at time zone 'America/Mexico_City')::date = days.day) as visitors,
           (select count(distinct user_id) from e where user_id is not null and (e.ts at time zone 'America/Mexico_City')::date = days.day) as users,
           (select count(*) from auth.users u where (u.created_at at time zone 'America/Mexico_City')::date = days.day
              and not exists (select 1 from admin_users ad where ad.user_id = u.id)) as signups
    from days
  ),
  -- fuente de la primera visita de cada visitante nuevo
  first_source as (
    select distinct on (a.visitor_id) a.visitor_id, a.source
    from analytics_events a join new_visitors n using (visitor_id)
    where a.type = 'pageview' order by a.visitor_id, a.ts
  ),
  vpt as (select distinct on (visitor_id) visitor_id, geo_cvegeo, geo_city, geo_region from pv order by visitor_id, ts desc),
  cohorts as (
    select date_trunc('week', n.first_ts at time zone 'America/Mexico_City')::date as week,
           count(*) as size,
           count(*) filter (where exists (
             select 1 from analytics_events a
             where a.visitor_id = n.visitor_id and a.ts >= n.first_ts + interval '1 day' and a.ts < n.first_ts + interval '8 days'
           )) as returned
    from new_visitors n group by 1
  ),
  cat_views as (
    select x.category, count(distinct pv.visitor_id) as n from pv join events x on x.id = pv.event_id group by 1
  ),
  funnel as (
    select
      count(distinct visitor_id) filter (where type = 'pageview') as visitors,
      count(distinct visitor_id) filter (where type = 'pageview' and event_id is not null) as saw_event,
      count(distinct visitor_id) filter (where type in ('call','whatsapp_contact','maps','waze','share_whatsapp','social','website','save','interest')) as acted,
      count(distinct visitor_id) filter (where type in ('save','interest')) as saved,
      count(distinct visitor_id) filter (where type in ('call','whatsapp_contact')) as contacted
    from e
  ),
  top_events as (
    select x.id, x.title, x.slug, count(*) filter (where a.type = 'pageview') as views,
           count(distinct a.visitor_id) filter (where a.type = 'pageview') as visitors,
           count(*) filter (where a.type not in ('pageview','unsave','uninterest','flyer_zoom')) as actions
    from e a join events x on x.id = a.event_id
    group by x.id, x.title, x.slug order by views desc limit 10
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'kpi', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from pv),
      'new_visitors', (select count(*) from new_visitors),
      'sessions', (select count(distinct session_id) from pv),
      'pageviews', (select count(*) from pv),
      'active_users', (select count(distinct user_id) from e where user_id is not null),
      'dau', (select count(distinct visitor_id) from analytics_events where type = 'pageview' and ts >= p_to - interval '1 day' and ts < p_to),
      'wau', (select count(distinct visitor_id) from analytics_events where type = 'pageview' and ts >= p_to - interval '7 days' and ts < p_to),
      'mau', (select count(distinct visitor_id) from analytics_events where type = 'pageview' and ts >= p_to - interval '30 days' and ts < p_to),
      'signups', (select count(*) from auth.users u where u.created_at >= p_from and u.created_at < p_to
                  and not exists (select 1 from admin_users ad where ad.user_id = u.id)),
      'users_total', (select count(*) from auth.users u where not exists (select 1 from admin_users a where a.user_id = u.id)),
      'users_before', (select count(*) from auth.users u where u.created_at < p_from
                       and not exists (select 1 from admin_users ad where ad.user_id = u.id)),
      'published_events', (select count(*) from events where status = 'published'),
      'submissions', (select count(*) from raw_ingestions where payload->>'submitted_via' = 'publicar' and received_at >= p_from and received_at < p_to)
    ),
    'daily', coalesce((select jsonb_agg(to_jsonb(daily) order by day) from daily), '[]'),
    'acquisition', jsonb_build_object(
      'visitors', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'n', n) order by n desc)
                            from (select source, count(*) as n from first_source group by 1) s), '[]'),
      'signups', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'n', n) order by n desc)
                           from (select coalesce(vu.first_source, 'sin dato') as source, count(distinct u.id) as n
                                 from auth.users u left join visitor_users vu on vu.user_id = u.id
                                 where u.created_at >= p_from and u.created_at < p_to
                                   and not exists (select 1 from admin_users ad where ad.user_id = u.id) group by 1) s), '[]')
    ),
    'places', jsonb_build_object(
      'visitors', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'state', state, 'n', n) order by n desc)
                            from (select coalesce(m.name, v.geo_city, 'Sin ubicación') as label, coalesce(m.state, v.geo_region) as state, count(*) as n
                                  from vpt v left join municipalities m on m.cvegeo = v.geo_cvegeo group by 1, 2 order by n desc limit 12) s), '[]'),
      'regions', coalesce((select jsonb_agg(jsonb_build_object('region', region, 'n', n) order by n desc)
                           from (select coalesce(geo_region, '?') as region, count(*) as n from vpt group by 1) s), '[]'),
      'members', coalesce((select jsonb_agg(jsonb_build_object('label', m.name, 'state', m.state, 'n', n) order by n desc)
                           from (select home_municipality, count(*) as n from profiles where home_municipality is not null group by 1) s
                           join municipalities m on m.cvegeo = s.home_municipality), '[]'),
      'searched', coalesce((select jsonb_agg(jsonb_build_object('label', m.name, 'n', n) order by n desc)
                            from (select search_cvegeo, count(distinct visitor_id) as n from pv where search_cvegeo is not null group by 1 order by 2 desc limit 10) s
                            join municipalities m on m.cvegeo = s.search_cvegeo), '[]')
    ),
    'categories', jsonb_build_object(
      'views', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'n', n) order by n desc) from cat_views), '[]'),
      'saves', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'n', n) order by n desc)
                         from (select x.category, count(*) as n from saved_events s join events x on x.id = s.event_id group by 1) s), '[]'),
      'interests', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'n', n) order by n desc)
                             from (select x.category, count(*) as n from event_interests i join events x on x.id = i.event_id group by 1) s), '[]'),
      'declared', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'n', n) order by n desc)
                            from (select unnest(categories) as category, count(*) as n from profiles group by 1) s), '[]'),
      'companions', coalesce((select jsonb_agg(jsonb_build_object('id', c, 'n', n) order by n desc)
                              from (select unnest(companions) as c, count(*) as n from profiles group by 1) s), '[]')
    ),
    'funnel', (select to_jsonb(funnel) from funnel),
    'retention', coalesce((select jsonb_agg(jsonb_build_object('week', week, 'size', size, 'returned', returned) order by week) from cohorts), '[]'),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('device', coalesce(device, 'desktop'), 'n', n))
                         from (select device, count(distinct visitor_id) as n from pv group by 1) s), '[]'),
    'top_events', coalesce((select jsonb_agg(to_jsonb(top_events) order by views desc) from top_events), '[]')
  ) into result;
  return result;
end $$;
revoke execute on function public.admin_overview(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_overview(timestamptz, timestamptz) to authenticated, service_role;

-- retención de la analítica: 13 meses
create or replace function public.analytics_prune()
returns integer language sql security definer set search_path = public as $$
  with d as (delete from analytics_events where ts < now() - interval '13 months' returning 1)
  select count(*)::int from d
$$;
revoke execute on function public.analytics_prune() from public, anon, authenticated;
grant execute on function public.analytics_prune() to service_role;
