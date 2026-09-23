"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enqueueJob } from "../actions";
import { JOB_KIND_LABEL, type JobKind } from "@/lib/types";

const inputCls = "rounded-control border border-line-2 bg-white px-3 py-2 text-[14px]";
const HELP: Record<JobKind, string> = {
  process: "OCR + modelo local sobre los flyers en cola. La Mac lo hace sola cuando hay flyers; úsalo para forzarlo.",
  scrape: "Recorre las fuentes (Facebook, sitios) y encola las imágenes nuevas.",
  festivities: "Crea un evento publicado por cada fiesta recurrente del año (idempotente).",
  seed: "Municipios, lugares del SIC y DENUE y fiestas. Tarda varios minutos; solo si cambió el catálogo.",
  doctor: "Revisa Postgres, Storage, Ollama y OCR desde la Mac y deja el reporte en el log.",
};

export function EnqueueForm({ sources, disabled }: { sources: { id: string; name: string }[]; disabled: boolean }) {
  const [kind, setKind] = useState<JobKind>("process");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const year = new Date().getFullYear();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params: Record<string, unknown> = {};
    if (kind === "process") params.limit = Number(fd.get("limit") ?? 20) || 20;
    if (kind === "scrape") {
      const src = String(fd.get("source_id") ?? "");
      if (src) params.source_id = src;
      params.force = fd.get("force") === "on";
    }
    if (kind === "festivities") {
      params.year = Number(fd.get("year") ?? year) || year;
      params.status = String(fd.get("status") ?? "published");
    }
    if (kind === "seed") {
      for (const k of ["municipalities", "sic", "denue", "festivities"]) params[k] = fd.get(k) === "on";
    }
    setError(null);
    start(async () => {
      const r = await enqueueJob({ kind, params });
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="rounded-card border border-line p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-[12px] font-semibold text-ink-2">
          Tarea
          <select value={kind} onChange={(e) => setKind(e.target.value as JobKind)} className={inputCls}>
            {(Object.keys(JOB_KIND_LABEL) as JobKind[]).map((k) => <option key={k} value={k}>{JOB_KIND_LABEL[k]}</option>)}
          </select>
        </label>

        {kind === "process" && (
          <label className="grid gap-1 text-[12px] font-semibold text-ink-2">
            Máx. flyers
            <input name="limit" type="number" min={1} max={500} defaultValue={20} className={`${inputCls} w-28`} />
          </label>
        )}
        {kind === "scrape" && (
          <>
            <label className="grid gap-1 text-[12px] font-semibold text-ink-2">
              Fuente
              <select name="source_id" className={inputCls} defaultValue="">
                <option value="">Todas las que toquen</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-[13px]"><input name="force" type="checkbox" defaultChecked /> Ignorar intervalos</label>
          </>
        )}
        {kind === "festivities" && (
          <>
            <label className="grid gap-1 text-[12px] font-semibold text-ink-2">
              Año
              <input name="year" type="number" min={year} max={year + 3} defaultValue={year} className={`${inputCls} w-28`} />
            </label>
            <label className="grid gap-1 text-[12px] font-semibold text-ink-2">
              Estado
              <select name="status" className={inputCls} defaultValue="published">
                <option value="published">Publicados</option>
                <option value="pending">Pendientes de revisión</option>
              </select>
            </label>
          </>
        )}
        {kind === "seed" && (
          <div className="flex flex-wrap gap-3 pb-2 text-[13px]">
            {[["municipalities", "Municipios"], ["sic", "SIC"], ["denue", "DENUE"], ["festivities", "Fiestas"]].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2"><input name={k} type="checkbox" defaultChecked /> {l}</label>
            ))}
          </div>
        )}

        <button disabled={pending} className="rounded-control bg-accent px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-50">
          {pending ? "Encolando…" : "Encolar"}
        </button>
      </div>
      <p className="mt-2 text-[12px] text-ink-2">{HELP[kind]}</p>
      {disabled && <p className="mt-1 text-[12px] text-warn">La Mac no está conectada: la tarea quedará en cola y arrancará cuando vuelva.</p>}
      {error && <p className="mt-1 text-[12px] text-error">{error}</p>}
    </form>
  );
}
