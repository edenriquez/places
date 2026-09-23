# Infraestructura y despliegue

La infra de este proyecto **no vive aquí**: la declara el repo [`edenriquez/infra`](https://github.com/edenriquez/infra)
(`~/dev/infra`), stack `projects/places`. Ahí están el proyecto de Vercel, el de Supabase y, cuando exista el dominio,
el DNS en Cloudflare. Cambios de infra = PR en ese repo; el plan sale como comentario y el merge aplica.

| pieza | dónde | cómo se despliega |
|---|---|---|
| Web (`apps/web`) | Vercel, proyecto `entrelugares-web` | Vercel escucha este repo: push a `main` = producción, PR = preview. Env vars las pone Terraform. |
| Base de datos | Supabase, proyecto `entrelugares` (org personal, `us-west-2`) | `supabase/migrations` se aplican con `.github/workflows/supabase.yml` en push a `main`. |
| Ingest (`packages/ingest`) | Esta Mac como worker remoto, launchd (`ops/worker.sh install`) | Polling a `jobs` + heartbeat a `workers` por el session pooler de Supabase (IPv4, 5432) con `.env.prod`. Estado y cola en `/admin/jobs`. |
| Dominio | `entrelugares.mx`, pendiente de compra | Al comprarlo en Cloudflare: en `infra` setear `TF_VAR_domain`, `TF_VAR_cloudflare_zone_id`, `CLOUDFLARE_API_TOKEN`. Mientras: `entrelugares-web.vercel.app`. |

## Secrets que necesita este repo

Environment `production` en GitHub: `SUPABASE_ACCESS_TOKEN` (token de la cuenta personal, login GitHub),
`SUPABASE_PROJECT_ID` (ref del proyecto, sale del output `supabase_project_ref` del stack) y `SUPABASE_DB_PASSWORD`
(la misma que `TF_VAR_supabase_db_password` en `infra`).

## Worker en la Mac

`.env.prod` (gitignored, lo crea `ops/worker.sh setup`) necesita la contraseña de la BD del proyecto: la misma que
`SUPABASE_DB_PASSWORD` en GitHub / `TF_VAR_supabase_db_password` en `infra`. Si se resetea en el dashboard hay que
actualizar los tres lugares. La `service_role` la obtiene la CLI (`supabase projects api-keys`). La migración
`20260923000000_jobs.sql` (tablas `jobs`, `workers`) la aplica `supabase.yml` al hacer push a `main`.

## Workflows

- `ci.yml`: lint + build de la web, ruff del ingest. Corre en PR y `main`.
- `supabase.yml`: en PR levanta Postgres local y verifica que las migraciones aplican limpias; en `main` hace `supabase db push`.
