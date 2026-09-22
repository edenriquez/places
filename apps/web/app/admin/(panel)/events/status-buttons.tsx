"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEventStatus } from "../actions";

export function EventStatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (s: "published" | "pending" | "cancelled") => start(async () => { await setEventStatus(id, s); router.refresh(); });
  return (
    <div className="flex justify-end gap-2 text-[12px] font-semibold">
      {status !== "published" && <button disabled={pending} onClick={() => go("published")} className="rounded-control border border-ink px-3 py-1.5">Publicar</button>}
      {status === "published" && <button disabled={pending} onClick={() => go("pending")} className="rounded-control border border-line-2 px-3 py-1.5">Despublicar</button>}
      {status !== "cancelled" && <button disabled={pending} onClick={() => go("cancelled")} className="px-2 py-1.5 text-ink-2 underline">Cancelar</button>}
    </div>
  );
}
