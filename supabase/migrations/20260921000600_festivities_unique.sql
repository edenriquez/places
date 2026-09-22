-- Fiestas únicas por municipio y nombre, para que el seed sea un upsert y no rompa los eventos generados.
create unique index festivities_muni_name_uniq on public.festivities (municipality_cvegeo, name);
