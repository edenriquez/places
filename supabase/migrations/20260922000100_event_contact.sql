-- Contacto por evento (lo que trae el flyer). Teléfono en dígitos, 10 para México; redes como URL completa.
alter table public.events
  add column contact_phone text,
  add column contact_whatsapp boolean not null default true,
  add column instagram_url text,
  add column facebook_url text,
  add column tiktok_url text,
  add column website_url text;
