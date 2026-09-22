"""Supabase Storage (bucket flyers) por su API S3-compatible/REST con la service key. Sin SDK extra."""

from __future__ import annotations

import hashlib
import mimetypes
from pathlib import Path

import httpx

from .config import CACHE_DIR, settings


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.supabase_service_key}", "apikey": settings.supabase_service_key}


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def upload_flyer(local: Path, dest_path: str) -> str:
    """Sube al bucket; devuelve la ruta interna (media_path). Idempotente (upsert)."""
    ctype = mimetypes.guess_type(local.name)[0] or "application/octet-stream"
    url = f"{settings.supabase_url}/storage/v1/object/{settings.flyers_bucket}/{dest_path}"
    r = httpx.post(url, content=local.read_bytes(), headers={**_headers(), "Content-Type": ctype, "x-upsert": "true"}, timeout=120)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"storage upload {r.status_code}: {r.text[:200]}")
    return dest_path


def download_flyer(media_path: str) -> Path:
    """Baja del bucket a la caché local y devuelve la ruta."""
    local = CACHE_DIR / "flyers" / media_path
    if local.exists():
        return local
    local.parent.mkdir(parents=True, exist_ok=True)
    url = f"{settings.supabase_url}/storage/v1/object/{settings.flyers_bucket}/{media_path}"
    r = httpx.get(url, headers=_headers(), timeout=120)
    r.raise_for_status()
    local.write_bytes(r.content)
    return local


def public_url(media_path: str) -> str:
    return f"{settings.supabase_url}/storage/v1/object/public/{settings.flyers_bucket}/{media_path}"
