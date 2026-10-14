"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Trash2 } from "lucide-react";
import { deleteExperience, setExperienceStatus } from "./actions";

export function ExperienceStatusButtons({ id, status, title }: { id: string; status: string; title: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (s: "draft" | "published" | "archived") => start(async () => {
    const r = await setExperienceStatus(id, s);
    if (!r.ok) alert(r.error);
    router.refresh();
  });
  const remove = () => {
    if (!confirm(`¿Borrar “${title}” para siempre? Se quitan sus fotos y los planes en grupo hechos sobre ella; sus salidas quedan como eventos sueltos. No se puede deshacer.`)) return;
    start(async () => {
      const r = await deleteExperience(id);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  };
  const archive = () => { if (confirm(`¿Archivar “${title}”? Deja de mostrarse en el sitio.`)) go("archived"); };
  return (
    <div className="flex items-center justify-end gap-2 text-[12px] font-semibold">
      {status !== "published" && <button disabled={pending} onClick={() => go("published")} className="rounded-control border border-ink px-3 py-1.5 disabled:opacity-40">Publicar</button>}
      {status === "published" && <button disabled={pending} onClick={() => go("draft")} className="rounded-control border border-line-2 px-3 py-1.5 disabled:opacity-40">Despublicar</button>}
      {status !== "archived" && (
        <button disabled={pending} onClick={archive} aria-label="Archivar" title="Archivar" className="grid h-8 w-8 place-items-center rounded-control border border-line-2 text-ink-2 hover:text-ink disabled:opacity-40"><Archive size={15} aria-hidden /></button>
      )}
      <button disabled={pending} onClick={remove} aria-label="Borrar" title="Borrar" className="grid h-8 w-8 place-items-center rounded-control border border-line-2 text-error hover:border-error disabled:opacity-40"><Trash2 size={15} aria-hidden /></button>
    </div>
  );
}
