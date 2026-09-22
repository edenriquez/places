"""OCR con PaddleOCR (opcional: `uv sync --extra paddle`). Buen desempeño en tipografías de flyer."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def _engine():
    from paddleocr import PaddleOCR  # import perezoso: es pesado

    return PaddleOCR(lang="es", use_textline_orientation=True)


def ocr(image_path: Path) -> str:
    result = _engine().predict(str(image_path))
    lines: list[str] = []
    for page in result:
        texts = page.get("rec_texts") if isinstance(page, dict) else getattr(page, "rec_texts", None)
        if texts:
            lines.extend(texts)
    return "\n".join(lines)
