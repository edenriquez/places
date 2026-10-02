"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quickApproveIngestion, quickRejectIngestion } from "../actions";

export function QuickReviewActions({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"approve" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function approve() {
    setError(null);
    setAction("approve");
    start(async () => {
      const res = await quickApproveIngestion(id);
      if (!res.ok) setError(res.error);
      else router.refresh();
      setAction(null);
    });
  }

  function discard() {
    if (!confirm(`¿Descartar “${title}”?`)) return;
    setError(null);
    setAction("discard");
    start(async () => {
      const res = await quickRejectIngestion(id);
      if (!res.ok) setError(res.error);
      else router.refresh();
      setAction(null);
    });
  }

  return (
    <div className="border-t border-line px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" disabled={pending} onClick={discard} className="rounded-control px-2 py-1.5 text-[13px] font-semibold text-error disabled:opacity-40">
          {action === "discard" ? "…" : "Descartar"}
        </button>
        <button type="button" disabled={pending} onClick={approve} className="rounded-control bg-accent px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40">
          {action === "approve" ? "…" : "Aprobar"}
        </button>
      </div>
      {error && <p className="mt-1 text-[12px] text-error">{error}</p>}
    </div>
  );
}
