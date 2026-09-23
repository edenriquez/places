"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelJob, retryJob } from "../actions";
import type { JobStatus } from "@/lib/types";

export function JobActions({ id, status, cancelRequested }: { id: string; status: JobStatus; cancelRequested: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  return (
    <div className="flex justify-end gap-2 text-[12px] font-semibold">
      {(status === "queued" || status === "running") && (
        <button type="button" disabled={pending || cancelRequested} onClick={() => run(() => cancelJob(id))} className="rounded-control border border-line-2 px-3 py-1.5 disabled:opacity-40">
          {cancelRequested ? "Cancelando…" : "Cancelar"}
        </button>
      )}
      {(status === "failed" || status === "cancelled" || status === "done") && (
        <button type="button" disabled={pending} onClick={() => run(() => retryJob(id))} className="rounded-control border border-ink px-3 py-1.5 disabled:opacity-40">
          {status === "done" ? "Repetir" : "Reintentar"}
        </button>
      )}
    </div>
  );
}
