-- Viajes/excursiones: punto de salida. place_text queda como destino ("Tepetlixpa → Xochimilco").
alter table public.events add column departure_text text;
