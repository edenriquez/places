-- Eventos generados desde el calendario anual (Capa 1): un evento por fiesta y año, sin duplicados.
alter table public.events
  add column festivity_id uuid references public.festivities (id) on delete set null,
  add column festivity_year integer;

create unique index events_festivity_year_uniq
  on public.events (festivity_id, festivity_year) where festivity_id is not null;
