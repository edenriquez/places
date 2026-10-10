-- Subcategorías de experiencia para Música y Fiesta (antes solo había de naturaleza, comida, familia y cultura).
alter table public.experiences drop constraint experiences_kind_check;
alter table public.experiences add constraint experiences_kind_check check (kind in (
  'senderismo','montanismo','ecoturismo','cascadas','aves','fauna','astronomia',
  'ciclismo','campismo','interpretativo','fotografia','educacion_ambiental',
  'gastronomia','taller_artesanal','cultural','agricola','cabalgata','productores',
  'enoturismo','historico',
  'clase_musica','clase_baile','musica_en_vivo',
  'ruta_pulque','tradiciones','pirotecnia'));
