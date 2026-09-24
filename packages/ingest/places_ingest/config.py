"""Configuración del job local. Todo viene de variables de entorno (.env en packages/ingest).

`PLACES_ENV_FILE` elige otro archivo (p. ej. `.env.prod` para el worker que apunta a producción); ruta
absoluta o relativa a packages/ingest.
"""

from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PACKAGE_DIR = Path(__file__).resolve().parent
INGEST_DIR = PACKAGE_DIR.parent
REPO_DIR = INGEST_DIR.parent.parent
DATA_DIR = INGEST_DIR / "data"          # descargas y caché local (ignorado por git)
RAW_DIR = DATA_DIR / "raw"
CACHE_DIR = DATA_DIR / "cache"
LOG_DIR = DATA_DIR / "logs"
ENV_FILE = INGEST_DIR / os.environ.get("PLACES_ENV_FILE", ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    # Postgres (Supabase). Local: postgresql://postgres:postgres@127.0.0.1:54362/postgres
    database_url: str = "postgresql://postgres:postgres@127.0.0.1:54362/postgres"

    # Supabase Storage (bucket "flyers"). Local: http://127.0.0.1:54361 + service_role key de `supabase status`.
    supabase_url: str = "http://127.0.0.1:54361"
    supabase_service_key: str = ""
    flyers_bucket: str = "flyers"

    # Ollama local
    ollama_url: str = "http://127.0.0.1:11434"
    vision_model: str = "qwen3.5:9b"      # estructura el flyer leyendo la imagen + texto OCR
    ocr_model: str = "glm-ocr"            # OCR por modelo, opcional
    ocr_engine: str = "apple"             # apple | glm | tesseract | paddle | none
    llm_timeout_s: int = 240

    # Umbrales
    auto_publish_min_confidence: float = 1.01  # MVP: nada se publica solo, todo pasa por /admin/review. Bajar a ~0.95 después
    review_min_confidence: float = 0.0

    timezone: str = "America/Mexico_City"

    # Worker (`places-ingest worker`): la Mac hace polling a la tabla jobs y manda heartbeat a workers
    worker_name: str | None = None       # default: hostname
    worker_poll_s: int = 10              # cada cuánto busca tareas
    worker_heartbeat_s: int = 15         # cada cuánto reporta que sigue viva
    auto_process: bool = True            # encolar `process` solo cuando hay flyers en cola


settings = Settings()

for _d in (RAW_DIR, CACHE_DIR, LOG_DIR):
    _d.mkdir(parents=True, exist_ok=True)
