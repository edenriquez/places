"""Contrato de un adaptador de scraping y utilidades compartidas."""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx

from ..config import CACHE_DIR, RAW_DIR, settings


@dataclass
class FoundItem:
    image_url: str
    post_url: str | None = None
    text: str | None = None
    posted_at: str | None = None
    extra: dict = field(default_factory=dict)


class Adapter:
    kind: str = ""

    def __init__(self, source: dict):
        self.source = source
        self.config = source.get("config") or {}

    def fetch(self) -> list[FoundItem]:  # pragma: no cover - interfaz
        raise NotImplementedError


def polite_sleep():
    time.sleep(settings.scrape_min_delay_s)


def snapshot(source_id: str, name: str, content: bytes) -> Path:
    """Guarda el HTML/JSON crudo de la corrida (auditoría y para reparar selectores)."""
    d = RAW_DIR / "snapshots" / source_id
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"{time.strftime('%Y%m%d-%H%M%S')}-{name}"
    p.write_bytes(content)
    return p


def download_image(url: str) -> tuple[Path, str]:
    """Baja una imagen a caché; devuelve (ruta, sha256)."""
    r = httpx.get(url, timeout=60, follow_redirects=True, headers={"User-Agent": settings.scrape_user_agent})
    r.raise_for_status()
    digest = hashlib.sha256(r.content).hexdigest()
    ctype = r.headers.get("content-type", "")
    ext = ".png" if "png" in ctype else ".webp" if "webp" in ctype else ".jpg"
    p = CACHE_DIR / "scraped" / f"{digest}{ext}"
    p.parent.mkdir(parents=True, exist_ok=True)
    if not p.exists():
        p.write_bytes(r.content)
    return p, digest
