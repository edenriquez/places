# places-ingest — job local de entrelugares.mx

Corre **en tu Mac**, nunca en la nube. Hace tres cosas:

1. `seed`: municipios del corredor, lugares (SIC + DENUE) y fiestas recurrentes.
2. `process` / `upload`: toma flyers en cola (subidos desde `/admin/upload` o desde una carpeta), les hace OCR y los estructura con un modelo local por Ollama, y crea eventos `pending` para revisar en `/admin/review`.
3. `scrape`: recorre las fuentes de la tabla `sources` (páginas públicas de Facebook, sitios web) y encola las imágenes nuevas.

Todo es gratuito: Apple Vision / glm-ocr / Tesseract para OCR, Qwen 3.5 por Ollama para estructurar.

## Instalación (una vez)

```bash
# herramientas
brew install ollama tesseract tesseract-lang
# NO dejar Ollama como servicio: el job lo arranca y apaga bajo demanda
ollama pull qwen3.5:9b        # 6.6 GB, visión, corre bien en 16 GB
ollama pull glm-ocr           # 2.2 GB, OCR por modelo (opcional)

# paquete
cd packages/ingest
uv sync                       # crea .venv con Python 3.12
uv run playwright install webkit chromium
cp .env.example .env          # y pega SUPABASE_SERVICE_KEY de `supabase status`
uv run places-ingest doctor
```

## Uso

```bash
uv run places-ingest seed                     # municipios + SIC + DENUE + fiestas
uv run places-ingest upload ~/flyers -m tlayacapan --origin https://facebook.com/...  # carga masiva
uv run places-ingest process                  # una pasada por la cola
uv run places-ingest process --loop --every 60
uv run places-ingest scrape --force --only "Tlayacapan"
uv run places-ingest festivities --year 2027
```

## Como job de launchd

Los plists están en `ops/launchd/`. Ajusta las rutas y:

```bash
cp ops/launchd/mx.entrelugares.ingest.process.plist ~/Library/LaunchAgents/
cp ops/launchd/mx.entrelugares.ingest.scrape.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/mx.entrelugares.ingest.process.plist
launchctl load ~/Library/LaunchAgents/mx.entrelugares.ingest.scrape.plist
```

`process` corre cada 10 minutos; `scrape` a las 03:00. Logs en `packages/ingest/data/logs/`.

## Motores de OCR

| motor | cómo | notas |
|---|---|---|
| `apple` (default) | framework Vision de macOS, binario Swift compilado la primera vez | gratis, rápido, muy bueno en español |
| `glm` | modelo `glm-ocr` por Ollama | bueno en tablas/programas; más lento |
| `tesseract` | `brew install tesseract tesseract-lang` | respaldo |
| `paddle` | `uv sync --extra paddle` | pesado, opcional |

Ollama **no** corre como servicio: `process` arranca `ollama serve` solo cuando hay flyers en cola y lo apaga al terminar (descargando el modelo de memoria). Si ya estaba abierto, lo respeta y no lo cierra.

Si el motor elegido falla se intenta el siguiente. El texto OCR se guarda en `raw_ingestions.ocr_text` y va al modelo junto con la imagen.

## Scraping: advertencia

Leer páginas de Facebook/Instagram sin permiso va contra sus términos; la cuenta usada se puede bloquear y los selectores cambian sin aviso. El adaptador guarda un snapshot del HTML en `data/raw/snapshots/<source_id>/` en cada corrida para reparar selectores. Cuando un ayuntamiento te dé acceso a su página, cambia la fuente a un mecanismo autorizado.
