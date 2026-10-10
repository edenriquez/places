-- El mapa de planes: los grupos abiertos que armó la comunidad cerca de un punto. A diferencia de open_plans_near
-- (Mis planes), también lo ven visitantes sin cuenta (sin nombres ni fotos) e incluye los planes donde ya estás.

/** Radio en metros (0 = toda la región). Los llenos solo salen si ya estás en ellos. */
create function public.community_plans_near(p_lat double precision, p_lng double precision, p_radius_m integer default 40000, p_limit integer default 40)
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
    where p.is_open and plan_is_upcoming(p)
      and coalesce(e.status, x.status) = 'published'
      and ((select count(*) from plan_members c where c.plan_id = p.id) < p.max_people
           or exists (select 1 from plan_members c where c.plan_id = p.id and c.user_id = auth.uid()))
      and (p_radius_m <= 0 or ST_DWithin(coalesce(x.geom, xp.geom, ep.geom, m.centroid)::geography, pt.g, p_radius_m))
    order by p.starts_at
    limit least(greatest(p_limit, 1), 80)
  )
  select coalesce(jsonb_agg(plan_card(c.id, auth.uid(), auth.uid() is not null) || jsonb_build_object('interested', c.interested)
                            order by c.starts_at), '[]'::jsonb)
  from cand c
$$;

revoke execute on function public.community_plans_near(double precision, double precision, integer, integer) from public;
grant execute on function public.community_plans_near(double precision, double precision, integer, integer) to anon, authenticated, service_role;
