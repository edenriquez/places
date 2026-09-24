"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Intent } from "./session-provider";

const COPY: Record<Intent["do"] | "default", { title: string; body: string }> = {
  save: { title: "Guarda este evento", body: "Entra para no perdértelo y encontrarlo en cualquier dispositivo." },
  interest: { title: "Dile a los demás que vas", body: "Entra para marcar que te interesa y ver cuánta gente más se anima." },
  default: { title: "Entra a entrelugares", body: "Guarda eventos y marca a cuáles te interesa ir." },
};

export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function GoogleButton({ onClick, className }: { onClick: () => Promise<void> | void; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => { setBusy(true); try { await onClick(); } catch { setBusy(false); } }}
      className={`flex w-full items-center justify-center gap-3 rounded-control border border-line-2 bg-white py-3 text-[15px] font-semibold text-ink hover:bg-bg-2 disabled:opacity-60 ${className ?? ""}`}
    >
      <GoogleIcon /> {busy ? "Abriendo Google…" : "Continuar con Google"}
    </button>
  );
}

/** Hoja inferior en móvil, modal centrado en escritorio. Se abre solo cuando la persona intenta algo que requiere cuenta. */
export function LoginSheet({ intent, onClose, onGoogle }: { intent?: Intent; onClose: () => void; onGoogle: () => Promise<void> }) {
  const copy = COPY[intent?.do ?? "default"];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 lg:items-center" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(e) => e.stopPropagation()}
        className="sheet-in relative w-full max-w-screen-sm rounded-t-[20px] bg-white px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-7 shadow-float lg:max-w-[420px] lg:rounded-card lg:pb-7"
      >
        <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-bg-2">
          <X size={18} />
        </button>
        <h2 id="login-title" className="pr-10 text-[22px] font-bold leading-tight">{copy.title}</h2>
        <p className="mt-2 text-[14px] text-ink-2">{copy.body}</p>
        <GoogleButton onClick={onGoogle} className="mt-6" />
        <p className="mt-4 text-center text-[12px] text-ink-3">
          Sin cuenta puedes seguir explorando todo. Al continuar aceptas el <a href="/privacidad" className="underline">aviso de privacidad</a>.
        </p>
      </section>
    </div>
  );
}
