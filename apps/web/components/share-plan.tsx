import clsx from "clsx";
import { CalendarPlus, MessageCircle } from "lucide-react";
import { fmtWhenShort } from "@/lib/format";
import { eventUrl, facebookShare, whatsappShare } from "@/lib/plans";
import { SITE_URL } from "@/lib/site";
import type { NearRow } from "@/lib/types";

export function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V10.5H7.8v3h2.6V21h3.1Z" />
    </svg>
  );
}

type P = Pick<NearRow, "event_id" | "slug" | "title" | "starts_at" | "is_all_day" | "municipality_name">;

export const planShareText = (p: P) =>
  `¿Vamos? ${p.title} · ${fmtWhenShort(p.starts_at, p.is_all_day)} en ${p.municipality_name} ${eventUrl(SITE_URL, p.slug, "whatsapp")}`;

/** Un toque para mandarlo al grupo: WhatsApp, Facebook o al calendario (con aviso un día antes). */
export function SharePlan({ p, className, labels }: { p: P; className?: string; labels?: boolean }) {
  const btn = "flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold";
  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <a href={whatsappShare(planShareText(p))} target="_blank" rel="noreferrer" data-track="share_whatsapp" data-event={p.event_id}
        aria-label="Compartir por WhatsApp" className={clsx(btn, "bg-whatsapp text-white", labels ? "px-3.5" : "w-9")}>
        <MessageCircle size={16} />{labels && "WhatsApp"}
      </a>
      <a href={facebookShare(eventUrl(SITE_URL, p.slug, "facebook"))} target="_blank" rel="noreferrer"
        aria-label="Compartir en Facebook" className={clsx(btn, "bg-[#1877f2] text-white", labels ? "px-3.5" : "w-9")}>
        <FacebookIcon />{labels && "Facebook"}
      </a>
      <a href={`/evento/${p.slug}/calendario`} aria-label="Agregar al calendario"
        className={clsx(btn, "border border-line bg-white text-ink", labels ? "px-3.5" : "w-9")}>
        <CalendarPlus size={16} />{labels && "Calendario"}
      </a>
    </div>
  );
}
