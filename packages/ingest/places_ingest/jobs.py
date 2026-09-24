"""Tabla `jobs`: la web (o el worker) encola tareas; el worker las reclama y reporta progreso.

Todo pasa por Postgres, así la Mac solo necesita conexión saliente. `FOR UPDATE SKIP LOCKED` permite
más de un worker sin pisarse.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import psycopg

from .db import execute, fetch_all, fetch_one, jsonb

KINDS = ("process", "festivities", "seed", "doctor")
LOG_MAX_LINES = 300

# Callback de progreso: (hechos, total, mensaje). total puede ser None si aún no se conoce.
Progress = Callable[[int, int | None, str | None], None]
ShouldStop = Callable[[], bool]


class JobCancelled(Exception):
    """El admin pidió cancelar o el worker se está apagando."""


def enqueue(conn: psycopg.Connection, kind: str, params: dict[str, Any] | None = None, origin: str = "cli",
            priority: int = 0, requested_by: str | None = None) -> dict:
    if kind not in KINDS:
        raise ValueError(f"kind desconocido: {kind}")
    return fetch_one(
        conn,
        """insert into public.jobs (kind, params, origin, priority, requested_by)
           values (%s, %s, %s, %s, %s) returning *""",
        (kind, jsonb(params or {}), origin, priority, requested_by),
    )


def has_open(conn: psycopg.Connection, kind: str) -> bool:
    """¿Hay ya una tarea de este tipo en cola o corriendo? Evita duplicar las automáticas."""
    return fetch_one(conn, "select 1 from public.jobs where kind=%s and status in ('queued','running') limit 1", (kind,)) is not None


def recently_failed(conn: psycopg.Connection, kind: str, minutes: int = 30) -> bool:
    """¿La última tarea automática de este tipo falló hace menos de `minutes`? Entonces no reintentar aún."""
    row = fetch_one(
        conn,
        """select status, finished_at from public.jobs where kind=%s and origin='auto'
           order by created_at desc limit 1""",
        (kind,),
    )
    return bool(row and row["status"] == "failed" and row["finished_at"]
                and (datetime.now(UTC) - row["finished_at"]).total_seconds() < minutes * 60)


def claim(conn: psycopg.Connection, worker_id: str) -> dict | None:
    """Toma la siguiente tarea en cola (mayor prioridad, más antigua) y la marca running."""
    row = fetch_one(
        conn,
        """
        update public.jobs j
           set status='running', worker_id=%s, started_at=now(), heartbeat_at=now(), progress_message='iniciando'
         where j.id = (
           select id from public.jobs
            where status='queued' and cancel_requested_at is null
            order by priority desc, created_at
            for update skip locked
            limit 1)
        returning *
        """,
        (worker_id,),
    )
    conn.commit()
    return row


def progress(conn: psycopg.Connection, job_id: str, done: int, total: int | None, message: str | None,
             log_line: str | None = None) -> None:
    execute(
        conn,
        """update public.jobs
              set progress_done=%s,
                  progress_total=coalesce(%s, progress_total),
                  progress_message=coalesce(%s, progress_message),
                  heartbeat_at=now(),
                  log = case when %s::text is null then log
                             else (array_append(log, %s::text))[greatest(1, cardinality(log) + 2 - %s::int):] end
            where id=%s""",
        (done, total, message, log_line, log_line, LOG_MAX_LINES, job_id),
    )
    conn.commit()


def finish(conn: psycopg.Connection, job_id: str, result: dict[str, Any] | None = None, message: str = "listo") -> None:
    execute(
        conn,
        """update public.jobs set status='done', result=%s, progress_message=%s, finished_at=now(), heartbeat_at=now(),
                  progress_total=coalesce(progress_total, progress_done) where id=%s""",
        (jsonb(_plain(result)), message, job_id),
    )
    conn.commit()


def fail(conn: psycopg.Connection, job_id: str, error: str) -> None:
    execute(conn, "update public.jobs set status='failed', error=%s, progress_message='error', finished_at=now() where id=%s",
            (error[:2000], job_id))
    conn.commit()


def cancel(conn: psycopg.Connection, job_id: str, note: str = "cancelada") -> None:
    execute(conn, "update public.jobs set status='cancelled', progress_message=%s, finished_at=now() where id=%s", (note, job_id))
    conn.commit()


def requeue(conn: psycopg.Connection, job_id: str, note: str) -> None:
    """Devuelve una tarea a la cola conservando el progreso (p. ej. al apagar el worker a media tarea)."""
    execute(
        conn,
        """update public.jobs set status='queued', worker_id=null, started_at=null, heartbeat_at=null,
                  progress_message=%s, log=array_append(log, %s) where id=%s""",
        (note, note, job_id),
    )
    conn.commit()


def cancel_requested(conn: psycopg.Connection, job_id: str) -> bool:
    row = fetch_one(conn, "select cancel_requested_at is not null as c from public.jobs where id=%s", (job_id,))
    return bool(row and row["c"])


def recent(conn: psycopg.Connection, limit: int = 20) -> list[dict]:
    return fetch_all(conn, "select * from public.jobs order by created_at desc limit %s", (limit,))


def _plain(value: Any) -> Any:
    """Convierte a algo serializable en JSON (dicts con fechas, Paths, etc.)."""
    return json.loads(json.dumps(value, default=str)) if value is not None else None
