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
uv run places-ingest festivities --year 2027          # lista fechas calculadas (móviles incluidas)
uv run places-ingest festivities --publish --year 2027  # crea un evento publicado por fiesta (idempotente)
```

## Worker remoto (la Mac conectada a producción)

```bash
uv run places-ingest worker            # bucle: heartbeat + reclama tareas de `jobs` (Ctrl-C termina el flyer en curso y devuelve la tarea a la cola)
uv run places-ingest worker --once     # una pasada, útil para probar
uv run places-ingest enqueue scrape -p force=true -p source_id=<uuid>
uv run places-ingest jobs              # workers y últimas tareas
```

- Perfil: `PLACES_ENV_FILE=.env.prod` (lo crea `ops/worker.sh setup`). Sin la variable usa `.env` (local).
- Heartbeat cada `WORKER_HEARTBEAT_S` (15 s) a `public.workers` con modelo, OCR, Ollama, carga, energía y git sha.
  La web da la Mac por desconectada a los 45 s sin señal.
- Tareas: `process`, `scrape`, `festivities`, `seed`, `doctor`. Progreso (`progress_done/total`, mensaje) y `log` por
  tarea; cancelación cooperativa entre flyers/fuentes; si el worker muere a media tarea, al arrancar la devuelve a la cola.
- Automático: encola `process` si hay flyers en cola (`AUTO_PROCESS`) y `scrape` si alguna fuente toca (`AUTO_SCRAPE`).
  Si la última automática falló, espera 30 min antes de volver a intentar.
- Como servicio: `ops/worker.sh install` carga `ops/launchd/mx.entrelugares.worker.plist` (KeepAlive, RunAtLoad,
  `caffeinate -s` para que la Mac no se duerma mientras esté conectada a la corriente). Logs en `data/logs/worker*.log`.

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
