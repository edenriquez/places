-- Clics del público para el mapa de calor y el recorrido de cada visitante nuevo.
-- El navegador los junta en memoria y los manda en lote (sendBeacon a /api/t/c al cambiar de página, al
-- ocultarse la pestaña o cada 25 clics): no hay una petición por clic. Mismo filtro que /api/t (bots, equipo).
-- x: fracción del ancho del documento (0–1); y: px desde el inicio del documento; vw: ancho de la ventana.

create table public.analytics_clicks (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  visitor_id  uuid not null,
  session_id  uuid,
  user_id     uuid,
  path        text not null,
  x           real not null check (x >= 0 and x <= 1),
  y           integer not null check (y >= 0),
  vw          smallint not null,
  device      text check (device in ('mobile','desktop')),
  target      text            -- "track:maps", "a:Ver evento", "button:Guardar"… nunca el valor de un campo
);
create index analytics_clicks_path_idx on public.analytics_clicks (path, ts);
create index analytics_clicks_visitor_idx on public.analytics_clicks (visitor_id, ts);
create index analytics_clicks_ts_idx on public.analytics_clicks (ts);

alter table public.analytics_clicks enable row level security;
create policy "admin read clicks" on public.analytics_clicks for select using (public.is_admin());
revoke all on public.analytics_clicks from anon, authenticated;
grant select on public.analytics_clicks to authenticated;
grant all on public.analytics_clicks to service_role;

-- ---------------------------------------------------------------------------
-- Visitantes nuevos: su primera vista cae en el rango. Uno por fila con lo que hicieron (en todo su historial).
-- ---------------------------------------------------------------------------
create or replace function public.admin_new_visitors(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;

  with
  firsts as (
    select distinct on (visitor_id) visitor_id, ts as first_ts, source, path as entry, geo_city, geo_region, device
    from analytics_events where type = 'pageview'
    order by visitor_id, ts
  ),
  newbies as (select * from firsts where first_ts >= p_from and first_ts < p_to order by first_ts desc limit 300),
  ev as (
    select e.visitor_id,
           count(distinct e.session_id) as sessions,
           count(*) filter (where e.type = 'pageview') as pages,
           count(*) filter (where e.type <> 'pageview') as actions,
           max(e.ts) as last_ts,
           (array_agg(e.type order by e.ts desc) filter (where e.type <> 'pageview'))[1] as last_action
    from analytics_events e join newbies n using (visitor_id) group by 1
  ),
  cl as (select c.visitor_id, count(*) as clicks, max(c.ts) as last_ts from analytics_clicks c join newbies n using (visitor_id) group by 1),
  acc as (select vu.visitor_id, min(vu.linked_at) as linked_at from visitor_users vu join newbies n using (visitor_id) group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
    'visitor_id', n.visitor_id, 'first_ts', n.first_ts, 'source', n.source, 'entry', n.entry,
    'city', n.geo_city, 'region', n.geo_region, 'device', n.device,
    'sessions', coalesce(ev.sessions, 0), 'pages', coalesce(ev.pages, 0), 'actions', coalesce(ev.actions, 0),
    'clicks', coalesce(cl.clicks, 0), 'last_action', ev.last_action,
    'last_ts', greatest(ev.last_ts, cl.last_ts), 'signed_up', acc.linked_at is not null
  ) order by n.first_ts desc), '[]'::jsonb)
  into result
  from newbies n left join ev using (visitor_id) left join cl using (visitor_id) left join acc using (visitor_id);
  return result;
end $$;
grant execute on function public.admin_new_visitors(timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Recorrido de un visitante: vistas, acciones y clics en orden, con el título del evento cuando hay uno.
-- ---------------------------------------------------------------------------
create or replace function public.admin_visitor_journey(p_visitor uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;

  with steps as (
    select e.ts, e.session_id, e.type, e.path, null::text as target, x.title as event_title,
           e.source, e.geo_city, e.geo_region, e.device, e.props
    from analytics_events e left join events x on x.id = e.event_id
    where e.visitor_id = p_visitor
    union all
    select c.ts, c.session_id, 'click', c.path, c.target, null, null, null, null, c.device, '{}'::jsonb
    from analytics_clicks c where c.visitor_id = p_visitor
      and coalesce(c.target, '') not like 'track:%'  -- esas ya están como acción
  ),
  last as (select * from steps order by ts desc limit 1500)
  select jsonb_build_object(
    'steps', coalesce((select jsonb_agg(to_jsonb(s) order by s.ts) from last s), '[]'::jsonb),
    'linked', exists (select 1 from visitor_users where visitor_id = p_visitor)
  ) into result;
  return result;
end $$;
grant execute on function public.admin_visitor_journey(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Mapa de calor: páginas con más clics y, para una, los puntos agrupados (1% del ancho × 8 px) y lo más tocado.
-- ---------------------------------------------------------------------------
create or replace function public.admin_heatmap(p_from timestamptz, p_to timestamptz, p_device text, p_path text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;

  with
  c as (select * from analytics_clicks where ts >= p_from and ts < p_to and device = p_device),
  pages as (select path, count(*) as n, count(distinct visitor_id) as visitors from c group by 1 order by 2 desc limit 30),
  sel as (select * from c where path = coalesce(p_path, (select path from pages limit 1)))
  select jsonb_build_object(
    'pages', coalesce((select jsonb_agg(to_jsonb(p) order by p.n desc) from pages p), '[]'::jsonb),
    'path', (select path from sel limit 1),
    'total', (select count(*) from sel),
    'vw', (select percentile_disc(0.5) within group (order by vw) from sel),
    'points', coalesce((
      select jsonb_agg(jsonb_build_array(px, py, n)) from (
        select round(x * 100)::int as px, (y / 8) * 8 as py, count(*) as n from sel group by 1, 2
      ) g), '[]'::jsonb),
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object('target', target, 'n', n, 'visitors', v) order by n desc) from (
        select target, count(*) as n, count(distinct visitor_id) as v from sel where target is not null
        group by 1 order by 2 desc limit 15
      ) t), '[]'::jsonb)
  ) into result;
  return result;
end $$;
grant execute on function public.admin_heatmap(timestamptz, timestamptz, text, text) to authenticated, service_role;
