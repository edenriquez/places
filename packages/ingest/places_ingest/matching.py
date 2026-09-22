"""Match de lugar contra `places` (pg_trgm) y detección de duplicados en `events`."""

from __future__ import annotations

from datetime import date

import psycopg

from .db import fetch_all, fetch_one


def match_place(conn: psycopg.Connection, place_text: str | None, cvegeo: str | None) -> tuple[str | None, float]:
    """Devuelve (place_id, similitud) o (None, 0)."""
    if not place_text or not cvegeo:
        return None, 0.0
    row = fetch_one(
        conn,
        """
        select id, similarity(public.unaccent(lower(name)), public.unaccent(lower(%s))) as sim
        from public.places
        where municipality_cvegeo = %s and is_active
        order by sim desc
        limit 1
        """,
        (place_text, cvegeo),
    )
    if row and row["sim"] is not None and row["sim"] >= 0.45:
        return str(row["id"]), float(row["sim"])
    return None, float(row["sim"] or 0) if row else 0.0


def match_municipality(conn: psycopg.Connection, name: str | None) -> str | None:
    if not name:
        return None
    row = fetch_one(
        conn,
        """
        select cvegeo, similarity(public.unaccent(lower(name)), public.unaccent(lower(%s))) as sim
        from public.municipalities order by sim desc limit 1
        """,
        (name,),
    )
    return row["cvegeo"] if row and (row["sim"] or 0) >= 0.5 else None


def find_duplicate(conn: psycopg.Connection, title: str, cvegeo: str, first_date: date | None) -> str | None:
    """Evento existente con título parecido, mismo municipio y fecha ±1 día."""
    if not first_date:
        return None
    rows = fetch_all(
        conn,
        """
        select e.id, similarity(public.unaccent(lower(e.title)), public.unaccent(lower(%s))) as sim
        from public.events e
        join public.event_occurrences o on o.event_id = e.id
        where e.municipality_cvegeo = %s
          and e.status in ('pending','published')
          and o.starts_at::date between %s::date - 1 and %s::date + 1
        order by sim desc limit 1
        """,
        (title, cvegeo, first_date, first_date),
    )
    if rows and (rows[0]["sim"] or 0) >= 0.55:
        return str(rows[0]["id"])
    return None
