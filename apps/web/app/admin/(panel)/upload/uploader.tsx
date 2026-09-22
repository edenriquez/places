"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { enqueueUpload } from "../actions";

type Item = { file: File; status: "pending" | "uploading" | "done" | "error"; msg?: string };

async function sha256(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function Uploader({ municipalities }: { municipalities: { cvegeo: string; name: string }[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function addFiles(list: FileList | null) {
    if (!list) return;
    const ok = Array.from(list).filter((f) => /image\/(jpeg|png|webp)/.test(f.type) && f.size <= 15 * 1024 * 1024);
    setItems((prev) => [...prev, ...ok.map((file) => ({ file, status: "pending" as const }))]);
  }

  async function submit() {
    if (!items.length || busy) return;
    setBusy(true);
    const fd = new FormData(formRef.current!);
    const originUrl = String(fd.get("origin") ?? "");
    const municipality = String(fd.get("municipality") ?? "");
    const organizer = String(fd.get("organizer") ?? "");
    const sb = createClient();
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === "done") continue;
      setItems((p) => p.map((it, j) => (j === i ? { ...it, status: "uploading" } : it)));
      try {
        const digest = await sha256(items[i].file);
        const ext = items[i].file.type === "image/png" ? ".png" : items[i].file.type === "image/webp" ? ".webp" : ".jpg";
        const path = `uploads/${digest.slice(0, 2)}/${digest}${ext}`;
        const { error } = await sb.storage.from("flyers").upload(path, items[i].file, { upsert: true, contentType: items[i].file.type });
        if (error) throw error;
        const res = await enqueueUpload({ mediaPath: path, sha256: digest, originUrl, municipality, organizer, filename: items[i].file.name });
        if (!res.ok) throw new Error(res.error);
        setItems((p) => p.map((it, j) => (j === i ? { ...it, status: "done" } : it)));
      } catch (e) {
        setItems((p) => p.map((it, j) => (j === i ? { ...it, status: "error", msg: (e as Error).message } : it)));
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-6 rounded-card border border-line p-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={clsx("grid cursor-pointer place-items-center rounded-card border-2 border-dashed px-6 py-12 text-center transition", drag ? "border-accent bg-accent-soft" : "border-line-2 bg-bg-2/40")}
      >
        <ImagePlus size={36} className="text-ink-2" />
        <p className="mt-3 text-[16px] font-semibold">Arrastra imágenes o haz clic · JPG, PNG, WEBP · varias a la vez</p>
        <p className="mt-1 text-[13px] text-ink-2">Máximo 15 MB por archivo. El OCR y la extracción corren en la Mac.</p>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </div>

      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-control border border-line text-[13px]">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between px-3 py-2">
              <span className="truncate">{it.file.name}</span>
              <span className={clsx("ml-3 shrink-0", it.status === "done" && "text-free", it.status === "error" && "text-error", it.status === "uploading" && "text-ink-2")}>
                {it.status === "pending" && "Listo para subir"}
                {it.status === "uploading" && "Subiendo…"}
                {it.status === "done" && "En cola"}
                {it.status === "error" && (it.msg ?? "Error")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className="text-[13px] font-medium">URL del post de origen
          <input name="origin" type="url" placeholder="https://facebook.com/…" className="mt-1 w-full rounded-control border border-line-2 px-3 py-2.5 text-[14px]" />
        </label>
        <label className="text-[13px] font-medium">Municipio
          <select name="municipality" className="mt-1 w-full rounded-control border border-line-2 bg-white px-3 py-2.5 text-[14px]">
            <option value="">Detectar del flyer</option>
            {municipalities.map((m) => <option key={m.cvegeo} value={m.cvegeo}>{m.name}</option>)}
          </select>
        </label>
        <label className="text-[13px] font-medium">Organizador
          <input name="organizer" placeholder="Ej. Ayuntamiento, Casa de Cultura…" className="mt-1 w-full rounded-control border border-line-2 px-3 py-2.5 text-[14px]" />
        </label>
      </div>

      <div className="mt-5 flex justify-end">
        <button type="submit" disabled={!items.length || busy} className="flex items-center gap-2 rounded-control bg-accent px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />} Encolar {items.filter((i) => i.status !== "done").length || ""}
        </button>
      </div>
    </form>
  );
}
