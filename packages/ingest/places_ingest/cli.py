"""CLI `places-ingest`: seed | process | upload | festivities | worker | enqueue | jobs | doctor."""

from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(help="Job local de entrelugares.mx (corre en la Mac).", no_args_is_help=True)
console = Console()


@app.command()
def seed(
    municipalities: bool = typer.Option(True, help="Cargar municipios del corredor"),
    sic: bool = typer.Option(True, help="Lugares del SIC"),
    denue: bool = typer.Option(True, help="Lugares del DENUE sector 71"),
    festivities: bool = typer.Option(True, help="Fiestas recurrentes (Capa 1)"),
):
    """Carga municipios, lugares (SIC + DENUE) y fiestas del corredor."""
    from . import seed as s

    if municipalities:
        console.print(f"municipios: {s.seed_municipalities()}")
    if sic:
        console.print(f"SIC: {s.seed_sic()}")
    if denue:
        console.print(f"DENUE: {s.seed_denue()}")
    if festivities:
        console.print(f"fiestas: {s.seed_festivities()}")


@app.command()
def process(limit: int = 20, loop: bool = typer.Option(False, help="Quedarse escuchando la cola"),
            every: int = typer.Option(60, help="Segundos entre vueltas con --loop")):
    """Procesa raw_ingestions en cola (OCR + modelo local) y crea eventos pending."""
    import time

    from .queue import process_queue

    while True:
        stats = process_queue(limit=limit)
        if stats:
            console.print(stats)
        if not loop:
            break
        time.sleep(every)


@app.command()
def upload(folder: Path, municipio: str | None = typer.Option(None, "--municipio", "-m", help="CVEGEO (p. ej. 17026) o nombre"),
           origin: str | None = typer.Option(None, help="URL del post de origen"),
           organizer: str | None = typer.Option(None, help="Quién lo publicó"),
           process_now: bool = typer.Option(True, help="Procesar la cola al terminar")):
    """Carga masiva de flyers desde una carpeta local."""
    from .db import connect, fetch_one
    from .queue import enqueue_folder, process_queue

    cvegeo = None
    if municipio:
        with connect() as conn:
            row = fetch_one(conn, "select cvegeo from public.municipalities where cvegeo=%s or public.slugify(name)=public.slugify(%s)",
                            (municipio, municipio))
            if not row:
                raise typer.BadParameter(f"municipio desconocido: {municipio}")
            cvegeo = row["cvegeo"]
    n = enqueue_folder(folder, cvegeo, origin, organizer)
    console.print(f"encolados: {n}")
    if process_now and n:
        console.print(process_queue())


@app.command()
def festivities(year: int = typer.Option(None, help="Año para listar fechas calculadas"),
                publish: bool = typer.Option(False, help="Crear un evento por fiesta para lo que resta del año"),
                status: str = typer.Option("published", help="published | pending (con --publish)")):
    """Lista las fiestas del corredor para un año; con --publish las convierte en eventos."""
    from datetime import date

    from .seed.festivities import occurrences_for_year, publish_year

    year = year or date.today().year
    if publish:
        console.print(publish_year(year, status=status))
        return
    t = Table("Fecha", "Municipio", "Fiesta", "Días")
    for cvegeo, name, d, days in sorted(occurrences_for_year(year), key=lambda r: r[2]):
        t.add_row(d.isoformat(), cvegeo, name, str(days))
    console.print(t)


@app.command()
def worker(once: bool = typer.Option(False, help="Una sola pasada (revisar cola, correr a lo más una tarea) y salir"),
           name: str | None = typer.Option(None, help="Nombre del worker (default: hostname o WORKER_NAME)")):
    """La Mac como worker remoto: heartbeat + reclama tareas de `jobs` y reporta progreso. Usa PLACES_ENV_FILE=.env.prod."""
    from .worker import Worker

    Worker(name).run(once=once)


@app.command()
def enqueue(kind: str = typer.Argument(..., help="process | festivities | seed | doctor"),
            param: list[str] = typer.Option(None, "--param", "-p", help="clave=valor (p. ej. -p year=2027 -p force=true)"),  # noqa: B008
            priority: int = typer.Option(0, help="Mayor = antes")):
    """Encola una tarea para el worker (equivalente a /admin/jobs)."""
    import json

    from . import jobs as j
    from .db import connect

    params: dict = {}
    for kv in param or []:
        k, _, v = kv.partition("=")
        try:
            params[k] = json.loads(v)
        except ValueError:
            params[k] = v
    with connect() as conn:
        row = j.enqueue(conn, kind, params, origin="cli", priority=priority)
    console.print(f"encolada {row['id']} ({kind} {params})")


@app.command()
def jobs(limit: int = 15):
    """Lista las últimas tareas y el estado de los workers."""
    from . import jobs as j
    from .db import connect, fetch_all

    with connect() as conn:
        workers = fetch_all(conn, "select * from public.workers order by last_seen_at desc")
        rows = j.recent(conn, limit)
    t = Table("Worker", "Estado", "Visto", "Tarea actual", "Versión")
    for w in workers:
        t.add_row(w["id"], w["status"], w["last_seen_at"].strftime("%H:%M:%S"), str(w["current_job_id"] or "—"), w["version"] or "?")
    console.print(t)
    t = Table("Id", "Tipo", "Estado", "Progreso", "Mensaje", "Origen", "Creada")
    for r in rows:
        prog = f"{r['progress_done']}/{r['progress_total'] if r['progress_total'] is not None else '?'}"
        t.add_row(str(r["id"])[:8], r["kind"], r["status"], prog, (r["progress_message"] or r["error"] or "")[:60], r["origin"],
                  r["created_at"].strftime("%m-%d %H:%M"))
    console.print(t)


@app.command()
def doctor():
    """Verifica Postgres, Storage, Ollama y motores de OCR."""
    import shutil

    from .config import settings
    from .db import connect, fetch_one
    from .llm.ollama import has_model, is_available

    is_available_before = is_available()
    t = Table("Componente", "Estado")
    try:
        with connect() as conn:
            r = fetch_one(conn, "select count(*) n from public.municipalities")
            t.add_row("Postgres", f"[green]ok[/] ({r['n']} municipios)")
    except Exception as e:
        t.add_row("Postgres", f"[red]{e}[/]")
    t.add_row("Storage key", "[green]ok[/]" if settings.supabase_service_key else "[red]falta SUPABASE_SERVICE_KEY[/]")
    from .llm.ollama import OllamaServer

    if not shutil.which("ollama"):
        t.add_row("Ollama", "[red]no instalado (brew install ollama)[/]")
    else:
        try:
            with OllamaServer():  # arranca bajo demanda y se apaga al salir
                t.add_row("Ollama", "[green]ok[/] (bajo demanda; no queda corriendo)" if not is_available_before else "[green]ok[/] (ya estaba corriendo)")
                t.add_row(f"modelo {settings.vision_model}", "[green]ok[/]" if has_model(settings.vision_model) else "[red]falta (ollama pull)[/]")
                t.add_row(f"modelo {settings.ocr_model}", "[green]ok[/]" if has_model(settings.ocr_model) else "[yellow]opcional[/]")
        except Exception as e:
            t.add_row("Ollama", f"[red]{e}[/]")
    t.add_row("swiftc (Apple Vision)", "[green]ok[/]" if shutil.which("swiftc") else "[yellow]no[/]")
    t.add_row("tesseract", "[green]ok[/]" if shutil.which("tesseract") else "[yellow]no[/]")
    console.print(t)


if __name__ == "__main__":
    app()
