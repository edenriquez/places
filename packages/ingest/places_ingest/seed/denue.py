"""Seed de lugares desde el DENUE (INEGI), descarga masiva nacional del sector 71
(servicios de esparcimiento culturales y deportivos). Sin token; ~33 MB.

https://www.inegi.org.mx/contenidos/masiva/denue/denue_00_71_csv.zip
"""

from __future__ import annotations

import csv
import io
import zipfile

import httpx

from ..config import RAW_DIR
from ..db import connect, execute
from .municipalities import CVEGEOS

URL = "https://www.inegi.org.mx/contenidos/masiva/denue/denue_00_71_csv.zip"

# prefijo SCIAN -> kind. 7111 artes escénicas, 7112 deportes profesionales, 7113 promotores/ferias,
# 7121 museos/sitios históricos/zoológicos, 7131 parques de diversiones, 7139 otros recreativos.
KIND_BY_PREFIX = [
    ("712111", "museo"), ("712112", "zona_arqueologica"), ("7121", "museo"),
    ("711111", "teatro"), ("711112", "teatro"), ("7111", "teatro"),
    ("7113", "otro"),          # promotores de espectáculos y ferias
    ("713113", "parque"), ("7131", "parque"),
    ("713943", "deportivo"), ("713944", "deportivo"), ("7139", "deportivo"),
    ("7112", "deportivo"),
]


def _kind(code: str) -> str:
    for prefix, kind in KIND_BY_PREFIX:
        if code.startswith(prefix):
            return kind
    return "otro"


def _download() -> str:
    path = RAW_DIR / "denue_00_71_csv.zip"
    if not path.exists():
        with httpx.stream("GET", URL, timeout=600, follow_redirects=True) as r:
            r.raise_for_status()
            with path.open("wb") as fh:
                for chunk in r.iter_bytes(1 << 20):
                    fh.write(chunk)
    with zipfile.ZipFile(path) as z:
        member = next(n for n in z.namelist() if n.startswith("conjunto_de_datos/") and n.endswith(".csv"))
        return z.read(member).decode("latin-1", errors="replace")


def seed_denue(include_kinds: set[str] | None = None) -> int:
    text = _download()
    reader = csv.DictReader(io.StringIO(text))
    n = 0
    with connect() as conn:
        for row in reader:
            cvegeo = row["cve_ent"].zfill(2) + row["cve_mun"].zfill(3)
            if cvegeo not in CVEGEOS:
                continue
            kind = _kind(row["codigo_act"])
            if include_kinds and kind not in include_kinds:
                continue
            name = (row.get("nom_estab") or row.get("raz_social") or "").strip().title()
            if not name:
                continue
            try:
                lat, lng = float(row["latitud"]), float(row["longitud"])
            except (ValueError, KeyError):
                continue
            address = " ".join(
                p for p in (row.get("tipo_vial"), row.get("nom_vial"), row.get("numero_ext"),
                            row.get("tipo_asent"), row.get("nomb_asent")) if p
            ).strip() or None
            n += execute(
                conn,
                """
                insert into public.places
                  (name, slug, kind, geom, address, locality, municipality_cvegeo, source, source_ref, phone, website)
                values (%s, public.slugify(%s), %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s,
                        'denue', %s, %s, %s)
                on conflict (source, source_ref) do update set
                  name = excluded.name, kind = excluded.kind, geom = excluded.geom, address = excluded.address
                """,
                (name, name, kind, lng, lat, address, row.get("localidad"), cvegeo,
                 row["clee"] or row["id"], row.get("telefono") or None, row.get("www") or None),
            )
    return n
