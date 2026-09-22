-- Fuentes de ejemplo para el corredor (el job local las scrapea). Los lugares y municipios
-- los carga `places-ingest seed`.
insert into public.sources (name, kind, url, municipality_cvegeo, interval_hours, trust_score, config)
values
  ('Ayuntamiento de Tlayacapan', 'facebook_page', 'https://www.facebook.com/AyuntamientoTlayacapan', '17026', 24, 0.85, '{"scrolls": 6}'),
  ('Ayuntamiento de Tepoztlán', 'facebook_page', 'https://www.facebook.com/GobiernoTepoztlan', '17020', 24, 0.85, '{"scrolls": 6}'),
  ('Casa de Cultura Malinalco', 'facebook_page', 'https://www.facebook.com/CasaDeCulturaMalinalco', '15052', 24, 0.8, '{"scrolls": 5}'),
  ('Secretaría de Turismo y Cultura de Morelos', 'website', 'https://turismoycultura.morelos.gob.mx/', null, 24, 0.9, '{"item_selector": "article", "image_selector": "img", "link_selector": "a"}')
on conflict do nothing;
