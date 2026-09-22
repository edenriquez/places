# Infraestructura y despliegue

La infra de este proyecto **no vive aquí**: la declara el repo [`edenriquez/infra`](https://github.com/edenriquez/infra)
(`~/dev/infra`), stack `projects/places`. Ahí están el proyecto de Vercel, el de Supabase y, cuando exista el dominio,
el DNS en Cloudflare. Cambios de infra = PR en ese repo; el plan sale como comentario y el merge aplica.

| pieza | dónde | cómo se despliega |
|---|---|---|
| Web (`apps/web`) | Vercel, proyecto `entrelugares-web` | Vercel escucha este repo: push a `main` = producción, PR = preview. Env vars las pone Terraform. |
| Base de datos | Supabase, proyecto `entrelugares` (org personal, `us-west-2`) | `supabase/migrations` se aplican con `.github/workflows/supabase.yml` en push a `main`. |
| Ingest (`packages/ingest`) | Esta Mac, launchd (`ops/launchd`) | Manual, ver `packages/ingest/README.md`. Escribe a producción con la connection string del proyecto. |
| Dominio | `entrelugares.mx`, pendiente de compra | Al comprarlo en Cloudflare: en `infra` setear `TF_VAR_domain`, `TF_VAR_cloudflare_zone_id`, `CLOUDFLARE_API_TOKEN`. Mientras: `entrelugares-web.vercel.app`. |

## Secrets que necesita este repo

Environment `production` en GitHub: `SUPABASE_ACCESS_TOKEN` (token de la cuenta personal, login GitHub),
`SUPABASE_PROJECT_ID` (ref del proyecto, sale del output `supabase_project_ref` del stack) y `SUPABASE_DB_PASSWORD`
(la misma que `TF_VAR_supabase_db_password` en `infra`).

## Workflows

- `ci.yml`: lint + build de la web, ruff del ingest. Corre en PR y `main`.
- `supabase.yml`: en PR levanta Postgres local y verifica que las migraciones aplican limpias; en `main` hace `supabase db push`.
