"""Motores de OCR gratuitos. `run_ocr(path)` elige el motor según settings.ocr_engine y cae al siguiente."""

from __future__ import annotations

from pathlib import Path

from ..config import settings

ORDER = ["apple", "glm", "tesseract", "paddle"]


def run_ocr(image_path: Path, engine: str | None = None) -> tuple[str, str]:
    """Devuelve (texto, motor_usado). Nunca lanza: si todo falla devuelve ('', 'none')."""
    engine = engine or settings.ocr_engine
    if engine == "none":
        return "", "none"
    chain = [engine] + [e for e in ORDER if e != engine]
    for eng in chain:
        try:
            if eng == "apple":
                from .apple_vision import ocr as f
            elif eng == "glm":
                from .glm import ocr as f
            elif eng == "tesseract":
                from .tesseract import ocr as f
            elif eng == "paddle":
                from .paddle import ocr as f
            else:
                continue
            text = f(image_path).strip()
            if text:
                return text, eng
        except Exception:
            continue
    return "", "none"
