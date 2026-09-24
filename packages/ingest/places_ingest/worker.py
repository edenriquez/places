"""`places-ingest worker`: la Mac como worker remoto.

- Heartbeat a `workers` cada pocos segundos (hilo aparte) para que el admin vea si la Mac está en línea.
- Encola tareas automáticas cuando hace falta (flyers en cola → `process`).
- Reclama tareas de `jobs`, las corre reportando progreso y log, y respeta cancelaciones.
- Al recibir SIGTERM/SIGINT termina el flyer/fuente en curso, devuelve la tarea a la cola y se marca offline.

Solo conexiones salientes a Postgres y Storage: funciona detrás de NAT, sin puertos abiertos.
"""

from __future__ import annotations

import os
import platform
import signal
import socket
import subprocess
import sys
import threading
import time
import traceback
from datetime import datetime
from typing import Any

import psycopg
from rich.console import Console

from . import jobs
from .config import REPO_DIR, settings
from .db import connect, execute, fetch_all, fetch_one, jsonb
from .jobs import JobCancelled

console = Console()


def _git_sha() -> str | None:
    try:
        return subprocess.run(["git", "-C", str(REPO_DIR), "rev-parse", "--short", "HEAD"], capture_output=True, text=True,
                              timeout=5).stdout.strip() or None
    except Exception:
        return None


def _power_source() -> str | None:
    """'ac' | 'battery' en macOS (pmset); None en otros sistemas."""
    if sys.platform != "darwin":
        return None
    try:
        out = subprocess.run(["pmset", "-g", "batt"], capture_output=True, text=True, timeout=5).stdout
    except Exception:
        return None
    if "AC Power" in out:
        return "ac"
    if "Battery Power" in out:
        return "battery"
    return None


class Worker:
    def __init__(self, name: str | None = None) -> None:
        self.id = name or settings.worker_name or socket.gethostname().split(".")[0]
        self.hostname = socket.gethostname()
        self.version = _git_sha()
        self.started = time.time()
        self.current_job_id: str | None = None
        self.stop_event = threading.Event()
        self._hb_thread: threading.Thread | None = None

    # ------------------------------------------------------------------ heartbeat
    def _meta(self) -> dict[str, Any]:
        from .llm.ollama import is_available

        try:
            load = round(os.getloadavg()[0], 2)
        except OSError:
            load = None
        return {
            "model": settings.vision_model,
            "ocr_engine": settings.ocr_engine,
            "ollama": is_available(),
            "load": load,
            "power": _power_source(),
            "uptime_s": int(time.time() - self.started),
            "python": platform.python_version(),
            "os": f"{platform.system()} {platform.release()}",
            "pid": os.getpid(),
            "poll_s": settings.worker_poll_s,
            "heartbeat_s": settings.worker_heartbeat_s,
        }

    def beat(self, conn: psycopg.Connection, status: str | None = None) -> None:
        status = status or ("busy" if self.current_job_id else "online")
        execute(
            conn,
            """insert into public.workers (id, status, current_job_id, hostname, version, meta, started_at, last_seen_at)
               values (%s, %s, %s, %s, %s, %s, to_timestamp(%s), now())
               on conflict (id) do update set status=excluded.status, current_job_id=excluded.current_job_id,
                 hostname=excluded.hostname, version=excluded.version, meta=excluded.meta,
                 started_at=excluded.started_at, last_seen_at=now()""",
            (self.id, status, self.current_job_id, self.hostname, self.version, jsonb(self._meta()), self.started),
        )
        if self.current_job_id:
            execute(conn, "update public.jobs set heartbeat_at=now() where id=%s and status='running'", (self.current_job_id,))

    def _heartbeat_loop(self) -> None:
        while not self.stop_event.is_set():
            try:
                with connect(autocommit=True) as conn:
                    while not self.stop_event.is_set():
                        self.beat(conn)
                        self.stop_event.wait(settings.worker_heartbeat_s)
            except Exception as e:  # red caída, pooler reiniciado…: reintenta
                console.print(f"[yellow]heartbeat:[/] {e}")
                self.stop_event.wait(min(60, settings.worker_heartbeat_s * 2))

    # ------------------------------------------------------------------ tareas automáticas
    def enqueue_auto(self, conn: psycopg.Connection) -> None:
        """Encola lo automático. Si la última tarea de ese tipo falló hace poco, espera (evita bucles de error)."""
        if settings.auto_process and not jobs.has_open(conn, "process") and not jobs.recently_failed(conn, "process"):
            n = fetch_one(conn, "select count(*) n from public.raw_ingestions where status='queued' and attempts < 3 and media_path is not null")["n"]
            if n:
                jobs.enqueue(conn, "process", {"limit": max(20, n)}, origin="auto")
                conn.commit()
                console.print(f"[cyan]auto[/] process ({n} en cola)")

    def recover(self, conn: psycopg.Connection) -> None:
        """Tareas que quedaron `running` a nombre de esta máquina (crash, reinicio): a la cola otra vez."""
        stale = fetch_all(conn, "select id from public.jobs where status='running' and worker_id=%s", (self.id,))
        for row in stale:
            execute(conn, "update public.raw_ingestions set status='queued' where job_id=%s and status='processing'", (row["id"],))
            jobs.requeue(conn, row["id"], "worker reiniciado; la tarea vuelve a la cola")
            console.print(f"[yellow]recuperada[/] {row['id']}")

    # ------------------------------------------------------------------ ejecución
    def run_job(self, conn: psycopg.Connection, job: dict) -> None:
        job_id = str(job["id"])
        kind, params = job["kind"], job["params"] or {}
        self.current_job_id = job_id
        self.beat(conn)
        conn.commit()
        console.print(f"[bold]▶ {kind}[/] {job_id} {params}")

        last_check = [0.0]
        cancelled = [False]

        def should_stop() -> bool:
            if self.stop_event.is_set():
                return True
            if time.time() - last_check[0] > 3:  # no consultar la BD en cada iteración
                last_check[0] = time.time()
                cancelled[0] = jobs.cancel_requested(conn, job_id)
            return cancelled[0]

        def report(done: int, total: int | None, message: str | None) -> None:
            log_line = message if message and message[:1] in "✓✗" else None
            jobs.progress(conn, job_id, done, total, message, log_line)

        try:
            result = self.dispatch(kind, params, report, should_stop)
        except JobCancelled as e:
            conn.rollback()
            if self.stop_event.is_set():
                jobs.requeue(conn, job_id, f"worker detenido ({e}); se reanudará")
            else:
                jobs.cancel(conn, job_id, str(e))
            console.print(f"[yellow]■ {kind}[/] {e}")
        except Exception as e:
            conn.rollback()  # si la transacción quedó abortada, sin esto el fail() también fallaría
            jobs.fail(conn, job_id, f"{type(e).__name__}: {e}\n{traceback.format_exc()[-1500:]}")
            console.print(f"[red]✗ {kind}[/] {e}")
        else:
            jobs.finish(conn, job_id, result, message=self._summary(kind, result))
            console.print(f"[green]✓ {kind}[/] {result}")
        finally:
            self.current_job_id = None
            try:
                self.beat(conn)
                conn.commit()
            except Exception:
                pass

    @staticmethod
    def _summary(kind: str, result: Any) -> str:
        if isinstance(result, dict) and result:
            return ", ".join(f"{k}: {v}" for k, v in list(result.items())[:6])
        return "listo"

    def dispatch(self, kind: str, params: dict, report: jobs.Progress, should_stop: jobs.ShouldStop) -> Any:
        if kind == "process":
            from .queue import process_queue

            return process_queue(limit=int(params.get("limit", 20)), job_id=self.current_job_id, progress=report, should_stop=should_stop)

        if kind == "festivities":
            from .seed.festivities import publish_year

            year = int(params.get("year") or datetime.now().year)
            report(0, 1, f"publicando fiestas de {year}")
            res = publish_year(year, status=params.get("status", "published"))
            report(1, 1, f"✓ fiestas {year}: {res}")
            return res

        if kind == "seed":
            from . import seed as s

            parts = [(k, fn) for k, fn in (("municipalities", s.seed_municipalities), ("sic", s.seed_sic),
                                            ("denue", s.seed_denue), ("festivities", s.seed_festivities))
                     if params.get(k, True)]
            out: dict[str, Any] = {}
            for i, (k, fn) in enumerate(parts):
                if should_stop():
                    raise JobCancelled(f"detenido antes de {k}")
                report(i, len(parts), f"seed {k}")
                out[k] = fn()
                report(i + 1, len(parts), f"✓ {k}: {out[k]}")
            return out

        if kind == "doctor":
            return self.doctor(report)

        raise ValueError(f"kind desconocido: {kind}")

    def doctor(self, report: jobs.Progress) -> dict[str, Any]:
        import shutil

        from .llm.ollama import OllamaServer, has_model, is_available

        out: dict[str, Any] = {"worker": self.id, "version": self.version, "env_file": os.environ.get("PLACES_ENV_FILE", ".env")}
        checks = 5
        report(0, checks, "revisando Postgres")
        with connect() as conn:
            r = fetch_one(conn, "select count(*) n from public.municipalities")
            out["postgres"] = f"ok ({r['n']} municipios)"
        report(1, checks, "✓ Postgres")
        out["storage_key"] = "ok" if settings.supabase_service_key else "falta SUPABASE_SERVICE_KEY"
        report(2, checks, f"{'✓' if settings.supabase_service_key else '✗'} Storage key")
        if not shutil.which("ollama"):
            out["ollama"] = "no instalado"
        else:
            was_up = is_available()
            with OllamaServer():
                out["ollama"] = "ok (ya corría)" if was_up else "ok (bajo demanda)"
                out[f"model {settings.vision_model}"] = "ok" if has_model(settings.vision_model) else "falta (ollama pull)"
                out[f"model {settings.ocr_model}"] = "ok" if has_model(settings.ocr_model) else "opcional, no instalado"
        report(3, checks, f"✓ Ollama: {out['ollama']}")
        out["ocr"] = {"apple": bool(shutil.which("swiftc")), "tesseract": bool(shutil.which("tesseract")), "engine": settings.ocr_engine}
        report(4, checks, "✓ OCR")
        out["power"] = _power_source()
        report(5, checks, "✓ listo")
        return out

    # ------------------------------------------------------------------ bucle principal
    def run(self, once: bool = False) -> None:
        def _stop(signum, _frame):
            console.print(f"[yellow]señal {signal.Signals(signum).name}: terminando lo que está en curso…[/]")
            self.stop_event.set()

        signal.signal(signal.SIGTERM, _stop)
        signal.signal(signal.SIGINT, _stop)

        console.print(f"[bold]worker[/] {self.id} ({self.hostname}) v{self.version or '?'} → {settings.database_url.split('@')[-1]}")
        self._hb_thread = threading.Thread(target=self._heartbeat_loop, name="heartbeat", daemon=True)
        self._hb_thread.start()

        backoff = 5
        while not self.stop_event.is_set():
            try:
                with connect() as conn:
                    self.beat(conn)  # la fila en workers debe existir antes de reclamar (FK de jobs.worker_id)
                    conn.commit()
                    self.recover(conn)
                    conn.commit()
                    backoff = 5
                    while not self.stop_event.is_set():
                        self.enqueue_auto(conn)
                        job = jobs.claim(conn, self.id)
                        if job:
                            self.run_job(conn, job)
                            if once:
                                break
                            continue  # sin pausa: puede haber más en cola
                        if once:
                            break
                        self.stop_event.wait(settings.worker_poll_s)
                if once:
                    break
            except Exception as e:
                console.print(f"[red]worker:[/] {e}; reintento en {backoff}s")
                self.stop_event.wait(backoff)
                backoff = min(backoff * 2, 120)

        self.stop_event.set()
        try:
            with connect(autocommit=True) as conn:
                self.beat(conn, status="offline")
        except Exception:
            pass
        console.print("[bold]worker detenido[/]")
