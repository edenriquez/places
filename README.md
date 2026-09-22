# entrelugares.mx

Qué está pasando cerca este fin de semana en pueblos de Morelos y Estado de México. Monorepo del MVP.

```
apps/web/          Next.js 16 (App Router, Tailwind v4, MapLibre). Público + /admin
packages/ingest/   Job local en Python: seed, OCR + modelo local (Ollama), scraping. Corre en la Mac
supabase/          Migraciones (Postgres + PostGIS, RLS, bucket flyers) y seed.sql
design/stitch/     Mocks de Stitch (HTML + PNG), DESIGN.md y PROMPTS.md
ops/launchd/       Plists para correr el job local en la Mac
```

Plan y decisiones: `~/.claude/plans/rippling-painting-hamming.md`.

## Correr en local

```bash
# 1. Base de datos (Supabase local en puertos 5436x para no chocar con otros proyectos)
supabase start
supabase db reset            # migraciones + supabase/seed.sql (fuentes de ejemplo)

# 2. Datos del corredor (municipios, lugares SIC + DENUE, fiestas)
cd packages/ingest && cp .env.example .env   # pega SUPABASE_SERVICE_KEY de `supabase status`
uv sync && uv run playwright install webkit chromium
uv run places-ingest seed
uv run places-ingest festivities --publish          # Capa 1: un evento por fiesta para lo que resta del año
uv run places-ingest festivities --publish --year 2027
uv run places-ingest doctor

# 3. Web
cd apps/web && cp ../../packages/ingest/.env .env.local.example 2>/dev/null; # o crea .env.local con:
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54361
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key de `supabase status`>
#   NEXT_PUBLIC_SITE_URL=http://localhost:3000
pnpm install && pnpm dev     # http://localhost:3000

# 4. Usuario admin (una vez)
node apps/web/scripts/create-admin.mjs tu@correo.mx 'una-contraseña'
```

## Flujo del MVP

0. La cartelera arranca con las fiestas y ferias recurrentes del corredor (`festivities --publish`), marcadas como "fecha estimada, por confirmar" hasta que llegue el flyer real.

1. Subes flyers en `/admin/upload` (o `places-ingest upload ./carpeta -m tlayacapan`). Solo se encolan.
2. En la Mac, `places-ingest process` toma la cola: OCR (Apple Vision) → Qwen 3.5 por Ollama → reglas de fecha/precio → match de lugar → evento `pending`. Ollama se arranca y apaga bajo demanda.
3. Revisas en `/admin/review`: corregir, aprobar y publicar, marcar duplicado o descartar.
4. Lo publicado aparece en `/` (Explorar, "Sucediendo ahora"), `/mapa`, `/evento/<slug>` y `/municipio/<slug>`.
5. `places-ingest scrape` recorre las fuentes de `/admin/sources` y encola imágenes nuevas.

Para dejarlo automático: `ops/launchd/*.plist` (process cada 10 min, scrape a las 03:00).

## Producción

Proyecto Supabase `entrelugares` (ref `swsdnphwstuvrjhrpmlw`, us-west-2). Las migraciones las aplica el workflow `.github/workflows/supabase.yml` en cada push a `main` que toque `supabase/`.

```bash
# copiar el seed local a producción (idempotente; requiere `supabase login` o SUPABASE_SERVICE_KEY)
python3 ops/push_seed_to_prod.py

# admin en producción
SUPABASE_URL=https://swsdnphwstuvrjhrpmlw.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role> \
  node apps/web/scripts/create-admin.mjs tu@correo.mx 'contraseña'
```

Web: Vercel con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_SITE_URL` (pendiente). El job de ingesta sigue corriendo solo en la Mac apuntando a producción (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` en `packages/ingest/.env`).
