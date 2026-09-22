"""Configuración del job local. Todo viene de variables de entorno (.env en packages/ingest)."""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PACKAGE_DIR = Path(__file__).resolve().parent
INGEST_DIR = PACKAGE_DIR.parent
REPO_DIR = INGEST_DIR.parent.parent
DATA_DIR = INGEST_DIR / "data"          # descargas y caché local (ignorado por git)
RAW_DIR = DATA_DIR / "raw"
CACHE_DIR = DATA_DIR / "cache"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=INGEST_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

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

    # Scraping
    scrape_user_agent: str = (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    )
    scrape_min_delay_s: float = 4.0
    playwright_headless: bool = True
    facebook_storage_state: str | None = None  # ruta a storage_state.json de una cuenta dedicada (opcional)

    timezone: str = "America/Mexico_City"


settings = Settings()

for _d in (RAW_DIR, CACHE_DIR):
    _d.mkdir(parents=True, exist_ok=True)
