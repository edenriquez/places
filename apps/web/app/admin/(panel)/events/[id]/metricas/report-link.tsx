"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { createReportLink, revokeReportLink } from "./actions";

/** Crea, copia o revoca el link privado del reporte para el comercio. */
export function ReportLink({ eventId, token }: { eventId: string; token: string | null }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  // la misma base en servidor y cliente (location no existe al renderizar en el servidor)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = token ? `${base}/reporte/${token}` : null;

  const copy = (u: string) => navigator.clipboard.writeText(u).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { const t = await createReportLink(eventId); await copy(`${base || location.origin}/reporte/${t}`); })}
        className="flex items-center gap-2 rounded-control bg-ink px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : copied ? <Check size={16} /> : url ? <Copy size={16} /> : <Link2 size={16} />}
        {copied ? "Link copiado" : url ? "Copiar link para el comercio" : "Crear link para el comercio"}
      </button>
      {url && (
        <>
          <a href={url} target="_blank" rel="noreferrer" className="rounded-control border border-line-2 px-3 py-2.5 text-[13px] font-semibold">Ver como el comercio</a>
          <button type="button" disabled={pending} onClick={() => start(() => revokeReportLink(eventId))} className="px-2 py-2.5 text-[13px] text-ink-2 underline">Revocar link</button>
        </>
      )}
    </div>
  );
}
