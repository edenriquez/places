"""CLI `places-ingest`: seed | process | upload | scrape | festivities | doctor."""

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
def scrape(force: bool = typer.Option(False, help="Ignorar intervalos"),
           only: str | None = typer.Option(None, help="id o parte del nombre de una fuente"),
           process_now: bool = typer.Option(True)):
    """Corre los scrapers de `sources` que toquen y encola imágenes nuevas."""
    from .queue import process_queue
    from .scrape.runner import run_scrapers

    console.print(run_scrapers(force=force, only=only))
    if process_now:
        console.print(process_queue())


@app.command()
def festivities(year: int = typer.Option(None, help="Año para listar fechas calculadas")):
    """Lista las fiestas del corredor para un año (fijas y móviles)."""
    from datetime import date

    from .seed.festivities import occurrences_for_year

    year = year or date.today().year
    t = Table("Fecha", "Municipio", "Fiesta", "Días")
    for cvegeo, name, d, days in sorted(occurrences_for_year(year), key=lambda r: r[2]):
        t.add_row(d.isoformat(), cvegeo, name, str(days))
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
    except Exception as e:  # noqa: BLE001
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
        except Exception as e:  # noqa: BLE001
            t.add_row("Ollama", f"[red]{e}[/]")
    t.add_row("swiftc (Apple Vision)", "[green]ok[/]" if shutil.which("swiftc") else "[yellow]no[/]")
    t.add_row("tesseract", "[green]ok[/]" if shutil.which("tesseract") else "[yellow]no[/]")
    console.print(t)


if __name__ == "__main__":
    app()
