"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { flyerUrl } from "@/lib/format";

const MAX = 10;

async function sha256(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Fotos de la experiencia en orden: la primera es la portada (tarjetas y primera del carrusel). */
export function PhotosEditor({ folder, value, onChange }: { folder: string; value: string[]; onChange: (paths: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const room = MAX - value.length;

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const bad = files.find((f) => !/image\/(jpeg|png|webp)/.test(f.type) || f.size > 15 * 1024 * 1024);
    if (bad) return setErr(`${bad.name}: JPG, PNG o WEBP de hasta 15 MB`);
    if (files.length > room) return setErr(`Caben ${room} foto${room === 1 ? "" : "s"} más (máximo ${MAX}).`);
    setBusy(true);
    setErr(null);
    const sb = createClient();
    const added: string[] = [];
    try {
      for (const file of files) {
        const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
        const path = `experiences/${folder}/${(await sha256(file)).slice(0, 16)}${ext}`;
        const { error } = await sb.storage.from("flyers").upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        added.push(path);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      if (added.length) onChange([...new Set([...value, ...added])]);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function move(i: number, d: -1 | 1) {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  }

  return (
    <section className="rounded-card border border-line p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold">Fotos</h2>
        <span className="text-[12px] tabular-nums text-ink-3">{value.length}/{MAX}</span>
      </div>
      <p className="mt-0.5 text-[13px] text-ink-2">La primera es la portada. En la página se ven en carrusel.</p>
      <ul className="mt-3 grid grid-cols-4 gap-2">
        {value.map((p, i) => (
          <li key={p} className="relative aspect-square overflow-hidden rounded-[10px] bg-bg-2">
            <Image src={flyerUrl(p)!} alt="" fill sizes="100px" className="object-cover" />
            {i === 0 && <span className="absolute inset-x-1 top-1 rounded-full bg-black/60 py-0.5 text-center text-[10px] font-semibold text-white">Portada</span>}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== p))} aria-label={`Quitar foto ${i + 1}`} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/95 text-ink shadow-soft">
              <X size={13} />
            </button>
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Mover foto ${i + 1} antes`} className="grid h-6 w-6 place-items-center rounded-full bg-white/95 text-ink shadow-soft disabled:invisible"><ChevronLeft size={13} /></button>
              <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Mover foto ${i + 1} después`} className="grid h-6 w-6 place-items-center rounded-full bg-white/95 text-ink shadow-soft disabled:invisible"><ChevronRight size={13} /></button>
            </div>
          </li>
        ))}
        {room > 0 && (
          <li>
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line-2 text-[12px] font-semibold text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50">
              {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ImagePlus size={18} aria-hidden />}
              {busy ? "Subiendo…" : "Agregar"}
            </button>
          </li>
        )}
      </ul>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
    </section>
  );
}
