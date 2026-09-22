"""Reglas deterministas que no dependen del modelo: fechas en español, precios, gratis."""

from __future__ import annotations

import re
from datetime import date, datetime, time

import dateparser

from .config import settings

FREE_RE = re.compile(r"\b(gratis|gratuit[oa]|entrada libre|sin costo|acceso libre|cooperaci[oó]n voluntaria)\b", re.I)
PRICE_RE = re.compile(r"\$\s?(\d{1,3}(?:[,.]\d{3})*|\d+)(?:\.\d{2})?", re.I)
TIME_RE = re.compile(
    r"\b(\d{1,2})(?::(\d{2}))?\s*(?:hrs?\.?|h\b|horas)?\s*(a\.?\s?m\.?|p\.?\s?m\.?|de la tarde|de la noche|de la mañana)?", re.I
)
# "sábado 27 de septiembre", "27 y 28 de septiembre", "del 20 al 25 de diciembre", "27/09/2026"
DATE_RE = re.compile(
    r"(?:(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+)?"
    r"(\d{1,2})(?:\s*(?:,|y|al|-|–)\s*(\d{1,2}))?\s+de\s+"
    r"(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)"
    r"(?:\s+(?:de\s+)?(\d{4}))?",
    re.I,
)
MONTHS = {m: i for i, m in enumerate(
    ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"], 1)}
MONTHS["setiembre"] = 9


def detect_free(text: str) -> bool | None:
    if FREE_RE.search(text):
        return True
    if PRICE_RE.search(text):
        return False
    return None


def detect_prices(text: str) -> tuple[float | None, float | None]:
    vals = []
    for m in PRICE_RE.finditer(text):
        try:
            v = float(m.group(1).replace(",", "").replace(".", ""))
            if 5 <= v <= 20000:
                vals.append(v)
        except ValueError:
            pass
    if not vals:
        return None, None
    return min(vals), max(vals)


def _infer_year(month: int, day: int, today: date) -> int:
    """Sin año explícito: el año en que la fecha cae próxima (hasta 45 días atrás cuenta como este año)."""
    try:
        d = date(today.year, month, day)
    except ValueError:
        return today.year
    return today.year + 1 if (today - d).days > 45 else today.year


def detect_dates(text: str, today: date | None = None) -> list[date]:
    today = today or date.today()
    out: list[date] = []
    for m in DATE_RE.finditer(text):
        d1, d2, mon, year = m.group(1), m.group(2), m.group(3).lower(), m.group(4)
        month = MONTHS.get(mon)
        if not month:
            continue
        y = int(year) if year else _infer_year(month, int(d1), today)
        try:
            start = date(y, month, int(d1))
            out.append(start)
            if d2:
                end = date(y, month, int(d2))
                if end > start and (end - start).days <= 31:
                    out.extend(date.fromordinal(o) for o in range(start.toordinal() + 1, end.toordinal() + 1))
        except ValueError:
            continue
    if not out:
        # último recurso: dateparser sobre cada línea corta
        for line in text.splitlines():
            line = line.strip()
            if not (4 <= len(line) <= 40 and any(ch.isdigit() for ch in line)):
                continue
            dt = dateparser.parse(
                line, languages=["es"],
                settings={"PREFER_DATES_FROM": "future", "TIMEZONE": settings.timezone, "RETURN_AS_TIMEZONE_AWARE": False},
            )
            if isinstance(dt, datetime) and dt.year >= today.year:
                out.append(dt.date())
    # únicos, ordenados
    return sorted(set(out))


def detect_time(text: str) -> time | None:
    for m in TIME_RE.finditer(text):
        h, mnt, ampm = int(m.group(1)), int(m.group(2) or 0), (m.group(3) or "").lower()
        if not (0 <= h <= 24 and 0 <= mnt < 60):
            continue
        if not ampm and not m.group(2) and "hrs" not in m.group(0).lower() and "h" not in m.group(0).lower():
            continue  # un número solo no es hora
        if ("p" in ampm or "tarde" in ampm or "noche" in ampm) and h < 12:
            h += 12
        if h == 24:
            h = 0
        return time(h, mnt)
    return None
