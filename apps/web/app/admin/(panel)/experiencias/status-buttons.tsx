"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setExperienceStatus } from "./actions";

export function ExperienceStatusButtons({ id, status, title }: { id: string; status: string; title: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (s: "draft" | "published" | "archived") => start(async () => {
    const r = await setExperienceStatus(id, s);
    if (!r.ok) alert(r.error);
    router.refresh();
  });
  const archive = () => { if (confirm(`¿Archivar “${title}”? Deja de mostrarse en el sitio.`)) go("archived"); };
  return (
    <div className="flex justify-end gap-2 text-[12px] font-semibold">
      {status !== "published" && <button disabled={pending} onClick={() => go("published")} className="rounded-control border border-ink px-3 py-1.5 disabled:opacity-40">Publicar</button>}
      {status === "published" && <button disabled={pending} onClick={() => go("draft")} className="rounded-control border border-line-2 px-3 py-1.5 disabled:opacity-40">Despublicar</button>}
      {status !== "archived" && <button disabled={pending} onClick={archive} className="ml-1 border-l border-line py-1.5 pl-2 text-error disabled:opacity-40">Archivar</button>}
    </div>
  );
}
