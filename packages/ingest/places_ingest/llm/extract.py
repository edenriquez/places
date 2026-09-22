"""Flyer (imagen + texto OCR) -> FlyerEvent usando el modelo de visión local por Ollama."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from ..config import settings
from ..schema import JSON_SCHEMA_FOR_PROMPT, FlyerEvent
from .ollama import generate_with_image, parse_json

SYSTEM = (
    "Eres un asistente que lee flyers de eventos culturales de pueblos de México "
    "(ferias, fiestas patronales, conciertos, talleres, casas de cultura). "
    "Respondes únicamente con un objeto JSON válido, sin explicaciones."
)

PROMPT = """Hoy es {today}. Extrae los datos del evento anunciado en este flyer.

Texto reconocido por OCR (puede tener errores; usa la imagen para corregir):
---
{ocr}
---
{hints}
Reglas:
- Fechas en formato YYYY-MM-DD. Si el flyer no dice año, usa el año en que la fecha caiga próxima a hoy.
- Si hay varias fechas (por ejemplo un programa de feria), incluye cada una en "dates".
- Horas en formato 24 h "HH:MM". Si dice "7 pm" es "19:00".
- "is_free" es true si dice gratis, entrada libre, sin costo, cooperación voluntaria.
- Si no estás seguro de un campo, pon null. No inventes.
- "confidence" refleja qué tan seguro estás del título, la fecha y el lugar juntos.

Devuelve SOLO este JSON:
{schema}"""

# JSON schema para el modo "format" de Ollama (fuerza estructura)
FORMAT = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "dates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "date": {"type": "string"},
                    "start_time": {"type": ["string", "null"]},
                    "end_time": {"type": ["string", "null"]},
                    "note": {"type": ["string", "null"]},
                },
                "required": ["date"],
            },
        },
        "place_text": {"type": ["string", "null"]},
        "municipality": {"type": ["string", "null"]},
        "price_min": {"type": ["number", "null"]},
        "price_max": {"type": ["number", "null"]},
        "is_free": {"type": ["boolean", "null"]},
        "organizer": {"type": ["string", "null"]},
        "category": {"type": "string"},
        "description": {"type": ["string", "null"]},
        "confidence": {"type": "number"},
    },
    "required": ["title", "dates", "category", "confidence"],
}


def extract_event(image_path: Path, ocr_text: str, municipality_hint: str | None = None,
                  organizer_hint: str | None = None, post_text: str | None = None) -> tuple[FlyerEvent, str]:
    hints = []
    if municipality_hint:
        hints.append(f"Pista: el flyer pertenece al municipio de {municipality_hint}.")
    if organizer_hint:
        hints.append(f"Pista: lo publicó {organizer_hint}.")
    if post_text:
        hints.append(f"Texto del post que acompañaba al flyer:\n{post_text[:1500]}")
    prompt = PROMPT.format(
        today=date.today().isoformat(),
        ocr=(ocr_text or "(sin texto OCR)")[:4000],
        hints=("\n".join(hints) + "\n") if hints else "",
        schema=JSON_SCHEMA_FOR_PROMPT,
    )
    last_err: Exception | None = None
    for attempt in range(2):
        raw = generate_with_image(
            model=settings.vision_model, prompt=prompt, image_path=image_path,
            timeout_s=settings.llm_timeout_s, json_schema=FORMAT if attempt == 0 else None, system=SYSTEM,
        )
        try:
            data = parse_json(raw)
            return FlyerEvent.model_validate(data), raw
        except Exception as e:  # JSON inválido o no valida el esquema: un reintento sin format
            last_err = e
    raise ValueError(f"extracción inválida tras 2 intentos: {last_err}")
