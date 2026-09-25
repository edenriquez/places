"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { flyerUrl } from "@/lib/format";
import { ZoomableImage } from "@/components/image-viewer";
import { CATEGORY_LABEL, type Category, type Event, type Occurrence, type RawIngestion } from "@/lib/types";
import { approveIngestion, markDuplicate, rejectIngestion, saveCorrection } from "../../actions";

type Extraction = {
  title?: string; dates?: { date: string; start_time?: string | null; end_time?: string | null; note?: string | null }[];
  place_text?: string | null; municipality?: string | null; price_min?: number | null; price_max?: number | null;
  is_free?: boolean | null; organizer?: string | null; category?: string; description?: string | null; confidence?: number;
};
type DateRow = { date: string; start: string; end: string };

const TZ = "America/Mexico_City";
function localDate(iso: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso)); }
// el modelo suele dejar "Salida desde X" en la nota de la fecha
function departureFromNotes(ex: Extraction) {
  for (const d of ex.dates ?? []) {
    const m = d.note?.match(/salida\s+(?:desde|de)\s+([^,.;]+)/i);
    if (m) return m[1].trim();
  }
  return "";
}
// primer teléfono de 10 dígitos que aparezca en el OCR (con o sin espacios/guiones, con o sin +52)
function phoneFromOcr(text: string | null) {
  const m = text?.match(/(?:\+?52[\s-]?)?(?:\(?\d{2,3}\)?[\s.-]?)\d{3,4}[\s.-]?\d{4}/);
  const d = m?.[0].replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "") ?? "";
  return d.length === 10 ? d : "";
}
// "@usuario" tal cual aparece; el servidor lo convierte a URL
function handleFromUrl(url: string | null | undefined, re: RegExp) {
  return url?.match(re)?.[1] ? `@${url.match(re)![1]}` : url ?? "";
}
function localTime(iso: string) { return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)); }

export function ReviewForm({ ingestion, event, organizerName, occurrences, municipalities, places, candidates }: {
  ingestion: RawIngestion & { sources: { name: string; url: string | null } | null };
  event: Event | null;
  organizerName: string | null;
  occurrences: Occurrence[];
  municipalities: { cvegeo: string; name: string }[];
  places: { id: string; name: string; kind: string }[];
  candidates: { id: string; title: string; slug: string; status: string }[];
}) {
  const ex = (ingestion.extraction ?? {}) as Extraction;
  const [title, setTitle] = useState(event?.title ?? ex.title ?? "");
  const [category, setCategory] = useState<Category>((event?.category ?? (ex.category as Category) ?? "otro"));
  const [description, setDescription] = useState(event?.description ?? ex.description ?? "");
  const [municipality, setMunicipality] = useState(event?.municipality_cvegeo ?? ingestion.municipality_hint ?? "");
  const [placeText, setPlaceText] = useState(event?.place_text ?? ex.place_text ?? "");
  const [departureText, setDepartureText] = useState(event?.departure_text ?? departureFromNotes(ex));
  const [contactPhone, setContactPhone] = useState(event?.contact_phone || phoneFromOcr(String(ingestion.payload?.contact ?? "")) || phoneFromOcr(ingestion.ocr_text));
  const [contactWhatsapp, setContactWhatsapp] = useState(event?.contact_whatsapp ?? true);
  const [instagram, setInstagram] = useState(handleFromUrl(event?.instagram_url, /instagram\.com\/([\w.]+)\/?$/));
  const [facebook, setFacebook] = useState(event?.facebook_url ?? "");
  const [tiktok, setTiktok] = useState(handleFromUrl(event?.tiktok_url, /tiktok\.com\/@([\w.]+)\/?$/));
  const [website, setWebsite] = useState(event?.website_url ?? "");
  const [placeId, setPlaceId] = useState<string | null>(event?.place_id ?? null);
  const [isFree, setIsFree] = useState<boolean>(event?.is_free ?? ex.is_free ?? false);
  const [priceMin, setPriceMin] = useState<string>(event?.price_min?.toString() ?? ex.price_min?.toString() ?? "");
  const [priceMax, setPriceMax] = useState<string>(event?.price_max?.toString() ?? ex.price_max?.toString() ?? "");
  const [organizer, setOrganizer] = useState(organizerName ?? ingestion.organizer_hint ?? ex.organizer ?? "");
  const [dates, setDates] = useState<DateRow[]>(
    occurrences.length
      ? occurrences.map((o) => ({ date: localDate(o.starts_at), start: o.is_all_day ? "" : localTime(o.starts_at), end: o.ends_at ? localTime(o.ends_at) : "" }))
      : (ex.dates ?? []).map((d) => ({ date: d.date, start: d.start_time?.slice(0, 5) ?? "", end: d.end_time?.slice(0, 5) ?? "" })),
  );
  const [dup, setDup] = useState("");
  const [ocrOpen, setOcrOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const placeSuggestions = useMemo(() => {
    const q = placeText.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!q || placeId) return [];
    return places.filter((p) => p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q.split(" ")[0] ?? q)).slice(0, 6);
  }, [placeText, placeId, places]);
  const selectedPlace = places.find((p) => p.id === placeId);
  const url = flyerUrl(ingestion.media_path);
  const conf = ingestion.confidence ?? ex.confidence ?? 0;

  function payload() {
    return {
      ingestionId: ingestion.id, eventId: event?.id ?? ingestion.event_id ?? null, title, category, description,
      placeId, placeText, departureText, municipality, isFree,
      contactPhone, contactWhatsapp, instagram, facebook, tiktok, website,
      priceMin: priceMin ? Number(priceMin) : null, priceMax: priceMax ? Number(priceMax) : null,
      organizer, dates,
    };
  }
  const published = event?.status === "published";
  const valid = title.trim().length >= 3 && municipality && dates.some((d) => d.date);

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,460px)_1fr]">
      <div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-line bg-bg-2">
          {url && (
            <ZoomableImage src={url} alt="Flyer">
              <Image src={url} alt="" fill sizes="460px" className="object-contain" />
            </ZoomableImage>
          )}
        </div>
        <p className="mt-1 text-[12px] text-ink-3">Toca el flyer para verlo a tamaño real.</p>
        <p className="mt-3 text-[12px] text-ink-2">
          {ingestion.sources?.name ?? "manual"} · {new Date(ingestion.received_at).toLocaleString("es-MX")}
          {ingestion.origin_url && <> · <a href={ingestion.origin_url} target="_blank" rel="noreferrer" className="underline">{ingestion.origin_url.replace(/^https?:\/\//, "").slice(0, 48)}…</a></>}
        </p>
        <button type="button" onClick={() => setOcrOpen((v) => !v)} className="mt-3 text-[13px] font-semibold underline">
          {ocrOpen ? "Ocultar" : "Ver"} texto OCR ({ingestion.ocr_engine ?? "—"})
        </button>
        {ocrOpen && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-control bg-bg-2 p-3 font-mono text-[12px] text-ink-2">{ingestion.ocr_text ?? "(vacío)"}</pre>}
      </div>

      <div className="space-y-4 pb-24">
        <div>
          <div className="flex items-center justify-between text-[12px] text-ink-2"><span>Confianza de la extracción</span><span>{conf.toFixed(2)}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-2"><div className={clsx("h-full rounded-full", conf >= 0.8 ? "bg-free" : conf >= 0.5 ? "bg-warn" : "bg-error")} style={{ width: `${Math.round(conf * 100)}%` }} /></div>
        </div>

        <Field label="Título">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>

        <Field label="Categoría">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={clsx("rounded-full border px-3 py-1.5 text-[13px] font-medium", category === c ? "border-ink bg-ink text-white" : "border-line-2")}>{CATEGORY_LABEL[c]}</button>
            ))}
          </div>
        </Field>

        <Field label="Fechas">
          <div className="space-y-2">
            {dates.map((d, i) => (
              <div key={i} className="grid grid-cols-[1fr_110px_110px_36px] items-center gap-2">
                <input type="date" value={d.date} onChange={(e) => setDates((p) => p.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className={inputCls} />
                <input type="time" value={d.start} onChange={(e) => setDates((p) => p.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className={inputCls} placeholder="inicio" />
                <input type="time" value={d.end} onChange={(e) => setDates((p) => p.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className={inputCls} placeholder="fin" />
                <button type="button" onClick={() => setDates((p) => p.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-control border border-line text-ink-2"><Trash2 size={16} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setDates((p) => [...p, { date: p.at(-1)?.date ?? "", start: "", end: "" }])} className="flex items-center gap-1 text-[13px] font-semibold underline"><Plus size={14} /> Agregar fecha</button>
          </div>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Municipio">
            <select value={municipality} onChange={(e) => { setMunicipality(e.target.value); setPlaceId(null); }} className={inputCls}>
              <option value="">Elegir…</option>
              {municipalities.map((m) => <option key={m.cvegeo} value={m.cvegeo}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Organizador">
            <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} className={inputCls} placeholder="Ayuntamiento, casa de cultura…" />
          </Field>
        </div>

        <Field label="Salida desde (opcional, para viajes)">
          <input value={departureText} onChange={(e) => setDepartureText(e.target.value)} className={inputCls} placeholder="Ej. Tepetlixpa · el lugar pasa a ser el destino" />
        </Field>

        <Field label={departureText ? "Destino" : "Lugar"}>
          <input value={placeText} onChange={(e) => { setPlaceText(e.target.value); setPlaceId(null); }} className={inputCls} placeholder="Como aparece en el flyer" />
          {selectedPlace && (
            <p className="mt-1 flex items-center gap-2 text-[13px]">
              <span className="rounded-full bg-free-bg px-2 py-0.5 font-semibold text-free">Vinculado</span> {selectedPlace.name}
              <button type="button" onClick={() => setPlaceId(null)} className="text-ink-2 underline">quitar</button>
            </p>
          )}
          {placeSuggestions.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-control border border-line text-[13px]">
              {placeSuggestions.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setPlaceId(p.id)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-bg-2">
                    <span>{p.name}</span><span className="text-ink-3">{p.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>

        <Field label="Precio">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} /> Gratis</label>
            {!isFree && (
              <>
                <input type="number" min={0} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="Desde $" className={clsx(inputCls, "w-32")} />
                <input type="number" min={0} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="Hasta $" className={clsx(inputCls, "w-32")} />
              </>
            )}
          </div>
        </Field>

        <Field label="Contacto">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Teléfono · 55 1234 5678" className={clsx(inputCls, "w-56")} />
              <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.checked)} /> Tiene WhatsApp</label>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram · @usuario o URL" className={inputCls} />
              <input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Facebook · página o URL" className={inputCls} />
              <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="TikTok · @usuario o URL" className={inputCls} />
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Sitio web" className={inputCls} />
            </div>
          </div>
        </Field>

        <Field label="Descripción">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputCls} />
        </Field>

        <Field label="¿Es duplicado de otro evento?">
          <div className="flex gap-2">
            <select value={dup} onChange={(e) => setDup(e.target.value)} className={inputCls}>
              <option value="">Elegir evento existente…</option>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.status})</option>)}
            </select>
            <button type="button" disabled={!dup || pending} onClick={() => start(async () => { await markDuplicate(ingestion.id, event?.id ?? null, dup); })} className="shrink-0 rounded-control border border-ink px-3 text-[13px] font-semibold disabled:opacity-40">Marcar duplicado</button>
          </div>
        </Field>

        {msg && <p className="text-[13px] text-free">{msg}</p>}

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-6 py-3 backdrop-blur md:left-[240px]">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-end gap-2">
            <button type="button" disabled={pending} onClick={() => start(async () => { await rejectIngestion(ingestion.id, event?.id ?? null); })} className="rounded-control px-4 py-2.5 text-[14px] font-semibold text-error">Descartar</button>
            {published ? (
              <>
                <a href={`/evento/${event!.slug}`} target="_blank" rel="noreferrer" className="rounded-control px-4 py-2.5 text-[14px] font-semibold underline">Ver evento</a>
                <button type="button" disabled={pending || !valid} onClick={() => start(async () => { await saveCorrection(payload()); setMsg("Cambios publicados."); })} className="rounded-control bg-accent px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40">Guardar cambios</button>
              </>
            ) : (
              <>
                <button type="button" disabled={pending || !valid} onClick={() => start(async () => { await saveCorrection(payload()); setMsg("Corrección guardada."); })} className="rounded-control border border-ink px-4 py-2.5 text-[14px] font-semibold disabled:opacity-40">Guardar corrección</button>
                <button type="button" disabled={pending || !valid} onClick={() => start(async () => { await approveIngestion(payload()); })} className="rounded-control bg-accent px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40">Aprobar y publicar</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-control border border-line-2 bg-white px-3 py-2 text-[14px] focus:border-ink focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-2">{label}</label>
      {children}
    </div>
  );
}
