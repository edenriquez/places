"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { runSourceNow, toggleSource } from "../actions";

export function SourceActions({ id, enabled }: { id: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex justify-end gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => { await runSourceNow(id); router.refresh(); })} className="rounded-control border border-ink px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40">Correr ahora</button>
      <button type="button" disabled={pending} onClick={() => start(async () => { await toggleSource(id, !enabled); router.refresh(); })} className="rounded-control px-2 py-1.5 text-[12px] text-ink-2 underline">{enabled ? "Pausar" : "Activar"}</button>
    </div>
  );
}
