"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";

const MAX_MB = 15;
const MIN_DESC = 20;

async function sha256(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const input = "mt-1.5 w-full rounded-control border border-line-2 bg-white px-3 py-2.5 text-[15px] outline-none transition focus:border-ink";

/** Flyer + descripción → misma cola que el admin (la Mac lo procesa y queda en revisión). */
export function SubmitForm({ userId, municipalities }: { userId: string; municipalities: { cvegeo: string; name: string; state: string }[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [desc, setDesc] = useState("");
  const [state, setState] = useState<{ kind: "idle" } | { kind: "sending" } | { kind: "error"; msg: string } | { kind: "done" }>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    if (!/image\/(jpeg|png|webp)/.test(f.type)) return setState({ kind: "error", msg: "El flyer debe ser JPG, PNG o WEBP." });
    if (f.size > MAX_MB * 1024 * 1024) return setState({ kind: "error", msg: `El flyer pesa más de ${MAX_MB} MB.` });
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setState({ kind: "idle" });
  }

  async function submit(form: HTMLFormElement) {
    if (!file || desc.trim().length < MIN_DESC || state.kind === "sending") return;
    setState({ kind: "sending" });
    const fd = new FormData(form);
    const sb = createClient();
    try {
      const digest = await sha256(file);
      const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
      const path = `submissions/${userId}/${digest}${ext}`;
      const up = await sb.storage.from("flyers").upload(path, file, { contentType: file.type });
      // si ya lo había subido (reintento), el archivo existe: seguimos con el registro
      if (up.error && !/exists|duplicate/i.test(up.error.message)) throw up.error;
      const { error } = await sb.rpc("submit_flyer", {
        p_media_path: path,
        p_media_sha256: digest,
        p_description: desc,
        p_municipality: String(fd.get("municipality") ?? ""),
        p_organizer: String(fd.get("organizer") ?? ""),
        p_contact: String(fd.get("contact") ?? ""),
        p_link: String(fd.get("link") ?? ""),
        p_filename: file.name,
      });
      if (error) throw new Error(error.code === "23505" ? "Ese flyer ya lo recibimos. Lo verás en tu perfil." : error.message);
      setState({ kind: "done" });
    } catch (e) {
      setState({ kind: "error", msg: (e as Error).message || "No se pudo enviar. Intenta de nuevo." });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="anim-text-in rounded-card border border-line bg-white p-8 text-center">
        <CheckCircle2 size={48} className="anim-heart-pop mx-auto text-free" />
        <h2 className="mt-4 text-[22px] font-bold">¡Recibimos tu evento!</h2>
        <p className="mx-auto mt-2 max-w-[360px] text-[14px] text-ink-2">Lo revisamos y, si todo está en orden, lo publicamos en menos de 48 horas. Puedes ver cómo va en tu perfil.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/perfil" className="rounded-control bg-ink px-5 py-3 text-[14px] font-semibold text-white">Ver en mi perfil</Link>
          <button type="button" onClick={() => { setFile(null); setPreview(null); setDesc(""); setState({ kind: "idle" }); }} className="rounded-control border border-ink px-5 py-3 text-[14px] font-semibold">Enviar otro</button>
        </div>
      </div>
    );
  }

  const byState = municipalities.reduce<Record<string, typeof municipalities>>((acc, m) => ((acc[m.state] ??= []).push(m), acc), {});
  const descOk = desc.trim().length >= MIN_DESC;
  const sending = state.kind === "sending";

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="space-y-5">
      <div>
        <p className="text-[15px] font-semibold">Flyer <span className="text-accent">*</span></p>
        {preview ? (
          <div className="relative mt-2 overflow-hidden rounded-card border border-line bg-bg-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
            <img src={preview} alt="Vista previa del flyer" className="mx-auto max-h-[420px] w-auto object-contain" />
            <button type="button" onClick={() => { setFile(null); setPreview(null); }} aria-label="Quitar flyer" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white shadow-soft"><X size={18} /></button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
            className={clsx("mt-2 grid w-full place-items-center rounded-card border-2 border-dashed px-6 py-12 text-center transition", drag ? "border-accent bg-accent-soft" : "border-line-2 bg-bg-2/40 hover:border-ink")}
          >
            <ImagePlus size={34} className="text-ink-2" />
            <span className="mt-3 block text-[15px] font-semibold">Toca para elegir o arrastra la imagen</span>
            <span className="mt-1 block text-[13px] text-ink-2">JPG, PNG o WEBP · hasta {MAX_MB} MB</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files)} />
      </div>

      <label className="block">
        <span className="text-[15px] font-semibold">¿De qué trata? <span className="text-accent">*</span></span>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="Qué es, fecha y hora, lugar, costo y cualquier detalle que no venga en el flyer."
          className={clsx(input, "resize-y")}
        />
        <span className={clsx("mt-1 block text-right text-[12px]", descOk ? "text-ink-3" : "text-ink-2")}>
          {descOk ? `${desc.length}/4000` : `Mínimo ${MIN_DESC} caracteres (${desc.trim().length})`}
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[14px] font-medium">Municipio</span>
          <select name="municipality" defaultValue="" className={input}>
            <option value="">No sé / varios</option>
            {Object.entries(byState).map(([st, ms]) => (
              <optgroup key={st} label={st}>{ms.map((m) => <option key={m.cvegeo} value={m.cvegeo}>{m.name}</option>)}</optgroup>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[14px] font-medium">Quién organiza</span>
          <input name="organizer" maxLength={120} placeholder="Colectivo, negocio o tu nombre" className={input} />
        </label>
        <label className="block">
          <span className="text-[14px] font-medium">Teléfono o WhatsApp de contacto</span>
          <input name="contact" type="tel" maxLength={40} placeholder="55 1234 5678" className={input} />
        </label>
        <label className="block">
          <span className="text-[14px] font-medium">Link (Instagram, Facebook, sitio)</span>
          <input name="link" type="url" maxLength={500} placeholder="https://" className={input} />
        </label>
      </div>

      {state.kind === "error" && <p className="rounded-control bg-accent-soft px-3 py-2.5 text-[14px] text-accent">{state.msg}</p>}

      <button
        type="submit"
        disabled={!file || !descOk || sending}
        className="flex w-full items-center justify-center gap-2 rounded-control bg-accent py-3.5 text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {sending ? <><Loader2 size={18} className="animate-spin" /> Enviando…</> : "Enviar para revisión"}
      </button>
      <p className="text-center text-[12px] text-ink-3">Publicar es gratis. Revisamos cada envío antes de que aparezca.</p>
    </form>
  );
}
