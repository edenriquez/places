-- Limpieza de la analítica: lo que no es público sale de analytics_events a analytics_events_excluded (no se borra:
-- se puede devolver con un insert … select). De aquí en adelante /api/t ya no lo escribe:
--   · equipo: cookie el_staff (proxy en /admin) o cuenta admin
--   · automatización: navigator.webdriver (prueba de rendimiento del CI, scrapers)
-- Además, el regreso del login con Google ya no cuenta como llegada desde Google.

create table public.analytics_events_excluded (
  like public.analytics_events including defaults,
  excluded_reason text not null,
  excluded_at     timestamptz not null default now()
);
alter table public.analytics_events_excluded alter column id drop default;
alter table public.analytics_events_excluded add primary key (id);
alter table public.analytics_events_excluded enable row level security;
create policy "admin read excluded analytics" on public.analytics_events_excluded for select using (public.is_admin());
revoke all on public.analytics_events_excluded from anon, authenticated;
grant select on public.analytics_events_excluded to authenticated;
grant all on public.analytics_events_excluded to service_role;

-- equipo: eventos con cuenta admin y todo lo de los navegadores atados a una cuenta admin
with staff_visitors as (
  select vu.visitor_id from visitor_users vu join admin_users a using (user_id)
  union
  select distinct visitor_id from analytics_events ev join admin_users a on a.user_id = ev.user_id
),
moved as (
  delete from analytics_events ev
  where ev.user_id in (select user_id from admin_users) or ev.visitor_id in (select visitor_id from staff_visitors)
  returning ev.*
)
insert into analytics_events_excluded select moved.*, 'equipo' from moved;

-- automatización sin huella: navegadores que nunca aparecieron en México y solo cargaron páginas, sin tocar nada
-- (centros de datos en Virginia, Iowa, Arizona, Ámsterdam…: la prueba del CI, previews y rastreadores)
with bots as (
  select visitor_id from analytics_events
  group by visitor_id
  having bool_and(type = 'pageview') and not bool_or(geo_country = 'MX')
),
moved as (
  delete from analytics_events ev where ev.visitor_id in (select visitor_id from bots)
  returning ev.*
)
insert into analytics_events_excluded select moved.*, 'automatizado' from moved;

-- el regreso de accounts.google.com / *.supabase.co es la misma visita
update analytics_events set source = 'interno'
where source = 'google' and referrer_host ~ '^accounts\.google\.[a-z.]+$|(^|\.)supabase\.co$';

-- y la fuente de llegada de cada cuenta se recalcula con eso
update visitor_users vu set first_source = f.source
from (
  select distinct on (visitor_id) visitor_id, source from analytics_events
  where type = 'pageview' order by visitor_id, ts
) f
where f.visitor_id = vu.visitor_id and vu.first_source is distinct from f.source;
