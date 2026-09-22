-- Privilegios explícitos. La CLI de Supabase reciente ya no otorga SELECT/INSERT/UPDATE/DELETE
-- automáticamente a anon/authenticated/service_role sobre tablas nuevas; RLS sigue mandando.

grant usage on schema public to anon, authenticated, service_role;

-- Lectura pública (RLS limita a lo publicado/activo)
grant select on
  public.municipalities, public.places, public.organizations, public.events,
  public.event_occurrences, public.festivities,
  public.municipalities_view, public.places_view, public.event_points_view
to anon, authenticated;

-- Admin autenticado (RLS exige is_admin() para escribir y para ver fuentes/ingestas)
grant select, insert, update, delete on
  public.municipalities, public.places, public.organizations, public.events,
  public.event_occurrences, public.festivities, public.sources, public.raw_ingestions,
  public.admin_users
to authenticated;

-- El job local y los scripts usan service_role (bypass RLS)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Funciones
grant execute on function public.events_near(double precision, double precision, integer, timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.events_live_near(double precision, double precision, integer, timestamptz) to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.slugify(text) to anon, authenticated, service_role;

-- Tablas futuras
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
