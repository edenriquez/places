"""OCR con el modelo glm-ocr vía Ollama (local, gratis)."""

from __future__ import annotations

from pathlib import Path

from ..config import settings
from ..llm.ollama import generate_with_image


def ocr(image_path: Path) -> str:
    return generate_with_image(
        model=settings.ocr_model,
        prompt="Text Recognition:",
        image_path=image_path,
        timeout_s=settings.llm_timeout_s,
    )
