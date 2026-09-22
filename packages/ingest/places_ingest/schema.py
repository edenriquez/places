"""Esquema del evento extraído de un flyer (salida del modelo local, validada con Pydantic)."""

from __future__ import annotations

from datetime import date, time
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Category = Literal[
    "feria", "fiesta_patronal", "concierto", "taller", "exposicion", "gastronomia",
    "deporte", "teatro", "danza", "cine", "mercado", "religioso", "infantil", "otro",
]


class FlyerDate(BaseModel):
    date: date
    start_time: time | None = None
    end_time: time | None = None
    note: str | None = None


class FlyerEvent(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    dates: list[FlyerDate] = Field(default_factory=list)
    place_text: str | None = Field(default=None, max_length=200)
    municipality: str | None = Field(default=None, description="Nombre del municipio si aparece")
    price_min: float | None = None
    price_max: float | None = None
    is_free: bool | None = None
    organizer: str | None = Field(default=None, max_length=160)
    category: Category = "otro"
    description: str | None = Field(default=None, max_length=1200)
    confidence: float = Field(ge=0, le=1, default=0.5)

    @field_validator("title", "place_text", "organizer", "description", mode="before")
    @classmethod
    def _strip(cls, v):
        if isinstance(v, str):
            v = " ".join(v.split())
            return v or None
        return v

    @field_validator("dates", mode="before")
    @classmethod
    def _drop_bad_dates(cls, v):
        if not isinstance(v, list):
            return []
        out = []
        for d in v:
            try:
                out.append(FlyerDate.model_validate(d))
            except Exception:
                continue
        return out


JSON_SCHEMA_FOR_PROMPT = """{
  "title": "string (título corto del evento)",
  "dates": [{"date": "YYYY-MM-DD", "start_time": "HH:MM o null", "end_time": "HH:MM o null", "note": "string o null"}],
  "place_text": "string con el nombre del lugar tal como aparece, o null",
  "municipality": "nombre del municipio si aparece, o null",
  "price_min": "número o null",
  "price_max": "número o null",
  "is_free": "true si dice gratis/entrada libre/sin costo, false si hay precio, null si no se sabe",
  "organizer": "quién organiza (ayuntamiento, casa de cultura, colectivo...), o null",
  "category": "una de: feria, fiesta_patronal, concierto, taller, exposicion, gastronomia, deporte, teatro, danza, cine, mercado, religioso, infantil, otro",
  "description": "1 a 3 frases con lo esencial, o null",
  "confidence": "número entre 0 y 1: qué tan seguro estás de título, fecha y lugar"
}"""
