-- Cuentas de público (Google): guardados (privados) e interés en asistir (público solo como conteo).

create table public.saved_events (
  user_id     uuid not null references auth.users (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table public.event_interests (
  user_id     uuid not null references auth.users (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index event_interests_event_idx on public.event_interests (event_id);

-- RLS: cada quien ve y modifica solo sus filas; nadie puede listar quién está interesado.
alter table public.saved_events    enable row level security;
alter table public.event_interests enable row level security;

create policy "own saved select" on public.saved_events for select using (user_id = auth.uid());
create policy "own saved insert" on public.saved_events for insert with check (user_id = auth.uid());
create policy "own saved delete" on public.saved_events for delete using (user_id = auth.uid());

create policy "own interest select" on public.event_interests for select using (user_id = auth.uid());
create policy "own interest insert" on public.event_interests for insert with check (user_id = auth.uid());
create policy "own interest delete" on public.event_interests for delete using (user_id = auth.uid());

-- Los default privileges dan select a anon; aquí no tiene nada que hacer.
revoke all on public.saved_events, public.event_interests from anon;
grant select, insert, delete on public.saved_events, public.event_interests to authenticated;
grant all on public.saved_events, public.event_interests to service_role;

-- Conteo público de interesados (solo números, sin usuarios)
create or replace function public.interest_counts(event_ids uuid[])
returns table (event_id uuid, n integer)
language sql stable security definer set search_path = public as $$
  select i.event_id, count(*)::int
  from public.event_interests i
  where i.event_id = any (event_ids)
  group by i.event_id
$$;

grant execute on function public.interest_counts(uuid[]) to anon, authenticated, service_role;
