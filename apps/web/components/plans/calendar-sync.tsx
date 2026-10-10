"use client";

import { useState } from "react";
import { CalendarSync as SyncIcon, Check, Link2 } from "lucide-react";
import { getClient } from "@/components/auth/session-provider";

/**
 * Suscribir "Mis planes" al calendario del teléfono o de Google: los planes en grupo y lo que te interesa
 * aparecen solos, y se actualizan cuando alguien se une o el plan se cancela.
 */
export function CalendarSync() {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function connect() {
    setBusy(true);
    const { data } = await (await getClient()).rpc("my_calendar_token");
    setBusy(false);
    if (typeof data === "string") setUrl(`${location.host}/planes/calendario/${data}.ics`);
  }

  const btn = "flex h-10 items-center justify-center gap-1.5 rounded-full border border-line-2 bg-white px-4 text-[14px] font-semibold hover:bg-bg-2";
  return (
    <section className="mt-8 rounded-card bg-bg-2 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink"><SyncIcon size={19} /></span>
        <div>
          <h2 className="text-[16px] font-bold">Tus planes en tu calendario</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">Conéctalo una vez: cada plan al que te unas, y quién más va, aparece solo, con aviso un día antes.</p>
        </div>
      </div>
      {url ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`webcal://${url}`} className={btn}>iPhone / Mac</a>
          <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(`webcal://${url}`)}`} target="_blank" rel="noreferrer" className={btn}>Google Calendar</a>
          <button type="button" className={btn}
            onClick={async () => {
              await navigator.clipboard?.writeText(`${location.protocol}//${url}`).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}>
            {copied ? <><Check size={16} /> Copiado</> : <><Link2 size={16} /> Copiar link</>}
          </button>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={connect} className="mt-3 rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-60">
          {busy ? "Un momento…" : "Conectar calendario"}
        </button>
      )}
    </section>
  );
}
