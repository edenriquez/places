-- Se quita el scraping de fuentes (páginas de Facebook y sitios web). La tabla sources se conserva:
-- la usan la cola de flyers (admin-web, publicar-web, calendario-anual) y el origen que muestra la revisión.

delete from public.jobs where kind = 'scrape';
alter table public.jobs drop constraint jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check check (kind in ('process','festivities','seed','doctor'));

-- las fuentes que se scrapeaban quedan como historial (sus flyers ya ingresados siguen apuntando a ellas)
update public.sources set enabled = false, run_requested_at = null where kind in ('facebook_page','instagram','website');
