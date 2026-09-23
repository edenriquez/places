"""Corre los adaptadores de `sources` que toquen (por intervalo o run_requested_at) y encola imágenes nuevas."""

from __future__ import annotations

from rich.console import Console

from ..db import connect, execute, fetch_all, fetch_one, jsonb
from ..jobs import JobCancelled, Progress, ShouldStop
from ..storage import upload_flyer
from .base import download_image, polite_sleep
from .facebook import FacebookPageAdapter
from .website import WebsiteAdapter

console = Console()
ADAPTERS = {a.kind: a for a in (FacebookPageAdapter, WebsiteAdapter)}


def due_sources(conn, force: bool = False, only: str | None = None) -> list[dict]:
    sql = """
      select * from public.sources
      where enabled and kind in ('facebook_page','website','instagram')
        and (%s or run_requested_at is not null
             or last_run_at is null
             or last_run_at < now() - make_interval(hours => interval_hours))
    """
    params: list = [force]
    if only:
        sql += " and (id::text = %s or name ilike %s)"
        params += [only, f"%{only}%"]
    return fetch_all(conn, sql + " order by last_run_at nulls first", params)


def run_scrapers(force: bool = False, only: str | None = None, progress: Progress | None = None,
                 should_stop: ShouldStop | None = None) -> dict[str, int]:
    """Corre las fuentes que toquen. `progress`/`should_stop` los usa el worker para reportar y cancelar."""
    stats: dict[str, int] = {}
    with connect() as conn:
        sources = due_sources(conn, force, only)
        total = len(sources)
        if progress:
            progress(0, total, f"{total} fuentes por revisar" if total else "ninguna fuente toca todavía")
        for i, src in enumerate(sources, start=1):
            if should_stop and should_stop():
                raise JobCancelled(f"detenido tras {i - 1} de {total} fuentes")
            if progress:
                progress(i - 1, total, f"revisando {src['name']}")
            adapter_cls = ADAPTERS.get(src["kind"])
            if not adapter_cls:
                execute(conn, "update public.sources set last_run_at=now(), last_error=%s where id=%s",
                        (f"sin adaptador para {src['kind']}", src["id"]))
                conn.commit()
                if progress:
                    progress(i, total, f"✗ {src['name']}: sin adaptador para {src['kind']}")
                continue
            console.print(f"[bold]{src['name']}[/] ({src['kind']})")
            new = 0
            try:
                items = adapter_cls(src).fetch()
                for it in items:
                    try:
                        local, digest = download_image(it.image_url)
                    except Exception as e:
                        console.print(f"  [yellow]img falló[/] {e}")
                        continue
                    if fetch_one(conn, "select 1 from public.raw_ingestions where media_sha256=%s", (digest,)):
                        continue
                    dest = f"scraped/{digest[:2]}/{digest}{local.suffix}"
                    upload_flyer(local, dest)
                    execute(
                        conn,
                        """insert into public.raw_ingestions
                           (source_id, status, media_path, media_sha256, origin_url, municipality_hint, organizer_hint, payload)
                           values (%s,'queued',%s,%s,%s,%s,%s,%s)""",
                        (src["id"], dest, digest, it.post_url or src["url"], src.get("municipality_cvegeo"),
                         src["name"], jsonb({"text": it.text, "image_url": it.image_url, **it.extra})),
                    )
                    new += 1
                    polite_sleep()
                execute(
                    conn,
                    """update public.sources set last_run_at=now(), last_success_at=now(), last_error=null,
                       new_items_last_run=%s, run_requested_at=null where id=%s""",
                    (new, src["id"]),
                )
                conn.commit()
                console.print(f"  [green]+{new} nuevos[/] de {len(items)} imágenes")
                line = f"✓ {src['name']}: +{new} nuevos de {len(items)} imágenes"
            except Exception as e:
                conn.rollback()
                execute(conn, "update public.sources set last_run_at=now(), last_error=%s, run_requested_at=null where id=%s",
                        (str(e)[:900], src["id"]))
                conn.commit()
                console.print(f"  [red]error[/] {e}")
                line = f"✗ {src['name']}: {str(e)[:200]}"
            stats[src["name"]] = new
            if progress:
                progress(i, total, line)
    return stats
