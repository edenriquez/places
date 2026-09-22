"""Cola: la web (o `upload`) deja filas en raw_ingestions con status=queued; este módulo las consume."""

from __future__ import annotations

import time
from pathlib import Path

from rich.console import Console

from .db import connect, execute, fetch_all, fetch_one, jsonb
from .llm.ollama import OllamaServer
from .pipeline import process_ingestion
from .storage import sha256_of, upload_flyer

console = Console()
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def process_queue(limit: int = 20, max_attempts: int = 3) -> dict[str, int]:
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
        # Ollama solo vive mientras haya trabajo; se apaga al salir del bloque.
        with OllamaServer():
            for ing in rows:
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
                else:
                    console.print(f"[green]✓[/] {ing['id']} → {status} ({time.time() - t0:.1f}s)")
                stats[status] = stats.get(status, 0) + 1
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
