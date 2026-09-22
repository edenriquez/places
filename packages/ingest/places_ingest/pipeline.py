"""Pipeline: raw_ingestion (queued) -> OCR -> modelo local -> reglas -> match -> dedup -> event pending."""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime, time
from zoneinfo import ZoneInfo

import psycopg

from .config import settings
from .db import execute, fetch_one, jsonb
from .llm.extract import extract_event
from .matching import find_duplicate, match_municipality, match_place
from .ocr import run_ocr
from .rules import detect_dates, detect_free, detect_prices, detect_time
from .schema import FlyerEvent
from .storage import download_flyer

TZ = ZoneInfo(settings.timezone)


def _slug(title: str, suffix: str) -> str:
    s = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:70]
    return f"{s}-{suffix}"


def process_ingestion(conn: psycopg.Connection, ing: dict) -> str:
    """Procesa una fila de raw_ingestions. Devuelve el status final."""
    execute(conn, "update public.raw_ingestions set status='processing', attempts = attempts + 1 where id=%s", (ing["id"],))
    conn.commit()

    local = download_flyer(ing["media_path"])
    ocr_text, engine = run_ocr(local)

    muni_hint_name = None
    if ing.get("municipality_hint"):
        row = fetch_one(conn, "select name from public.municipalities where cvegeo=%s", (ing["municipality_hint"],))
        muni_hint_name = row["name"] if row else None
    post_text = (ing.get("payload") or {}).get("text")

    event, _raw = extract_event(local, ocr_text, muni_hint_name, ing.get("organizer_hint"), post_text)

    # --- reglas deterministas complementan al modelo ---
    all_text = "\n".join(t for t in (ocr_text, post_text or "") if t)
    if not event.dates:
        for d in detect_dates(all_text):
            event.dates.append({"date": d})  # type: ignore[arg-type]
        event = FlyerEvent.model_validate(event.model_dump())
    if event.dates and all(d.start_time is None for d in event.dates):
        t = detect_time(all_text)
        if t:
            for d in event.dates:
                d.start_time = t
    if event.is_free is None:
        event.is_free = detect_free(all_text)
    if event.price_min is None and event.price_max is None and not event.is_free:
        event.price_min, event.price_max = detect_prices(all_text)
    if event.is_free:
        event.price_min = event.price_max = None

    # --- municipio y lugar ---
    cvegeo = ing.get("municipality_hint") or match_municipality(conn, event.municipality)
    if not cvegeo and event.place_text:
        cvegeo = match_municipality(conn, event.place_text.split(",")[-1])
    place_id, _sim = match_place(conn, event.place_text, cvegeo) if cvegeo else (None, 0.0)

    # --- confianza final ---
    conf = float(event.confidence)
    if not event.dates:
        conf = min(conf, 0.3)
    if not cvegeo:
        conf = min(conf, 0.4)
    if event.place_text and not place_id:
        conf = min(conf, 0.75)
    conf = round(conf, 2)

    execute(
        conn,
        """update public.raw_ingestions
           set ocr_text=%s, ocr_engine=%s, extraction=%s, extraction_model=%s, confidence=%s, processed_at=now()
           where id=%s""",
        (ocr_text, engine, jsonb(event.model_dump(mode="json")), settings.vision_model, conf, ing["id"]),
    )

    if not cvegeo:
        execute(conn, "update public.raw_ingestions set status='needs_review', error='sin municipio' where id=%s", (ing["id"],))
        return "needs_review"

    first_date = event.dates[0].date if event.dates else None
    dup = find_duplicate(conn, event.title, cvegeo, first_date)
    if dup:
        execute(conn, "update public.raw_ingestions set status='duplicate', event_id=%s where id=%s", (dup, ing["id"]))
        return "duplicate"

    # --- crear evento pending + ocurrencias ---
    row = fetch_one(
        conn,
        """
        insert into public.events
          (slug, title, description, category, place_id, place_text, municipality_cvegeo,
           price_min, price_max, is_free, image_path, status, confidence, source_id, raw_ingestion_id)
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s)
        returning id
        """,
        (
            _slug(event.title, str(ing["id"])[:8]), event.title, event.description, event.category,
            place_id, event.place_text, cvegeo, event.price_min, event.price_max, bool(event.is_free),
            ing["media_path"], conf, ing.get("source_id"), ing["id"],
        ),
    )
    event_id = row["id"]
    for d in event.dates:
        st = d.start_time or time(0, 0)
        starts = datetime.combine(d.date, st, tzinfo=TZ)
        ends = datetime.combine(d.date, d.end_time, tzinfo=TZ) if d.end_time else None
        execute(
            conn,
            "insert into public.event_occurrences (event_id, starts_at, ends_at, is_all_day, note) values (%s,%s,%s,%s,%s)",
            (event_id, starts, ends, d.start_time is None, d.note),
        )

    status = "needs_review"
    if conf >= settings.auto_publish_min_confidence and place_id and event.dates:
        execute(conn, "update public.events set status='published', published_at=now(), verified_at=now() where id=%s", (event_id,))
        status = "approved"
    execute(conn, "update public.raw_ingestions set status=%s, event_id=%s where id=%s", (status, event_id, ing["id"]))
    return status
