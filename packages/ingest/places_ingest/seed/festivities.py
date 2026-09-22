"""Carga festivities.yaml (Capa 1) y opcionalmente genera eventos 'pending' para el año en curso."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from pathlib import Path

import yaml

from ..db import connect, execute

YAML_PATH = Path(__file__).with_name("festivities.yaml")


def easter(year: int) -> date:
    """Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    ell = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * ell) // 451
    month = (h + ell - 7 * m + 114) // 31
    day = ((h + ell - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def movable_date(rule: str, year: int) -> date | None:
    e = easter(year)
    return {
        "carnaval": e - timedelta(days=47),       # martes de carnaval
        "semana_santa": e - timedelta(days=7),    # domingo de ramos
        "pentecostes": e + timedelta(days=49),
        "ascension": e + timedelta(days=39),
        "corpus": e + timedelta(days=60),
    }.get(rule)


def seed_festivities() -> int:
    data = yaml.safe_load(YAML_PATH.read_text(encoding="utf-8"))
    n = 0
    with connect() as conn:
        execute(conn, "delete from public.festivities where source = 'manual'")
        for block in data:
            cvegeo = block["cvegeo"]
            for it in block["items"]:
                n += execute(
                    conn,
                    """
                    insert into public.festivities
                      (municipality_cvegeo, name, locality, month, day, movable_rule, duration_days, description, source)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, 'manual')
                    """,
                    (cvegeo, it["name"], it.get("locality"), it.get("month"), it.get("day"),
                     it.get("movable_rule"), it.get("duration_days", 1), it.get("description")),
                )
    return n


def occurrences_for_year(year: int) -> list[tuple[str, str, date, int]]:
    """(cvegeo, nombre, fecha_inicio, días) de cada fiesta para un año dado."""
    data = yaml.safe_load(YAML_PATH.read_text(encoding="utf-8"))
    out = []
    for block in data:
        for it in block["items"]:
            if it.get("movable_rule"):
                d = movable_date(it["movable_rule"], year)
            elif it.get("month") and it.get("day"):
                d = date(year, it["month"], it["day"])
            else:
                d = None
            if d:
                out.append((block["cvegeo"], it["name"], d, it.get("duration_days", 1)))
    return out


def _category_for(name: str) -> str:
    n = name.lower()
    if "feria" in n:
        return "feria"
    if "carnaval" in n or "día de muertos" in n or "xantolo" in n:
        return "fiesta_patronal"
    if "peregrinación" in n or "semana santa" in n:
        return "religioso"
    if "aniversario" in n or "rompimiento" in n or "sitio de" in n:
        return "otro"
    return "fiesta_patronal"


MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]


def publish_year(year: int, status: str = "published", from_date: date | None = None) -> dict[str, int]:
    """Crea un evento (con una ocurrencia de todo el día que abarca la fiesta) por cada fiesta del año.

    Idempotente: unique (festivity_id, festivity_year). Las ocurrencias van con is_confirmed=false
    hasta que llegue un flyer real; la descripción lo dice.
    """
    from zoneinfo import ZoneInfo

    from ..config import settings
    from ..db import fetch_all, fetch_one

    tz = ZoneInfo(settings.timezone)
    from_date = from_date or date.today()
    stats = {"created": 0, "skipped_existing": 0, "skipped_past": 0}
    with connect() as conn:
        src = fetch_one(conn, "select id from public.sources where kind='manual' and name='calendario-anual'")
        if not src:
            src = fetch_one(
                conn,
                "insert into public.sources (name, kind, trust_score) values ('calendario-anual','manual',0.6) returning id",
            )
        fests = fetch_all(conn, "select * from public.festivities")
        for f in fests:
            start: date | None = None
            if f["movable_rule"]:
                start = movable_date(f["movable_rule"], year)
            elif f["month"] and f["day"]:
                try:
                    start = date(year, f["month"], f["day"])
                except ValueError:
                    start = None
            if not start:
                continue
            end = start + timedelta(days=max(int(f["duration_days"] or 1), 1) - 1)
            if end < from_date:
                stats["skipped_past"] += 1
                continue
            if fetch_one(conn, "select 1 from public.events where festivity_id=%s and festivity_year=%s", (f["id"], year)):
                stats["skipped_existing"] += 1
                continue
            when = (f"{start.day} de {MESES[start.month - 1]}" if start == end
                    else f"del {start.day} al {end.day} de {MESES[end.month - 1]}")
            desc = (
                f"{f['description'] + ' ' if f['description'] else ''}"
                f"Fecha estimada según el calendario anual ({when}). Por confirmar con el programa oficial."
            )
            row = fetch_one(
                conn,
                """
                insert into public.events
                  (slug, title, description, category, place_id, place_text, municipality_cvegeo,
                   is_free, status, confidence, source_id, festivity_id, festivity_year, verified_at, published_at)
                values (public.slugify(%s) || '-' || (select slug from public.municipalities where cvegeo = %s) || '-' || %s,
                        %s, %s, %s, %s, %s, %s, true, %s, 0.6, %s, %s, %s,
                        case when %s = 'published' then now() end, case when %s = 'published' then now() end)
                returning id
                """,
                (f["name"], f["municipality_cvegeo"], year, f["name"], desc, _category_for(f["name"]), f["place_id"], f["locality"],
                 f["municipality_cvegeo"], status, src["id"], f["id"], year, status, status),
            )
            execute(
                conn,
                """insert into public.event_occurrences (event_id, starts_at, ends_at, is_all_day, is_confirmed, note)
                   values (%s, %s, %s, true, false, 'Fecha estimada, por confirmar')""",
                (row["id"], datetime.combine(start, time(0, 0), tzinfo=tz), datetime.combine(end, time(23, 59), tzinfo=tz)),
            )
            stats["created"] += 1
    return stats
