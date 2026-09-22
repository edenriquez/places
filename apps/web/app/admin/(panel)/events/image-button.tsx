"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setEventImage } from "../actions";

async function sha256(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function EventImageButton({ eventId, hasImage }: { eventId: string; hasImage: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!/image\/(jpeg|png|webp)/.test(file.type) || file.size > 15 * 1024 * 1024) {
      setErr("JPG, PNG o WEBP de hasta 15 MB");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const digest = await sha256(file);
      const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
      const path = `events/${eventId}/${digest.slice(0, 16)}${ext}`;
      const { error } = await createClient().storage.from("flyers").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const res = await setEventImage(eventId, path);
      if (!res.ok) throw new Error(res.error);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1 rounded-control border border-line-2 px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40"
        title={hasImage ? "Cambiar imagen" : "Subir imagen"}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
        {hasImage ? "Cambiar" : "Imagen"}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {err && <span className="mt-1 text-[11px] text-error">{err}</span>}
    </span>
  );
}
