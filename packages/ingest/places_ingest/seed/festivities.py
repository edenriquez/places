"""Carga festivities.yaml (Capa 1) y opcionalmente genera eventos 'pending' para el año en curso."""

from __future__ import annotations

from datetime import date, timedelta
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
