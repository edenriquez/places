-- Fotos extra del evento (después del flyer principal, que sigue siendo la portada de las tarjetas).
-- En la página del evento se ven como carrusel.
alter table public.events
  add column gallery_paths text[] not null default '{}'
    check (cardinality(gallery_paths) <= 9);
