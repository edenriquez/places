"use client";

import { useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { CalendarPlus, Check, Link2, MessageCircle, Share } from "lucide-react";
import { planInviteText, planUrl, type GroupPlan } from "@/lib/group-plans";
import { whatsappShare } from "@/lib/plans";

type P = Pick<GroupPlan, "id" | "target" | "starts_at" | "is_all_day" | "meeting_point"> & { code: string };

const noop = () => () => {};
/** El menú de compartir del sistema existe en teléfonos; en escritorio casi nunca. Falso al renderizar en el servidor. */
const useCanShare = () => useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);

/** Invitar a conocidos: WhatsApp, el menú de compartir del teléfono (o copiar el link) y agregarlo al calendario. */
export function PlanShare({ p, className, compact }: { p: P; className?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const canShare = useCanShare();
  const text = planInviteText(p, p.code);
  const btn = "flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold";
  return (
    <div className={clsx("flex flex-wrap items-center gap-2", className)}>
      <a href={whatsappShare(text)} target="_blank" rel="noreferrer" data-track="plan_invite" data-label="whatsapp"
        className={clsx(btn, "bg-whatsapp text-white")}>
        <MessageCircle size={17} /> Invitar por WhatsApp
      </a>
      <button
        type="button"
        data-track="plan_invite"
        data-label={canShare ? "share" : "link"}
        onClick={async () => {
          if (canShare) {
            await navigator.share({ title: p.target.title, text }).catch(() => {});
            return;
          }
          await navigator.clipboard?.writeText(planUrl(p.code, "link")).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className={clsx(btn, "border border-line-2 bg-white text-ink hover:bg-bg-2")}
      >
        {copied ? <><Check size={16} /> Copiado</> : canShare ? <><Share size={16} /> Compartir</> : <><Link2 size={16} /> Copiar link</>}
      </button>
      {!compact && (
        <a href={`/plan/${p.code}/calendario`} className={clsx(btn, "border border-line-2 bg-white text-ink hover:bg-bg-2")}>
          <CalendarPlus size={16} /> Calendario
        </a>
      )}
    </div>
  );
}
