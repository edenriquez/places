"""Seed de lugares desde el Sistema de Información Cultural (Secretaría de Cultura), datos abiertos.

CSV en latin-1: https://sic.cultura.gob.mx/opendata/d/0_<tabla>_directorio.csv
"""

from __future__ import annotations

import csv
import io
import time

import httpx

from ..config import RAW_DIR
from ..db import connect, execute
from .municipalities import CORRIDOR

BASE = "https://sic.cultura.gob.mx/opendata/d/0_{table}_directorio.csv"

# tabla SIC -> kind en places
TABLES = {
    "museo": "museo",
    "teatro": "teatro",
    "centro_cultural": "centro_cultural",
    "galeria": "galeria",
    "auditorio": "auditorio",
    "zona_arqueologica": "zona_arqueologica",
    "casa_artesania": "otro",
}

_NAME_TO_CVEGEO = {(r[1], r[4]): r[0] for r in CORRIDOR}  # (estado_id, nom_mun) -> cvegeo


def _download(table: str) -> str:
    path = RAW_DIR / f"sic_{table}.csv"
    if not path.exists() or path.stat().st_size == 0:
        last: Exception | None = None
        for attempt in range(4):  # el servidor del SIC corta conexiones a media descarga
            try:
                with httpx.Client(timeout=httpx.Timeout(180, connect=30), follow_redirects=True) as c:
                    r = c.get(BASE.format(table=table), headers={"User-Agent": "entrelugares-ingest/0.1"})
                    r.raise_for_status()
                    path.write_bytes(r.content)
                last = None
                break
            except Exception as e:
                last = e
                time.sleep(2 * (attempt + 1))
        if last is not None:
            raise RuntimeError(f"no se pudo bajar SIC {table}: {last}")
    return path.read_text(encoding="latin-1", errors="replace")


def seed_sic() -> dict[str, int]:
    counts: dict[str, int] = {}
    with connect() as conn:
        for table, kind in TABLES.items():
            text = _download(table)
            reader = csv.DictReader(io.StringIO(text))
            n = 0
            for row in reader:
                key = (row.get("estado_id", ""), row.get("nom_mun", ""))
                cvegeo = _NAME_TO_CVEGEO.get(key)
                if not cvegeo:
                    continue
                name = (row.get(f"{table}_nombre") or "").strip()
                if not name:
                    continue
                try:
                    lat = float(row.get("gmaps_latitud") or 0)
                    lng = float(row.get("gmaps_longitud") or 0)
                except ValueError:
                    lat = lng = 0.0
                has_geo = abs(lat) > 1 and abs(lng) > 1
                # kind más fino para casas de cultura
                k = kind
                if table == "centro_cultural" and "casa de cultura" in name.lower():
                    k = "casa_cultura"
                address = ", ".join(
                    p for p in (row.get(f"{table}_calle_numero"), row.get(f"{table}_colonia")) if p
                ) or None
                n += execute(
                    conn,
                    """
                    insert into public.places
                      (name, slug, kind, geom, address, locality, municipality_cvegeo, source, source_ref, phone, website)
                    values (%s, public.slugify(%s), %s,
                            case when %s then ST_SetSRID(ST_MakePoint(%s, %s), 4326) end,
                            %s, %s, %s, 'sic', %s, %s, %s)
                    on conflict (source, source_ref) do update set
                      name = excluded.name, kind = excluded.kind, address = excluded.address,
                      geom = coalesce(excluded.geom, public.places.geom), phone = excluded.phone,
                      website = excluded.website
                    """,
                    (
                        name, name, k, has_geo, lng, lat, address, row.get("nom_loc"), cvegeo,
                        f"{table}:{row.get(f'{table}_id')}",
                        (row.get(f"{table}_telefono1") or row.get(f"{table}_telfono1") or None),
                        (row.get("pagina_web") or row.get(f"{table}_pagina_web") or None),
                    ),
                )
            counts[table] = n
    return counts
