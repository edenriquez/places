-- Planes en grupo: ir a un evento (una de sus fechas) o a una experiencia (el día que elijas) con más gente.
-- Un plan tiene anfitrión y miembros. Privado: solo entra quien tiene el link (conocidos). Abierto: además lo
-- ven y se pueden sumar las personas cerca o interesadas en el mismo evento. Al unirte, el plan aparece en
-- "Mis planes" y en el calendario de todos los que van.
--
-- Las tablas no se exponen: todo pasa por funciones security definer que deciden qué ve cada quien. De las
-- personas solo sale el primer nombre y la foto de su cuenta de Google.

create table public.plans (
  id             uuid primary key default gen_random_uuid(),
  host_id        uuid not null references auth.users (id) on delete cascade,
  event_id       uuid references public.events (id) on delete cascade,
  occurrence_id  uuid references public.event_occurrences (id) on delete cascade,
  experience_id  uuid references public.experiences (id) on delete cascade,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  is_all_day     boolean not null default false,
  is_open        boolean not null default false,
  max_people     smallint not null default 8 check (max_people between 2 and 30),
  meeting_point  text check (char_length(meeting_point) <= 140),
  note           text check (char_length(note) <= 280),
  invite_code    text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  status         text not null default 'active' check (status in ('active','cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (
    (event_id is not null and occurrence_id is not null and experience_id is null)
    or (experience_id is not null and event_id is null and occurrence_id is null)
  )
);
create index plans_event_idx on public.plans (event_id) where event_id is not null;
create index plans_experience_idx on public.plans (experience_id) where experience_id is not null;
create index plans_open_idx on public.plans (starts_at) where is_open and status = 'active';
create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

create table public.plan_members (
  plan_id    uuid not null references public.plans (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  via        text not null default 'link' check (via in ('host','link','open')),
  joined_at  timestamptz not null default now(),
  primary key (plan_id, user_id)
);
create index plan_members_user_idx on public.plan_members (user_id);

-- Calendario suscrito (webcal): un token secreto por persona; el calendario se actualiza solo cuando
-- alguien se une, sale o el anfitrión cancela.
create table public.calendar_feeds (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  token      text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now()
);

alter table public.plans          enable row level security;
alter table public.plan_members   enable row level security;
alter table public.calendar_feeds enable row level security;
revoke all on public.plans, public.plan_members, public.calendar_feeds from anon, authenticated;
grant all on public.plans, public.plan_members, public.calendar_feeds to service_role;

-- ---------------------------------------------------------------------------
-- Piezas internas
-- ---------------------------------------------------------------------------

create function public.plan_person(p_user uuid)
returns jsonb language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'id', u.id,
    'name', coalesce(nullif(split_part(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), ' ', 1), ''), 'Alguien'),
    'avatar', coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'))
  from auth.users u where u.id = p_user
$$;

/** Todo lo que pinta la web de un plan. `p_reveal`: mostrar nombres y fotos (no a visitantes sin cuenta en listados). */
create function public.plan_card(p_id uuid, p_viewer uuid, p_reveal boolean)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'id', p.id,
    'code', case when me.user_id is not null then p.invite_code end,
    'role', case when p.host_id = p_viewer then 'host' when me.user_id is not null then 'member' end,
    'starts_at', p.starts_at,
    'ends_at', p.ends_at,
    'is_all_day', p.is_all_day,
    'is_open', p.is_open,
    'max_people', p.max_people,
    'meeting_point', p.meeting_point,
    'note', p.note,
    'status', p.status,
    'going', (select count(*) from plan_members c where c.plan_id = p.id),
    'host', case when p_reveal then plan_person(p.host_id) end,
    'people', case when p_reveal then coalesce((
        select jsonb_agg(plan_person(c.user_id) order by c.via = 'host' desc, c.joined_at)
        from plan_members c where c.plan_id = p.id), '[]'::jsonb)
      else '[]'::jsonb end,
    'target', case
      when p.event_id is not null then (
        select jsonb_build_object(
          'kind', 'event', 'id', e.id, 'slug', e.slug, 'title', e.title,
          'image_path', e.image_path, 'image_focus_x', e.image_focus_x, 'image_focus_y', e.image_focus_y,
          'place_name', coalesce(pl.name, e.place_text), 'municipality_name', m.name,
          'lat', ST_Y(coalesce(pl.geom, m.centroid)), 'lng', ST_X(coalesce(pl.geom, m.centroid)))
        from events e
        join municipalities m on m.cvegeo = e.municipality_cvegeo
        left join places pl on pl.id = e.place_id
        where e.id = p.event_id)
      else (
        select jsonb_build_object(
          'kind', 'experience', 'id', x.id, 'slug', x.slug, 'title', x.title,
          'image_path', x.image_path, 'image_focus_x', x.image_focus_x, 'image_focus_y', x.image_focus_y,
          'place_name', coalesce(pl.name, x.place_text), 'municipality_name', m.name,
          'lat', ST_Y(coalesce(x.geom, pl.geom, m.centroid)), 'lng', ST_X(coalesce(x.geom, pl.geom, m.centroid)))
        from experiences x
        join municipalities m on m.cvegeo = x.municipality_cvegeo
        left join places pl on pl.id = x.place_id
        where x.id = p.experience_id)
      end)
  from plans p
  left join plan_members me on me.plan_id = p.id and me.user_id = p_viewer
  where p.id = p_id
$$;

/** Un plan sigue vigente mientras no termine (o, sin hora de fin, hasta 6 h después de empezar). */
create function public.plan_is_upcoming(p public.plans)
returns boolean language sql stable as $$
  select p.status = 'active'
     and coalesce(p.ends_at, p.starts_at + case when p.is_all_day then interval '1 day' else interval '6 hours' end) >= now()
$$;

revoke execute on function public.plan_person(uuid) from public, anon, authenticated;
revoke execute on function public.plan_card(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.plan_is_upcoming(public.plans) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- API
-- ---------------------------------------------------------------------------

/**
 * Arma un plan: para un evento se elige una de sus fechas (p_occurrence); para una experiencia, día y hora
 * (p_experience + p_starts_at). Quien lo arma queda dentro y, si es un evento, marcado con "Me interesa".
 */
create function public.create_plan(
  p_occurrence    uuid default null,
  p_experience    uuid default null,
  p_starts_at     timestamptz default null,
  p_is_all_day    boolean default false,
  p_is_open       boolean default false,
  p_max_people    integer default 8,
  p_meeting_point text default null,
  p_note          text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  uid   uuid := auth.uid();
  occ   record;
  new_p public.plans;
begin
  if uid is null then raise exception 'Necesitas entrar para armar un plan' using errcode = '28000'; end if;
  if (p_occurrence is null) = (p_experience is null) then
    raise exception 'Elige un evento o una experiencia' using errcode = '22023';
  end if;
  if (select count(*) from plans p where p.host_id = uid and plan_is_upcoming(p)) >= 20 then
    raise exception 'Ya tienes muchos planes armados; cancela alguno antes' using errcode = 'P0001';
  end if;

  if p_occurrence is not null then
    select o.id, o.event_id, o.starts_at, o.ends_at, o.is_all_day into occ
    from event_occurrences o join events e on e.id = o.event_id
    where o.id = p_occurrence and e.status = 'published'
      and coalesce(o.ends_at, o.starts_at + interval '6 hours') >= now();
    if occ.id is null then raise exception 'Esa fecha ya pasó o el evento no está disponible' using errcode = '22023'; end if;
    insert into plans (host_id, event_id, occurrence_id, starts_at, ends_at, is_all_day, is_open, max_people, meeting_point, note)
    values (uid, occ.event_id, occ.id, occ.starts_at, occ.ends_at, occ.is_all_day, p_is_open,
            least(greatest(coalesce(p_max_people, 8), 2), 30), nullif(trim(p_meeting_point), ''), nullif(trim(p_note), ''))
    returning * into new_p;
    insert into event_interests (user_id, event_id) values (uid, occ.event_id) on conflict do nothing;
  else
    if not exists (select 1 from experiences x where x.id = p_experience and x.status = 'published'
                   and (x.valid_until is null or x.valid_until >= current_date)) then
      raise exception 'La experiencia no está disponible' using errcode = '22023';
    end if;
    if p_starts_at is null or p_starts_at < now() - interval '1 hour' or p_starts_at > now() + interval '180 days' then
      raise exception 'Elige un día dentro de los próximos 6 meses' using errcode = '22023';
    end if;
    insert into plans (host_id, experience_id, starts_at, is_all_day, is_open, max_people, meeting_point, note)
    values (uid, p_experience, p_starts_at, coalesce(p_is_all_day, false), p_is_open,
            least(greatest(coalesce(p_max_people, 8), 2), 30), nullif(trim(p_meeting_point), ''), nullif(trim(p_note), ''))
    returning * into new_p;
  end if;

  insert into plan_members (plan_id, user_id, via) values (new_p.id, uid, 'host');
  return plan_card(new_p.id, uid, true);
end $$;

/** Unirse con el link de invitación (p_code) o, si el plan es abierto, desde la lista (p_plan). */
create function public.join_plan(p_plan uuid default null, p_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p   public.plans;
begin
  if uid is null then raise exception 'Necesitas entrar para unirte' using errcode = '28000'; end if;
  if p_code is not null then
    select * into p from plans where invite_code = p_code;
  else
    select * into p from plans where id = p_plan and is_open;
  end if;
  if p.id is null then raise exception 'No encontramos ese plan' using errcode = 'P0002'; end if;
  if exists (select 1 from plan_members where plan_id = p.id and user_id = uid) then
    return plan_card(p.id, uid, true);
  end if;
  if not plan_is_upcoming(p) then raise exception 'Este plan ya pasó o se canceló' using errcode = 'P0001'; end if;
  if (select count(*) from plan_members where plan_id = p.id) >= p.max_people then
    raise exception 'Este plan ya está lleno' using errcode = 'P0001';
  end if;

  insert into plan_members (plan_id, user_id, via) values (p.id, uid, case when p_code is not null then 'link' else 'open' end);
  if p.event_id is not null then
    insert into event_interests (user_id, event_id) values (uid, p.event_id) on conflict do nothing;
  end if;
  return plan_card(p.id, uid, true);
end $$;

/** Salir. Si sale el anfitrión, el plan pasa a quien se unió primero; si no queda nadie, se cancela. */
create function public.leave_plan(p_plan uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  p    public.plans;
  heir uuid;
begin
  select * into p from plans where id = p_plan;
  if p.id is null or not exists (select 1 from plan_members where plan_id = p.id and user_id = uid) then
    raise exception 'No estás en este plan' using errcode = 'P0002';
  end if;
  delete from plan_members where plan_id = p.id and user_id = uid;
  if p.host_id = uid then
    select user_id into heir from plan_members where plan_id = p.id order by joined_at limit 1;
    if heir is null then
      update plans set status = 'cancelled' where id = p.id;
    else
      update plans set host_id = heir where id = p.id;
      update plan_members set via = 'host' where plan_id = p.id and user_id = heir;
    end if;
  end if;
end $$;

/** El anfitrión cambia si el plan es abierto, el cupo, el punto de encuentro o la nota. */
create function public.update_plan(
  p_plan          uuid,
  p_is_open       boolean default null,
  p_max_people    integer default null,
  p_meeting_point text default null,
  p_note          text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  update plans set
    is_open       = coalesce(p_is_open, is_open),
    max_people    = case when p_max_people is null then max_people
                         else least(greatest(p_max_people, (select count(*) from plan_members where plan_id = p_plan)::int, 2), 30) end,
    meeting_point = case when p_meeting_point is null then meeting_point else nullif(trim(p_meeting_point), '') end,
    note          = case when p_note is null then note else nullif(trim(p_note), '') end
  where id = p_plan and host_id = uid and status = 'active';
  if not found then raise exception 'Solo quien armó el plan puede cambiarlo' using errcode = '42501'; end if;
  return plan_card(p_plan, uid, true);
end $$;

/** El anfitrión saca a alguien de un plan (útil en planes abiertos). */
create function public.remove_from_plan(p_plan uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from plans where id = p_plan and host_id = auth.uid()) or p_user = auth.uid() then
    raise exception 'Solo quien armó el plan puede sacar a alguien' using errcode = '42501';
  end if;
  delete from plan_members where plan_id = p_plan and user_id = p_user;
end $$;

/** Mis planes en grupo: los vigentes y los de los últimos 30 días. */
create function public.my_plans()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(plan_card(p.id, auth.uid(), true) order by p.starts_at), '[]'::jsonb)
  from plans p join plan_members m on m.plan_id = p.id and m.user_id = auth.uid()
  where p.status = 'active' and p.starts_at >= now() - interval '30 days'
$$;

/** La invitación: quien tiene el link ve el plan completo, con o sin cuenta. */
create function public.plan_by_code(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select plan_card(p.id, auth.uid(), true) || jsonb_build_object('code', p.invite_code)
  from plans p where p.invite_code = p_code
$$;

/**
 * Planes abiertos cerca (radio en metros; 0 = toda la región) a los que la persona se puede sumar: primero
 * los de eventos que le interesan. `interested`: le interesa ese evento.
 */
create function public.open_plans_near(p_lat double precision, p_lng double precision, p_radius_m integer default 40000, p_limit integer default 12)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  with pt as (select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography g),
  cand as (
    select p.id, p.starts_at,
           exists (select 1 from event_interests i where i.user_id = auth.uid() and i.event_id = p.event_id) as interested
    from plans p
    left join events e on e.id = p.event_id
    left join places ep on ep.id = e.place_id
    left join experiences x on x.id = p.experience_id
    left join places xp on xp.id = x.place_id
    join municipalities m on m.cvegeo = coalesce(e.municipality_cvegeo, x.municipality_cvegeo)
    cross join pt
    where auth.uid() is not null
      and p.is_open and plan_is_upcoming(p)
      and coalesce(e.status, x.status) = 'published'
      and not exists (select 1 from plan_members c where c.plan_id = p.id and c.user_id = auth.uid())
      and (select count(*) from plan_members c where c.plan_id = p.id) < p.max_people
      and (p_radius_m <= 0 or ST_DWithin(coalesce(x.geom, xp.geom, ep.geom, m.centroid)::geography, pt.g, p_radius_m))
    order by 3 desc, p.starts_at
    limit least(greatest(p_limit, 1), 50)
  )
  select coalesce(jsonb_agg(plan_card(c.id, auth.uid(), true) || jsonb_build_object('interested', c.interested)
                            order by c.interested desc, c.starts_at), '[]'::jsonb)
  from cand c
$$;

/** En el detalle de un evento o experiencia: los planes abiertos y los míos (aunque sean privados). */
create function public.plans_for(p_event uuid default null, p_experience uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(plan_card(p.id, auth.uid(), auth.uid() is not null) order by mine desc, p.starts_at), '[]'::jsonb)
  from (
    select p.*, exists (select 1 from plan_members c where c.plan_id = p.id and c.user_id = auth.uid()) as mine
    from plans p
    where (p.event_id = p_event or p.experience_id = p_experience) and plan_is_upcoming(p)
  ) p
  where p.mine or (p.is_open and (select count(*) from plan_members c where c.plan_id = p.id) < p.max_people)
$$;

/** Token del calendario suscrito de quien pregunta (se crea la primera vez). */
create function public.my_calendar_token()
returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'Necesitas entrar' using errcode = '28000'; end if;
  insert into calendar_feeds (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select token into t from calendar_feeds where user_id = auth.uid();
  return t;
end $$;

/** El calendario suscrito: sus planes en grupo y los eventos que marcó con "Me interesa" (próxima fecha). */
create function public.plans_feed(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  with u as (select user_id from calendar_feeds where token = p_token)
  select jsonb_build_object(
    'me', u.user_id,
    'plans', coalesce((
      select jsonb_agg(plan_card(p.id, u.user_id, true) order by p.starts_at)
      from u join plan_members m on m.user_id = u.user_id join plans p on p.id = m.plan_id
      where p.status = 'active' and p.starts_at >= now() - interval '30 days'), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.starts_at)
      from u cross join lateral (
        select distinct on (v.event_id) v.event_id, v.occurrence_id, v.slug, v.title, v.starts_at, v.ends_at, v.is_all_day,
               v.place_name, v.municipality_name
        from event_interests i join event_points_view v on v.event_id = i.event_id
        where i.user_id = u.user_id and coalesce(v.ends_at, v.starts_at) >= now() - interval '1 day'
          and not exists (select 1 from plan_members m join plans p on p.id = m.plan_id
                          where m.user_id = u.user_id and p.event_id = v.event_id and p.status = 'active')
        order by v.event_id, v.starts_at
      ) n), '[]'::jsonb)
  )
  from u
$$;

revoke execute on function public.create_plan(uuid, uuid, timestamptz, boolean, boolean, integer, text, text) from public, anon;
revoke execute on function public.join_plan(uuid, text) from public, anon;
revoke execute on function public.leave_plan(uuid) from public, anon;
revoke execute on function public.update_plan(uuid, boolean, integer, text, text) from public, anon;
revoke execute on function public.remove_from_plan(uuid, uuid) from public, anon;
revoke execute on function public.my_plans() from public, anon;
revoke execute on function public.open_plans_near(double precision, double precision, integer, integer) from public, anon;
revoke execute on function public.my_calendar_token() from public, anon;
grant execute on function public.create_plan(uuid, uuid, timestamptz, boolean, boolean, integer, text, text) to authenticated, service_role;
grant execute on function public.join_plan(uuid, text) to authenticated, service_role;
grant execute on function public.leave_plan(uuid) to authenticated, service_role;
grant execute on function public.update_plan(uuid, boolean, integer, text, text) to authenticated, service_role;
grant execute on function public.remove_from_plan(uuid, uuid) to authenticated, service_role;
grant execute on function public.my_plans() to authenticated, service_role;
grant execute on function public.open_plans_near(double precision, double precision, integer, integer) to authenticated, service_role;
grant execute on function public.my_calendar_token() to authenticated, service_role;
grant execute on function public.plan_by_code(text) to anon, authenticated, service_role;
grant execute on function public.plans_for(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.plans_feed(text) to anon, authenticated, service_role;

-- analítica: armar, unirse e invitar
alter table public.analytics_events drop constraint analytics_events_type_check;
alter table public.analytics_events add constraint analytics_events_type_check check (type in (
  'pageview','share_whatsapp','call','whatsapp_contact','maps','waze','social','website',
  'flyer_zoom','save','unsave','interest','uninterest','login_start','search','filter',
  'plan_create','plan_join','plan_invite'));
