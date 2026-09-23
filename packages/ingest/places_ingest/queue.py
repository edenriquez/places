"""Cola: la web (o `upload`) deja filas en raw_ingestions con status=queued; este módulo las consume."""

from __future__ import annotations

import time
from pathlib import Path

from rich.console import Console

from .db import connect, execute, fetch_all, fetch_one, jsonb
from .jobs import JobCancelled, Progress, ShouldStop
from .llm.ollama import OllamaServer
from .pipeline import process_ingestion
from .storage import sha256_of, upload_flyer

console = Console()
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def process_queue(limit: int = 20, max_attempts: int = 3, job_id: str | None = None,
                  progress: Progress | None = None, should_stop: ShouldStop | None = None) -> dict[str, int]:
    """Una pasada por la cola. Con `job_id` marca cada flyer con la tarea y reporta progreso.

    `should_stop` se consulta entre flyers: si devuelve True se lanza JobCancelled (lo hecho se conserva).
    """
    stats: dict[str, int] = {}
    with connect() as conn:
        rows = fetch_all(
            conn,
            """select * from public.raw_ingestions
               where status = 'queued' and attempts < %s and media_path is not null
               order by received_at limit %s""",
            (max_attempts, limit),
        )
        if not rows:
            return stats
        if job_id:
            execute(conn, "update public.raw_ingestions set job_id=%s where id = any(%s)", (job_id, [r["id"] for r in rows]))
            conn.commit()
        total = len(rows)
        if progress:
            progress(0, total, f"{total} flyers en cola")
        # Ollama solo vive mientras haya trabajo; se apaga al salir del bloque.
        with OllamaServer():
            for i, ing in enumerate(rows, start=1):
                if should_stop and should_stop():
                    raise JobCancelled(f"detenido tras {i - 1} de {total}")
                name = str((ing.get("payload") or {}).get("filename") or ing["media_path"].split("/")[-1])
                if progress:
                    progress(i - 1, total, f"procesando {name}")
                t0 = time.time()
                try:
                    status = process_ingestion(conn, ing)
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    execute(conn, "update public.raw_ingestions set status='failed', error=%s where id=%s", (str(e)[:900], ing["id"]))
                    conn.commit()
                    status = "failed"
                    console.print(f"[red]✗[/] {ing['id']} {e}")
                    line = f"✗ {name}: {str(e)[:200]}"
                else:
                    console.print(f"[green]✓[/] {ing['id']} → {status} ({time.time() - t0:.1f}s)")
                    line = f"✓ {name} → {status} ({time.time() - t0:.0f}s)"
                stats[status] = stats.get(status, 0) + 1
                if progress:
                    progress(i, total, line)
    return stats


def enqueue_folder(folder: Path, municipality_cvegeo: str | None, origin_url: str | None,
                   organizer: str | None, source_name: str = "manual") -> int:
    """Carga masiva local: sube cada imagen al bucket y crea la fila en cola. Dedup por sha256."""
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXT)
    n = 0
    with connect() as conn:
        src = fetch_one(conn, "select id from public.sources where kind='manual' and name=%s", (source_name,))
        if not src:
            src = fetch_one(
                conn,
                "insert into public.sources (name, kind, trust_score) values (%s, 'manual', 0.8) returning id",
                (source_name,),
            )
        for f in files:
            digest = sha256_of(f)
            if fetch_one(conn, "select 1 from public.raw_ingestions where media_sha256=%s", (digest,)):
                console.print(f"[yellow]=[/] {f.name} ya estaba")
                continue
            dest = f"uploads/{digest[:2]}/{digest}{f.suffix.lower()}"
            upload_flyer(f, dest)
            execute(
                conn,
                """insert into public.raw_ingestions
                   (source_id, status, media_path, media_sha256, origin_url, municipality_hint, organizer_hint, payload)
                   values (%s, 'queued', %s, %s, %s, %s, %s, %s)""",
                (src["id"], dest, digest, origin_url, municipality_cvegeo, organizer, jsonb({"filename": f.name})),
            )
            conn.commit()
            n += 1
            console.print(f"[green]+[/] {f.name}")
    return n
