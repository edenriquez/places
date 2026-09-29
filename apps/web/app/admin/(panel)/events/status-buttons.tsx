"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEventStatus } from "../actions";

export function EventStatusButtons({ id, status, title }: { id: string; status: string; title: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (s: "published" | "pending" | "cancelled") => start(async () => { await setEventStatus(id, s); router.refresh(); });
  // cancelar saca el evento del sitio: separado de las acciones de rutina y con confirmación
  const cancel = () => { if (confirm(`¿Cancelar “${title}”? Deja de mostrarse en el sitio.`)) go("cancelled"); };
  return (
    <div className="flex justify-end gap-2 text-[12px] font-semibold">
      {status !== "published" && <button disabled={pending} onClick={() => go("published")} className="rounded-control border border-ink px-3 py-1.5 disabled:opacity-40">Publicar</button>}
      {status === "published" && <button disabled={pending} onClick={() => go("pending")} className="rounded-control border border-line-2 px-3 py-1.5 disabled:opacity-40">Despublicar</button>}
      {status !== "cancelled" && <button disabled={pending} onClick={cancel} className="ml-1 border-l border-line pl-2 py-1.5 text-error disabled:opacity-40">Cancelar</button>}
    </div>
  );
}
