-- Blog y asistentes de IA en la analítica:
--   · fuente nueva 'ia' (ChatGPT, Perplexity, Gemini, Claude, Copilot…): antes caían en 'otro' y Gemini en 'google'.
--     Mismo patrón que classifySource (apps/web/lib/analytics.ts); aquí se reclasifica lo ya guardado.
--   · admin_blog: visitas a las guías, de dónde llegan y si siguen a la app.
--   · admin_behavior: el blog como puerta de entrada propia (antes era 'otra').

update analytics_events set source = 'ia'
where type = 'pageview' and source <> 'ia' and (
  referrer_host ~ '(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|deepseek\.com|meta\.ai|grok\.com)$|^com\.openai\.chatgpt|^ai\.perplexity'
  or utm_source ~* 'chatgpt|openai|perplexity|claude|gemini|copilot|deepseek'
);

update visitor_users vu set first_source = f.source
from (
  select distinct on (visitor_id) visitor_id, source from analytics_events
  where type = 'pageview' order by visitor_id, ts
) f
where f.visitor_id = vu.visitor_id and vu.first_source is distinct from f.source;

-- ---------------------------------------------------------------------------
-- Blog: /blog/* y /en/blog/*
-- ---------------------------------------------------------------------------
create or replace function public.admin_blog(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;

  with
  e as (select * from analytics_events where ts >= p_from and ts < p_to),
  pv as (select * from e where type = 'pageview'),
  bpv as (select * from pv where path ~ '^(/en)?/blog(/|$)'),
  days as (
    select d::date as day
    from generate_series(date_trunc('day', p_from at time zone 'America/Mexico_City'),
                         date_trunc('day', (p_to - interval '1 second') at time zone 'America/Mexico_City'), interval '1 day') d
  ),
  -- sesiones: la primera página dice por dónde entró y su fuente; las demás, si siguió a la app.
  -- Guardar o "me interesa" desde una tarjeta de la guía también cuenta como seguir: así acted ⊆ app.
  sess0 as (
    select session_id,
           (array_agg(path order by ts) filter (where type = 'pageview'))[1] as entry,
           (array_agg(source order by ts) filter (where type = 'pageview'))[1] as source,
           min(ts) as t0,
           bool_or(type = 'pageview' and path !~ '^(/en)?/blog(/|$)') as left_blog,
           bool_or(type = 'pageview' and (event_id is not null or path ~ '^/(evento|experiencia)/')) as saw_event,
           bool_or(type in ('call','whatsapp_contact','maps','waze','share_whatsapp','social','website','save','interest','plan_create','plan_join')) as acted
    from e where session_id is not null group by 1
    having count(*) filter (where type = 'pageview') > 0
  ),
  sess as (select *, left_blog or acted as app from sess0),
  bsess as (select * from sess where entry ~ '^(/en)?/blog(/|$)'),
  post_views as (select path, count(*) as views, count(distinct visitor_id) as visitors from bpv group by 1),
  post_entries as (
    select entry as path, count(*) as entries,
           count(*) filter (where source in ('google', 'buscador')) as search,
           count(*) filter (where source = 'ia') as ai,
           count(*) filter (where app) as app,
           count(*) filter (where acted) as acted
    from bsess group by 1
  ),
  posts as (
    select coalesce(v.path, n.path) as path, coalesce(v.views, 0) as views, coalesce(v.visitors, 0) as visitors,
           coalesce(n.entries, 0) as entries, coalesce(n.search, 0) as search, coalesce(n.ai, 0) as ai,
           coalesce(n.app, 0) as app, coalesce(n.acted, 0) as acted
    from post_views v full join post_entries n using (path)
  ),
  ai as (select * from pv where source = 'ia')

  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'kpi', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from bpv),
      'pageviews', (select count(*) from bpv),
      'entries', (select count(*) from bsess),
      'search', (select count(*) from bsess where source in ('google', 'buscador')),
      'ai', (select count(*) from bsess where source = 'ia'),
      'app', (select count(*) from bsess where app),
      'saw_event', (select count(*) from bsess where saw_event),
      'acted', (select count(*) from bsess where acted),
      'ai_site', (select count(distinct visitor_id) from ai)
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
                'day', days.day,
                'visitors', (select count(distinct visitor_id) from bpv where (bpv.ts at time zone 'America/Mexico_City')::date = days.day),
                'entries', (select count(*) from bsess where (bsess.t0 at time zone 'America/Mexico_City')::date = days.day)
              ) order by days.day) from days), '[]'),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'n', n) order by n desc)
                         from (select source, count(*) as n from bsess group by 1) s), '[]'),
    'posts', coalesce((select jsonb_agg(to_jsonb(p) order by p.views desc, p.entries desc)
                       from (select * from posts order by views desc, entries desc limit 40) p), '[]'),
    'ai_hosts', coalesce((select jsonb_agg(jsonb_build_object('host', host, 'n', n) order by n desc)
                          from (select coalesce(referrer_host, 'sin dato') as host, count(distinct visitor_id) as n from ai group by 1 order by 2 desc limit 10) s), '[]'),
    'ai_paths', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'n', n) order by n desc)
                          from (select path, count(distinct visitor_id) as n from ai group by 1 order by 2 desc limit 10) s), '[]')
  ) into result;
  return result;
end $$;
revoke execute on function public.admin_blog(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_blog(timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Comportamiento: igual que en 20261013000000_analytics_behavior.sql, con 'blog' en la puerta de entrada
-- ---------------------------------------------------------------------------
create or replace function public.admin_behavior(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;

  with
  e as (select * from analytics_events where ts >= p_from and ts < p_to),
  pv as (select * from e where type = 'pageview'),
  -- región de cada visitante: la última conocida
  vreg as (select distinct on (visitor_id) visitor_id, geo_region from pv order by visitor_id, ts desc),
  explorers as (select distinct visitor_id from pv where path in ('/', '/mapa')),

  -- lo que eligen: data-label="intencion:musica", "vacio:intencion:musica", "cuando:finde", "experiencia:aves"…
  picks as (
    select visitor_id, regexp_replace(props->>'label', '^vacio:', '') as label
    from e where type = 'filter' and props ? 'label'
  ),
  intent_picks as (select distinct visitor_id, split_part(label, ':', 2) as intent from picks where label like 'intencion:%'),
  top_regions as (
    select coalesce(v.geo_region, '?') as region, count(distinct i.visitor_id) as n
    from intent_picks i left join vreg v using (visitor_id) group by 1 order by 2 desc limit 5
  ),

  -- oferta: eventos publicados con fecha en los próximos 30 días
  upcoming as (
    select distinct x.id, x.category, coalesce(p.geom, m.centroid) as pt
    from events x
    join event_occurrences o on o.event_id = x.id
    join municipalities m on m.cvegeo = x.municipality_cvegeo
    left join places p on p.id = x.place_id
    where x.status = 'published' and x.canonical_of is null
      and coalesce(o.ends_at, o.starts_at) >= now() and o.starts_at < now() + interval '30 days'
  ),
  -- demanda por zona: quién eligió ese municipio (o uno a ≤ 20 km por GPS) en el buscador
  zone_demand as (
    select search_cvegeo as cve, count(distinct visitor_id) as searchers
    from e where search_cvegeo is not null group by 1 order by 2 desc limit 15
  ),
  zones as (
    select m.name, m.state, z.searchers,
           (select count(*) from upcoming u where ST_DWithin(u.pt::geography, m.centroid::geography, 30000)) as events,
           (select count(distinct n.visitor_id) from e n where n.type = 'no_results' and n.search_cvegeo = z.cve) as empty
    from zone_demand z join municipalities m on m.cvegeo = z.cve
  ),

  -- eligieron algo y en su zona no había nada
  empties as (
    select visitor_id, search_cvegeo, coalesce(props->>'intent', 'todo') as intent, coalesce(props->>'tab', 'agenda') as tab
    from e where type = 'no_results'
  ),

  -- fuera de cobertura: visitantes a > 20 km de cualquier municipio cargado y búsquedas GPS sin municipio
  out_cities as (
    select geo_city as city, geo_region as region, count(distinct visitor_id) as n
    from pv where geo_cvegeo is null and geo_city is not null and geo_country = 'MX'
    group by 1, 2 order by 3 desc limit 10
  ),
  out_points as (
    select (props->>'out_lat')::numeric as lat, (props->>'out_lng')::numeric as lng, count(distinct visitor_id) as n
    from e where props ? 'out_lat' group by 1, 2 order by 3 desc limit 10
  ),

  -- con cuánta anticipación guardan, marcan "me interesa", arman plan o comparten
  lead as (
    select a.type,
           extract(epoch from greatest(
             (select min(o.starts_at) from event_occurrences o
               where o.event_id = a.event_id and coalesce(o.ends_at, o.starts_at) >= a.ts), a.ts) - a.ts) / 86400 as days
    from e a where a.type in ('save', 'interest', 'plan_create', 'share_whatsapp') and a.event_id is not null
  ),
  lead_b as (
    select case when days < 1 then 0 when days < 3 then 1 when days < 8 then 2 when days < 31 then 3 else 4 end as b, count(*) as n
    from lead where days is not null group by 1
  ),

  -- sesiones: puerta de entrada, páginas, duración, si hicieron algo
  sess as (
    select session_id, min(ts) as t0, max(ts) as t1,
           count(*) filter (where type = 'pageview') as pages,
           bool_or(type in ('call','whatsapp_contact','maps','waze','share_whatsapp','social','website','save','interest','plan_create','plan_join')) as acted,
           (array_agg(path order by ts) filter (where type = 'pageview'))[1] as entry
    from e where session_id is not null group by 1
    having count(*) filter (where type = 'pageview') > 0
  ),
  entry_g as (
    select case
             when entry = '/' then 'explorar' when entry = '/mapa' then 'mapa'
             when entry like '/evento/%' then 'evento' when entry like '/experiencia/%' then 'experiencia'
             when entry like '/municipio/%' then 'municipio' when entry like '/plan/%' then 'plan'
             when entry like '/planes%' or entry like '/guardados%' then 'mis_planes'
             when entry like '/perfil%' then 'perfil' when entry like '/publicar%' then 'publicar'
             when entry ~ '^(/en)?/blog(/|$)' then 'blog'
             else 'otra' end as g, acted
    from sess
  ),
  freq as (
    select visitor_id, count(distinct (ts at time zone 'America/Mexico_City')::date) as days from pv group by 1
  )

  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'kpi', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from pv),
      'explorers', (select count(*) from explorers),
      'pickers', (select count(distinct visitor_id) from intent_picks),
      'empty_visitors', (select count(distinct visitor_id) from empties),
      'sessions', (select count(*) from sess),
      'pages_median', (select percentile_cont(0.5) within group (order by pages) from sess),
      'duration_median_s', (select percentile_cont(0.5) within group (order by extract(epoch from t1 - t0)) from sess where pages > 1),
      'bounce', (select count(*) filter (where pages = 1 and not acted) from sess),
      'acted_sessions', (select count(*) filter (where acted) from sess),
      'out_visitors', (select count(distinct visitor_id) from pv where geo_cvegeo is null and geo_country = 'MX')
    ),
    'intents', coalesce((select jsonb_agg(jsonb_build_object('intent', intent, 'n', n) order by n desc)
                         from (select intent, count(*) as n from intent_picks group by 1) s), '[]'),
    'intent_by_region', coalesce((select jsonb_agg(jsonb_build_object('region', r.region, 'total', r.n, 'intent', s.intent, 'n', s.n))
                                  from top_regions r
                                  join (select coalesce(v.geo_region, '?') as region, i.intent, count(*) as n
                                        from intent_picks i left join vreg v using (visitor_id) group by 1, 2) s using (region)), '[]'),
    'periods', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'n', n) order by n desc)
                         from (select split_part(label, ':', 2) as k, count(distinct visitor_id) as n from picks
                               where label like 'cuando:%' or label like 'rango:%' group by 1) s), '[]'),
    'any_day', (select count(distinct visitor_id) from picks where label = 'vista:cualquier-dia'),
    'experience_kinds', coalesce((select jsonb_agg(jsonb_build_object('kind', k, 'n', n) order by n desc)
                                  from (select split_part(label, ':', 2) as k, count(distinct visitor_id) as n from picks
                                        where label like 'experiencia:%' group by 1) s), '[]'),
    'supply_categories', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'n', n))
                                   from (select category, count(*) as n from upcoming group by 1) s), '[]'),
    'zones', coalesce((select jsonb_agg(to_jsonb(zones) order by searchers desc) from zones), '[]'),
    'empty_intents', coalesce((select jsonb_agg(jsonb_build_object('intent', intent, 'tab', tab, 'n', n) order by n desc)
                               from (select intent, tab, count(distinct visitor_id) as n from empties group by 1, 2) s), '[]'),
    'empty_zones', coalesce((select jsonb_agg(jsonb_build_object('label', m.name, 'state', m.state, 'intent', s.intent, 'n', s.n) order by s.n desc)
                             from (select search_cvegeo, intent, count(distinct visitor_id) as n from empties
                                   where search_cvegeo is not null group by 1, 2 order by 3 desc limit 12) s
                             join municipalities m on m.cvegeo = s.search_cvegeo), '[]'),
    'out_cities', coalesce((select jsonb_agg(to_jsonb(out_cities) order by n desc) from out_cities), '[]'),
    'out_points', coalesce((select jsonb_agg(to_jsonb(out_points) order by n desc) from out_points), '[]'),
    'lead_time', coalesce((select jsonb_agg(jsonb_build_object('bucket', b, 'n', n) order by b) from lead_b), '[]'),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('entry', g, 'sessions', n, 'acted', a) order by n desc)
                         from (select g, count(*) as n, count(*) filter (where acted) as a from entry_g group by 1) s), '[]'),
    'frequency', coalesce((select jsonb_agg(jsonb_build_object('bucket', b, 'n', n) order by b)
                           from (select case when days = 1 then 0 when days <= 3 then 1 when days <= 7 then 2 else 3 end as b, count(*) as n
                                 from freq group by 1) s), '[]'),
    'actions', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'n', n, 'visitors', v) order by n desc)
                         from (select type, count(*) as n, count(distinct visitor_id) as v from e
                               where type not in ('pageview','unsave','uninterest','filter','search','no_results','login_start')
                               group by 1) s), '[]'),
    'heatmap', coalesce((select jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'n', n))
                         from (select extract(isodow from t0 at time zone 'America/Mexico_City')::int as dow,
                                      extract(hour from t0 at time zone 'America/Mexico_City')::int as hour, count(*) as n
                               from sess group by 1, 2) s), '[]')
  ) into result;
  return result;
end $$;
revoke execute on function public.admin_behavior(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_behavior(timestamptz, timestamptz) to authenticated, service_role;
