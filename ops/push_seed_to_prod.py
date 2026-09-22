#!/usr/bin/env python3
"""Copia el seed local (municipios, lugares, fiestas, fuentes, eventos, ocurrencias) al proyecto
remoto de Supabase por la API REST, con la llave service_role. Upsert por PK: es idempotente.

Uso:
  SUPABASE_PROJECT_REF=swsdnphwstuvrjhrpmlw python3 ops/push_seed_to_prod.py
  # la llave se toma de SUPABASE_SERVICE_KEY o, si no está, de `supabase projects api-keys`.

Requiere: Supabase local corriendo (puerto 54362) con el seed cargado, y las migraciones ya
aplicadas en el proyecto remoto (las empuja el workflow de GitHub al hacer push a main).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

LOCAL_DB = os.environ.get("LOCAL_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54362/postgres")
REF = os.environ.get("SUPABASE_PROJECT_REF", "swsdnphwstuvrjhrpmlw")
URL = f"https://{REF}.supabase.co/rest/v1"

# (tabla, columna de conflicto, SELECT que produce JSON compatible con PostgREST; geometrías como EWKT)
TABLES = [
    ("municipalities", "cvegeo", "select cvegeo,cve_ent,cve_mun,state,name,slug,ST_AsEWKT(centroid) as centroid,is_pueblo_magico,population,cover_image_url,description,drive_from_cdmx,is_active from municipalities order by cvegeo"),
    ("places", "id", "select id,name,slug,kind,ST_AsEWKT(geom) as geom,address,locality,municipality_cvegeo,source,source_ref,phone,website,photos,is_active from places order by id"),
    ("festivities", "id", "select id,municipality_cvegeo,name,locality,month,day,movable_rule,duration_days,description,place_id,source,image_path from festivities order by id"),
    ("sources", "id", "select id,name,kind,url,municipality_cvegeo,interval_hours,enabled,trust_score,config from sources order by id"),
    # image_path va en null: los archivos del bucket local no se copian
    ("events", "id", "select id,slug,title,description,category,org_id,place_id,place_text,municipality_cvegeo,price_min,price_max,is_free,null::text as image_path,status,confidence,source_id,festivity_id,festivity_year,verified_at,published_at from events order by id"),
    ("event_occurrences", "id", "select id,event_id,starts_at,ends_at,is_all_day,is_confirmed,note from event_occurrences order by id"),
]


def service_key() -> str:
    if os.environ.get("SUPABASE_SERVICE_KEY"):
        return os.environ["SUPABASE_SERVICE_KEY"]
    out = subprocess.run(["supabase", "projects", "api-keys", "--project-ref", REF, "-o", "json"], capture_output=True, text=True, check=True).stdout
    keys = json.loads(out)
    for k in keys:
        if k.get("name") == "service_role":
            return k["api_key"]
    raise SystemExit("no encontré la llave service_role; exporta SUPABASE_SERVICE_KEY")


def local_rows(sql: str) -> list[dict]:
    out = subprocess.run(["psql", LOCAL_DB, "-Atc", f"select coalesce(json_agg(t), '[]') from ({sql}) t"], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def main() -> None:
    sk = service_key()
    headers = {"apikey": sk, "Authorization": f"Bearer {sk}", "Content-Type": "application/json"}

    def req(method: str, path: str, body=None, extra=None):
        r = urllib.request.Request(f"{URL}/{path}", data=json.dumps(body).encode() if body is not None else None,
                                   method=method, headers={**headers, **(extra or {})})
        try:
            with urllib.request.urlopen(r, timeout=180) as resp:
                return resp.status, resp.read().decode(), dict(resp.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()[:500], {}

    for path in ("festivities?select=image_path&limit=1", "events?select=festivity_id&limit=1", "municipalities_view?select=lat&limit=1"):
        st, body, _ = req("GET", path)
        if st != 200:
            raise SystemExit(f"esquema remoto incompleto ({path}: {st} {body}); aplica las migraciones primero")

    for table, conflict, sql in TABLES:
        rows = local_rows(sql)
        for i in range(0, len(rows), 200):
            st, body, _ = req("POST", f"{table}?on_conflict={conflict}", rows[i:i + 200],
                              {"Prefer": "resolution=merge-duplicates,return=minimal"})
            if st not in (200, 201, 204):
                raise SystemExit(f"{table}: error {st} {body}")
        _, _, hd = req("GET", f"{table}?select={conflict}&limit=1", None, {"Prefer": "count=exact"})
        total = hd.get("Content-Range", "?").split("/")[-1]
        print(f"{table:20s} enviados {len(rows):4d} | en prod: {total}")
    print("listo")


if __name__ == "__main__":
    sys.exit(main())
