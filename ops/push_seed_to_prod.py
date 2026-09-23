#!/usr/bin/env python3
"""Copia el seed local (municipios, lugares, fiestas, organizaciones, fuentes, eventos, ocurrencias) al
proyecto remoto de Supabase por la API REST, con la llave service_role. Upsert por PK: es idempotente.
Las imágenes (events/festivities.image_path) se copian del bucket local "flyers" al remoto si faltan.

Uso:
  python3 ops/push_seed_to_prod.py            # solo agrega/actualiza
  python3 ops/push_seed_to_prod.py --wipe     # respalda prod en ops/backups/, BORRA sus datos y bucket, y sube el seed
  # la llave se toma de SUPABASE_SERVICE_KEY o, si no está, de `supabase projects api-keys`.

--wipe no toca auth ni admin_users (las cuentas de admin siguen funcionando).

Requiere: Supabase local corriendo (puerto 54362) con el seed cargado, y las migraciones ya
aplicadas en el proyecto remoto (las empuja el workflow de GitHub al hacer push a main).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

LOCAL_DB = os.environ.get("LOCAL_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54362/postgres")
LOCAL_STORAGE = os.environ.get("LOCAL_SUPABASE_URL", "http://127.0.0.1:54361") + "/storage/v1/object/public/flyers"
REF = os.environ.get("SUPABASE_PROJECT_REF", "swsdnphwstuvrjhrpmlw")
URL = f"https://{REF}.supabase.co/rest/v1"
STORAGE = f"https://{REF}.supabase.co/storage/v1/object"
BACKUP_DIR = Path(__file__).resolve().parent / "backups"

EVENT_COLS = (
    "id,slug,title,description,category,org_id,place_id,place_text,municipality_cvegeo,price_min,price_max,is_free,"
    "image_path,status,confidence,source_id,festivity_id,festivity_year,verified_at,published_at,"
    "departure_text,contact_phone,contact_whatsapp,instagram_url,facebook_url,tiktok_url,website_url"
)

# (tabla, columna de conflicto, SELECT que produce JSON compatible con PostgREST; geometrías como EWKT). En orden de FKs.
TABLES = [
    ("municipalities", "cvegeo", "select cvegeo,cve_ent,cve_mun,state,name,slug,ST_AsEWKT(centroid) as centroid,is_pueblo_magico,population,cover_image_url,description,drive_from_cdmx,is_active from municipalities order by cvegeo"),
    ("places", "id", "select id,name,slug,kind,ST_AsEWKT(geom) as geom,address,locality,municipality_cvegeo,source,source_ref,phone,website,photos,is_active from places order by id"),
    ("festivities", "id", "select id,municipality_cvegeo,name,locality,month,day,movable_rule,duration_days,description,place_id,source,image_path from festivities order by id"),
    ("organizations", "id", "select id,name,slug,kind,municipality_cvegeo,whatsapp,facebook_url,instagram_url,website,logo_url,trust_score,crm_external_id from organizations order by id"),
    ("sources", "id", "select id,name,kind,url,municipality_cvegeo,interval_hours,enabled,trust_score,config from sources order by id"),
    # raw_ingestion_id no se copia: las ingestas (OCR, extracción) se quedan en local
    ("events", "id", f"select {EVENT_COLS} from events order by id"),
    ("event_occurrences", "id", "select id,event_id,starts_at,ends_at,is_all_day,is_confirmed,note from event_occurrences order by id"),
]
# --wipe borra en orden inverso de FKs (raw_ingestions apunta a sources y events)
WIPE = [("event_occurrences", "id"), ("raw_ingestions", "id"), ("events", "id"), ("festivities", "id"),
        ("sources", "id"), ("organizations", "id"), ("places", "id"), ("municipalities", "cvegeo")]


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
    wipe = "--wipe" in sys.argv
    sk = service_key()
    auth = {"apikey": sk, "Authorization": f"Bearer {sk}"}
    headers = {**auth, "Content-Type": "application/json"}

    def req(method: str, url: str, body=None, extra=None, raw: bytes | None = None):
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        r = urllib.request.Request(url, data=data, method=method, headers={**headers, **(extra or {})})
        try:
            with urllib.request.urlopen(r, timeout=180) as resp:
                return resp.status, resp.read(), dict(resp.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read()[:500], {}

    for path in ("festivities?select=image_path&limit=1", "events?select=departure_text,contact_phone&limit=1", "municipalities_view?select=lat&limit=1"):
        st, body, _ = req("GET", f"{URL}/{path}")
        if st != 200:
            raise SystemExit(f"esquema remoto incompleto ({path}: {st} {body!r}); aplica las migraciones primero")

    if wipe:
        # respaldo completo antes de borrar
        BACKUP_DIR.mkdir(exist_ok=True)
        backup: dict[str, list] = {}
        for table, _ in WIPE:
            rows, offset = [], 0
            while True:
                st, body, _ = req("GET", f"{URL}/{table}?select=*&offset={offset}&limit=1000")
                if st != 200:
                    raise SystemExit(f"respaldo {table}: {st} {body!r}")
                page = json.loads(body)
                rows += page
                offset += len(page)
                if len(page) < 1000:
                    break
            backup[table] = rows
        objects: list[str] = []

        def walk(prefix: str) -> None:
            st, body, _ = req("POST", f"{STORAGE}/list/flyers", {"prefix": prefix, "limit": 1000})
            for o in json.loads(body) if st == 200 else []:
                full = f"{prefix}{o['name']}"
                if o.get("id"):
                    objects.append(full)
                else:
                    walk(f"{full}/")

        walk("")
        backup["storage.flyers"] = objects
        out = BACKUP_DIR / f"prod-{time.strftime('%Y%m%d-%H%M%S')}.json"
        out.write_text(json.dumps(backup, ensure_ascii=False, indent=1, default=str))
        print(f"respaldo: {out} ({', '.join(f'{k} {len(v)}' for k, v in backup.items())})")

        for table, pk in WIPE:
            st, body, _ = req("DELETE", f"{URL}/{table}?{pk}=not.is.null", extra={"Prefer": "return=minimal"})
            if st not in (200, 204):
                raise SystemExit(f"borrar {table}: {st} {body!r}")
        for i in range(0, len(objects), 100):
            st, body, _ = req("DELETE", f"{STORAGE}/flyers", {"prefixes": objects[i:i + 100]})
            if st != 200:
                raise SystemExit(f"borrar bucket: {st} {body!r}")
        print(f"prod vaciado ({len(WIPE)} tablas, {len(objects)} archivos del bucket)")

    # imágenes primero, para que ningún evento quede apuntando a un archivo que no existe en prod
    paths = [r["p"] for r in local_rows("select image_path as p from events where image_path is not null union select image_path from festivities where image_path is not null")]
    copied = 0
    for path in paths:
        st, _, _ = req("HEAD", f"{STORAGE}/public/flyers/{path}")
        if st == 200:
            continue
        with urllib.request.urlopen(f"{LOCAL_STORAGE}/{path}", timeout=60) as resp:
            data, ctype = resp.read(), resp.headers.get("Content-Type", "application/octet-stream")
        st, body, _ = req("POST", f"{STORAGE}/flyers/{path}", raw=data, extra={"Content-Type": ctype, "x-upsert": "true"})
        if st not in (200, 201):
            raise SystemExit(f"subir {path}: {st} {body!r}")
        copied += 1
    print(f"{'imágenes':20s} copiadas {copied:4d} | ya en prod: {len(paths) - copied}")

    for table, conflict, sql in TABLES:
        rows = local_rows(sql)
        for i in range(0, len(rows), 200):
            st, body, _ = req("POST", f"{URL}/{table}?on_conflict={conflict}", rows[i:i + 200],
                              {"Prefer": "resolution=merge-duplicates,return=minimal"})
            if st not in (200, 201, 204):
                raise SystemExit(f"{table}: error {st} {body!r}")
        _, _, hd = req("GET", f"{URL}/{table}?select={conflict}&limit=1", None, {"Prefer": "count=exact"})
        total = hd.get("Content-Range", "?").split("/")[-1]
        print(f"{table:20s} enviados {len(rows):4d} | en prod: {total}")
    print("listo")


if __name__ == "__main__":
    sys.exit(main())
