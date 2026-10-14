-- crear_evento (MCP) ya no depende de que el asistente llame buscar_duplicados: el servidor revisa antes de insertar.
--   1) mcp_existing_event: evento pendiente o publicado con título parecido, en el mismo municipio o uno a ≤ 15 km,
--      con alguna fecha a ±1 día (o el mismo post de origen con título algo parecido) → se devuelve ese y no se crea otro.
--   2) raw_ingestions.dedup_key único: dos llamadas casi simultáneas (el asistente reintenta mientras la primera sigue
--      en curso) chocan en la base aunque la revisión de arriba no haya visto todavía el primer evento.

alter table public.raw_ingestions add column dedup_key text;
-- las ingestas fallidas, rechazadas o marcadas como duplicado no bloquean volver a crear
create unique index raw_ingestions_dedup_key_uniq on public.raw_ingestions (dedup_key)
  where dedup_key is not null and status not in ('failed', 'rejected', 'duplicate');

create or replace function public.mcp_existing_event(p_title text, p_municipality text, p_dates date[], p_origin_url text default null)
returns table (id uuid, slug text, title text, status text, municipality text, starts_at timestamptz, similarity real, reason text)
language sql stable security invoker set search_path = public, extensions as $$
  with here as (select centroid from municipalities where cvegeo = p_municipality),
  candidates as (
    select e.id, e.slug, e.title, e.status, m.name as municipality,
           min(o.starts_at) as starts_at,
           similarity(public.unaccent(lower(e.title)), public.unaccent(lower(p_title))) as sim,
           bool_or(r.origin_url is not null and r.origin_url = p_origin_url) as same_origin
    from events e
    join event_occurrences o on o.event_id = e.id
    join municipalities m on m.cvegeo = e.municipality_cvegeo
    left join raw_ingestions r on r.id = e.raw_ingestion_id
    where public.is_admin()
      and e.status in ('pending', 'published')
      and e.canonical_of is null
      and (e.municipality_cvegeo = p_municipality
           or ST_DWithin(m.centroid::geography, (select centroid from here)::geography, 15000))
      and exists (select 1 from unnest(p_dates) d where o.starts_at::date between d - 1 and d + 1)
    group by e.id, e.slug, e.title, e.status, m.name
  )
  select id, slug, title, status, municipality, starts_at, sim,
         case when sim >= 0.45 then 'mismo título, lugar y fecha' else 'mismo post de origen' end
  from candidates
  -- un post puede anunciar varios eventos: el mismo origen solo cuenta con un título algo parecido
  where sim >= 0.45 or (same_origin and sim >= 0.25)
  order by sim desc
  limit 1
$$;
revoke execute on function public.mcp_existing_event(text, text, date[], text) from public, anon;
grant execute on function public.mcp_existing_event(text, text, date[], text) to authenticated;

-- buscar_duplicados: también municipios vecinos (≤ 15 km), no solo el mismo cvegeo
create or replace function public.mcp_find_duplicates(title text, municipality text, first_date date)
returns table (id uuid, slug text, title text, status text, starts_at timestamptz, similarity real)
language sql stable security invoker set search_path = public, extensions as $$
  select distinct on (e.id) e.id, e.slug, e.title, e.status, o.starts_at,
         similarity(public.unaccent(lower(e.title)), public.unaccent(lower(mcp_find_duplicates.title)))
  from public.events e
  join public.event_occurrences o on o.event_id = e.id
  join public.municipalities m on m.cvegeo = e.municipality_cvegeo
  where public.is_admin()
    and e.status in ('pending', 'published')
    and (e.municipality_cvegeo = municipality
         or ST_DWithin(m.centroid::geography,
                       (select x.centroid from public.municipalities x where x.cvegeo = municipality)::geography, 15000))
    and o.starts_at::date between first_date - 1 and first_date + 1
    and similarity(public.unaccent(lower(e.title)), public.unaccent(lower(mcp_find_duplicates.title))) >= 0.3
  order by e.id, o.starts_at
$$;
