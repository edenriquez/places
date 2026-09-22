"""OCR con Tesseract (brew install tesseract tesseract-lang). Respaldo."""

from __future__ import annotations

import subprocess
from pathlib import Path


def ocr(image_path: Path) -> str:
    out = subprocess.run(
        ["tesseract", str(image_path), "stdout", "-l", "spa+eng", "--psm", "4"],
        capture_output=True, text=True, timeout=120,
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or "tesseract failed")
    return out.stdout
