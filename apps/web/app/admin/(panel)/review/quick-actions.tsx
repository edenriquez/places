"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import clsx from "clsx";
import { quickApproveIngestion, quickRejectIngestion } from "../actions";

type Busy = "approve" | "discard";
type Done = "approved" | "discarded";

export function QuickReviewActions({ id, blocked }: { id: string; blocked?: string | null }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<Busy | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function run(kind: Busy) {
    setError(null);
    setBusy(kind);
    start(async () => {
      const res = kind === "approve" ? await quickApproveIngestion(id) : await quickRejectIngestion(id);
      if (!res.ok) {
        setBusy(null);
        setError(res.error);
        return;
      }
      setDone(kind === "approve" ? "approved" : "discarded");
      router.refresh();
    });
  }

  if (done) {
    const approved = done === "approved";
    return (
      <div className="border-t border-line px-3 py-2.5" aria-live="polite">
        <p className={clsx(
          "anim-text-in inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
          approved ? "bg-free-bg text-free" : "bg-bg-2 text-ink-3",
        )}>
          <Check size={13} strokeWidth={2.5} aria-hidden />
          {approved ? "Publicado" : "Descartado"}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-line px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={pending}
          aria-busy={busy === "discard"}
          onClick={() => run("discard")}
          className="flex h-8 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-control border border-line-2 px-3 text-[13px] font-semibold text-error transition-[background-color,transform,opacity] duration-200 hover:bg-[#fde8e5] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          {busy === "discard" && <Loader2 size={14} className="animate-spin" aria-hidden />}
          <span key={busy === "discard" ? "discarding" : "discard"} className={clsx(busy === "discard" && "anim-text-in")}>
            {busy === "discard" ? "Descartando" : "Descartar"}
          </span>
        </button>
        <button
          type="button"
          disabled={pending || !!blocked}
          aria-busy={busy === "approve"}
          onClick={() => run("approve")}
          className="flex h-8 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-control bg-accent px-3 text-[13px] font-semibold text-white transition-[filter,transform,opacity] duration-200 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          {busy === "approve" && <Loader2 size={14} className="animate-spin" aria-hidden />}
          <span key={busy === "approve" ? "approving" : "approve"} className={clsx(busy === "approve" && "anim-text-in")}>
            {busy === "approve" ? "Aprobando" : "Aprobar"}
          </span>
        </button>
      </div>
      {error ? (
        <p key={error} role="status" className="anim-text-in mt-1.5 text-[12px] leading-snug text-error">{error}</p>
      ) : blocked ? (
        <p className="mt-1.5 text-right text-[12px] text-ink-3">{blocked}</p>
      ) : null}
    </div>
  );
}
