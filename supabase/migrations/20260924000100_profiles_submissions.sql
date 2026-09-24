-- Perfil del público (preferencias declaradas) y envíos de organizadores desde /publicar.

-- ---------------------------------------------------------------------------
-- Preferencias: qué le gusta, con quién sale y su pueblo. Sirven para recomendar
-- y para entender a la audiencia (todo opcional, lo edita la persona).
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  home_municipality  text references public.municipalities (cvegeo),
  categories         text[] not null default '{}',
  companions         text[] not null default '{}' check (companions <@ array['sola','pareja','amigos','familia','peques']),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (user_id = auth.uid());
create policy "own profile insert" on public.profiles for insert with check (user_id = auth.uid());
create policy "own profile update" on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- ---------------------------------------------------------------------------
-- Envíos: el flyer va a flyers/submissions/<uid>/… y entra a la misma cola que el
-- admin (raw_ingestions, status queued) con la descripción como texto del post.
-- ---------------------------------------------------------------------------
create policy "users upload submissions" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'flyers'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  );

-- cada quien ve el estado de lo que envió
create policy "own submissions select" on public.raw_ingestions for select to authenticated
  using (uploaded_by = auth.uid());

create or replace function public.submit_flyer(
  p_media_path   text,
  p_media_sha256 text,
  p_description  text,
  p_municipality text default null,
  p_organizer    text default null,
  p_contact      text default null,
  p_link         text default null,
  p_filename     text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  src    uuid;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Necesitas entrar para publicar' using errcode = '28000';
  end if;
  if p_media_path is null or p_media_path not like 'submissions/' || uid::text || '/%' then
    raise exception 'Ruta de flyer inválida' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_description, ''))) < 20 then
    raise exception 'Cuéntanos un poco más del evento' using errcode = '22023';
  end if;
  if (select count(*) from raw_ingestions where uploaded_by = uid and received_at > now() - interval '1 day') >= 10 then
    raise exception 'Llegaste al límite de envíos por hoy' using errcode = 'P0001';
  end if;

  select id into src from sources where kind = 'public_form' and name = 'publicar-web';
  if src is null then
    insert into sources (name, kind, trust_score) values ('publicar-web', 'public_form', 0.40) returning id into src;
  end if;

  insert into raw_ingestions (source_id, status, media_path, media_sha256, origin_url, uploaded_by,
                              municipality_hint, organizer_hint, payload)
  values (src, 'queued', p_media_path, p_media_sha256, nullif(trim(p_link), ''), uid,
          nullif(p_municipality, ''), nullif(trim(p_organizer), ''),
          jsonb_build_object(
            'text', left(trim(p_description), 4000),
            'filename', p_filename,
            'contact', nullif(trim(p_contact), ''),
            'submitted_via', 'publicar'))
  returning id into new_id;
  return new_id;
end $$;

revoke execute on function public.submit_flyer(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_flyer(text, text, text, text, text, text, text, text) to authenticated, service_role;
