-- Búsquedas para el servidor MCP (/api/mcp): ChatGPT elige municipio y lugar reales y revisa duplicados
-- antes de crear un evento. Mismos umbrales y lógica que places_ingest/matching.py. Solo admins.

create or replace function public.mcp_search_municipalities(q text, max_results int default 5)
returns table (cvegeo text, name text, state text, similarity real)
language sql stable security invoker set search_path = public, extensions as $$
  select m.cvegeo, m.name, m.state, similarity(public.unaccent(lower(m.name)), public.unaccent(lower(q)))
  from public.municipalities m
  where public.is_admin() and m.is_active
  order by 4 desc
  limit least(max_results, 20)
$$;

create or replace function public.mcp_search_places(municipality text, q text, max_results int default 5)
returns table (id uuid, name text, kind text, address text, similarity real)
language sql stable security invoker set search_path = public, extensions as $$
  -- word_similarity: "ilhuicalli" encuentra "Auditorio Ilhuicalli (La Casa de la Festividad)"
  select p.id, p.name, p.kind, p.address,
         greatest(similarity(public.unaccent(lower(p.name)), public.unaccent(lower(q))),
                  word_similarity(public.unaccent(lower(q)), public.unaccent(lower(p.name))))
  from public.places p
  where public.is_admin() and p.municipality_cvegeo = municipality and p.is_active
  order by 5 desc
  limit least(max_results, 20)
$$;

create or replace function public.mcp_find_duplicates(title text, municipality text, first_date date)
returns table (id uuid, slug text, title text, status text, starts_at timestamptz, similarity real)
language sql stable security invoker set search_path = public, extensions as $$
  select distinct on (e.id) e.id, e.slug, e.title, e.status, o.starts_at,
         similarity(public.unaccent(lower(e.title)), public.unaccent(lower(mcp_find_duplicates.title)))
  from public.events e
  join public.event_occurrences o on o.event_id = e.id
  where public.is_admin()
    and e.municipality_cvegeo = municipality
    and e.status in ('pending', 'published')
    and o.starts_at::date between first_date - 1 and first_date + 1
    and similarity(public.unaccent(lower(e.title)), public.unaccent(lower(mcp_find_duplicates.title))) >= 0.3
  order by e.id, o.starts_at
$$;

revoke execute on function public.mcp_search_municipalities(text, int) from public, anon;
revoke execute on function public.mcp_search_places(text, text, int) from public, anon;
revoke execute on function public.mcp_find_duplicates(text, text, date) from public, anon;
grant execute on function public.mcp_search_municipalities(text, int) to authenticated;
grant execute on function public.mcp_search_places(text, text, int) to authenticated;
grant execute on function public.mcp_find_duplicates(text, text, date) to authenticated;
