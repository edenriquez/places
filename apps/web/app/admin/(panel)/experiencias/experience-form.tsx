"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { DIFFICULTY_LABEL, EXPERIENCE_KINDS, type Difficulty, type ExperienceKind } from "@/lib/experiences";
import { flyerUrl, fmtPrice } from "@/lib/format";
import { PLACE_KIND_LABEL, type Experience } from "@/lib/types";
import { ImageFocus, type Focus } from "../review/[id]/image-focus";
import { saveExperience, type ExperienceInput } from "./actions";
import { PhotosEditor } from "./photos-editor";

type PlaceOpt = { id: string; name: string; kind: string };
const NEW_PLACE_KINDS = ["parque_ecoturistico", "cascada", "sendero", "mirador", "bosque", "rancho", "vinedo", "taller", "parque", "zona_arqueologica", "templo", "mercado", "otro"];
const EVENT_STATUS: Record<string, string> = { published: "publicado", pending: "en revisión", rejected: "descartado", cancelled: "cancelado" };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const localDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date(iso)) : "");
const handle = (url: string | null, re: RegExp) => (url?.match(re)?.[1] ? `@${url.match(re)![1]}` : url ?? "");

export function ExperienceForm({ experience, placeName, organizerName, municipalities, outings }: {
  experience: Experience | null;
  placeName: string | null;
  organizerName: string | null;
  municipalities: { cvegeo: string; name: string }[];
  outings: { id: string; title: string; slug: string; status: string; next: string | null }[];
}) {
  const x = experience;
  const router = useRouter();
  const [folder] = useState(() => x?.id ?? crypto.randomUUID());
  const [title, setTitle] = useState(x?.title ?? "");
  const [kind, setKind] = useState<ExperienceKind | "">(x?.kind ?? "");
  const [description, setDescription] = useState(x?.description ?? "");
  const [municipality, setMunicipality] = useState(x?.municipality_cvegeo ?? "");
  const [places, setPlaces] = useState<PlaceOpt[]>([]);
  const [placeId, setPlaceId] = useState<string | null>(x?.place_id ?? null);
  const [placeText, setPlaceText] = useState(placeName ?? x?.place_text ?? "");
  const [newPlaceKind, setNewPlaceKind] = useState<string | null>(null);
  const [point, setPoint] = useState("");
  const [organizer, setOrganizer] = useState(organizerName ?? "");
  const [durationText, setDurationText] = useState(x?.duration_text ?? "");
  const [distanceKm, setDistanceKm] = useState(x?.distance_km?.toString() ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(x?.difficulty ?? null);
  const [isFree, setIsFree] = useState(x?.is_free ?? false);
  const [priceMin, setPriceMin] = useState(x?.price_min?.toString() ?? "");
  const [priceMax, setPriceMax] = useState(x?.price_max?.toString() ?? "");
  const [priceNote, setPriceNote] = useState(x?.price_note ?? "");
  const [availabilityText, setAvailabilityText] = useState(x?.availability_text ?? "Todos los días");
  const [hours, setHours] = useState<{ days: string; time: string }[]>(x?.hours?.length ? x.hours : [{ days: "Todos los días", time: "" }]);
  const [seasonText, setSeasonText] = useState(x?.season_text ?? "");
  const [bring, setBring] = useState((x?.bring ?? []).join("\n"));
  const [contactPhone, setContactPhone] = useState(x?.contact_phone ?? "");
  const [contactWhatsapp, setContactWhatsapp] = useState(x?.contact_whatsapp ?? true);
  const [bookingNote, setBookingNote] = useState(x?.booking_note ?? "");
  const [website, setWebsite] = useState(x?.website_url ?? "");
  const [instagram, setInstagram] = useState(handle(x?.instagram_url ?? null, /instagram\.com\/([\w.]+)\/?$/));
  const [facebook, setFacebook] = useState(x?.facebook_url ?? "");
  const [photos, setPhotos] = useState<string[]>(x ? [x.image_path, ...(x.gallery_paths ?? [])].filter((p): p is string => !!p) : []);
  const [focus, setFocus] = useState<Focus>({ x: x?.image_focus_x ?? 50, y: x?.image_focus_y ?? 50 });
  const [verifiedAt, setVerifiedAt] = useState(localDate(x?.verified_at ?? null) || localDate(new Date().toISOString()));
  const [validUntil, setValidUntil] = useState(x?.valid_until ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // lugares del municipio para autocompletar (lectura pública del catálogo)
  useEffect(() => {
    if (!municipality) return;
    let live = true;
    createClient().from("places_view").select("id,name,kind").eq("municipality_cvegeo", municipality).order("name").limit(2000)
      .then(({ data }) => { if (live) setPlaces((data ?? []) as PlaceOpt[]); });
    return () => { live = false; };
  }, [municipality]);

  const suggestions = useMemo(() => {
    const q = norm(placeText.trim());
    if (q.length < 2 || placeId) return [];
    return places.filter((p) => norm(p.name).includes(q)).slice(0, 6);
  }, [placeText, placeId, places]);
  const selectedPlace = places.find((p) => p.id === placeId) ?? (placeId && placeName ? { id: placeId, name: placeName, kind: "" } : null);
  const cover = flyerUrl(photos[0] ?? null);
  const status = x?.status ?? "draft";
  const valid = title.trim().length >= 3 && !!kind && !!municipality;

  function payload(next: ExperienceInput["status"]): ExperienceInput {
    return {
      id: x?.id ?? null, title, kind, description, municipality, placeId, placeText,
      newPlaceKind: placeId ? null : newPlaceKind, point, organizer, durationText,
      distanceKm: distanceKm ? Number(distanceKm) : null, difficulty, isFree,
      priceMin: priceMin ? Number(priceMin) : null, priceMax: priceMax ? Number(priceMax) : null, priceNote,
      availabilityText, hours, seasonText, bring: bring.split("\n"), contactPhone, contactWhatsapp, bookingNote,
      website, instagram, facebook, photos, imageFocusX: focus.x, imageFocusY: focus.y, verifiedAt, validUntil, status: next,
    };
  }

  function save(next: ExperienceInput["status"], okText: string) {
    start(async () => {
      const r = await saveExperience(payload(next));
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: okText });
      if (!x) router.replace(`/admin/experiencias/${r.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-5">
        <PhotosEditor folder={folder} value={photos} onChange={setPhotos} />
        {cover && (
          <ImageFocus
            src={cover} value={focus} onChange={setFocus}
            title={title || "Nombre de la experiencia"} when={availabilityText || "Cualquier día"}
            place={[selectedPlace?.name ?? placeText, municipalities.find((m) => m.cvegeo === municipality)?.name].filter(Boolean).join(" · ")}
            category={kind ? EXPERIENCE_KINDS[kind].label : "Experiencia"}
            price={fmtPrice(isFree, priceMin ? Number(priceMin) : null, priceMax ? Number(priceMax) : null)}
          />
        )}
        {x && (
          <section className="rounded-card border border-line p-4">
            <h2 className="text-[15px] font-bold">Salidas con guía · {outings.length}</h2>
            <p className="mt-0.5 text-[13px] text-ink-2">Eventos vinculados a esta experiencia. Se vinculan desde la revisión de cada evento.</p>
            {outings.length > 0 && (
              <ul className="mt-3 divide-y divide-line text-[14px]">
                {outings.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <a href={`/evento/${o.slug}`} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline">{o.title}</a>
                    <span className="shrink-0 text-[12px] text-ink-2">{o.next ?? "sin fechas próximas"} · {EVENT_STATUS[o.status] ?? o.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <div className="space-y-4 pb-24">
        <Field label="Nombre">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Ruta a la Cascada Los Diamantes" />
        </Field>

        <Field label="Tipo">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EXPERIENCE_KINDS) as ExperienceKind[]).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={clsx("rounded-full border px-3 py-1.5 text-[13px] font-medium", kind === k ? "border-ink bg-ink text-white" : "border-line-2")}>
                {EXPERIENCE_KINDS[k].emoji} {EXPERIENCE_KINDS[k].label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Municipio">
            <select value={municipality} onChange={(e) => { setMunicipality(e.target.value); setPlaceId(null); }} className={inputCls}>
              <option value="">Elegir…</option>
              {municipalities.map((m) => <option key={m.cvegeo} value={m.cvegeo}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Prestador u organizador">
            <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} className={inputCls} placeholder="Guías comunitarios, ejido, taller…" />
          </Field>
        </div>

        <Field label="Lugar">
          <input value={placeText} onChange={(e) => { setPlaceText(e.target.value); setPlaceId(null); }} className={inputCls} placeholder={municipality ? "Busca en el catálogo o escribe uno nuevo" : "Elige primero el municipio"} disabled={!municipality} />
          {selectedPlace && (
            <p className="mt-1 flex items-center gap-2 text-[13px]">
              <span className="rounded-full bg-free-bg px-2 py-0.5 font-semibold text-free">Vinculado</span> {selectedPlace.name}
              <button type="button" onClick={() => setPlaceId(null)} className="text-ink-2 underline">quitar</button>
            </p>
          )}
          {suggestions.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-control border border-line text-[13px]">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { setPlaceId(p.id); setPlaceText(p.name); setNewPlaceKind(null); }} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-bg-2">
                    <span>{p.name}</span><span className="text-ink-3">{PLACE_KIND_LABEL[p.kind] ?? p.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!placeId && placeText.trim().length >= 3 && (
            <label className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
              <input type="checkbox" checked={!!newPlaceKind} onChange={(e) => setNewPlaceKind(e.target.checked ? "parque_ecoturistico" : null)} />
              Agregar «{placeText.trim()}» al catálogo como
              <select value={newPlaceKind ?? "parque_ecoturistico"} onChange={(e) => setNewPlaceKind(e.target.value)} disabled={!newPlaceKind} className="rounded-control border border-line-2 bg-white px-2 py-1 disabled:opacity-50">
                {NEW_PLACE_KINDS.map((k) => <option key={k} value={k}>{PLACE_KIND_LABEL[k]}</option>)}
              </select>
              <span className="text-ink-3">(tendrá su página de lugar)</span>
            </label>
          )}
        </Field>

        <Field label="Ubicación del punto de inicio (opcional)">
          <input value={point} onChange={(e) => setPoint(e.target.value)} className={inputCls} placeholder={x?.lat != null ? `Actual: ${x.lat.toFixed(5)}, ${x.lng?.toFixed(5)} · pega otra para cambiarla` : "19.2275, -98.8021 · cópiala de Google Maps"} />
          <p className="mt-1 text-[12px] text-ink-3">Si la dejas vacía se usa la del lugar o el centro del municipio.</p>
        </Field>

        <Field label="Descripción">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputCls} placeholder="Qué se hace, qué se ve, cómo es el camino" />
        </Field>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Duración">
            <input value={durationText} onChange={(e) => setDurationText(e.target.value)} className={inputCls} placeholder="3–4 h" />
          </Field>
          <Field label="Distancia (km)">
            <input type="number" min={0} step={0.1} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} className={inputCls} placeholder="7" />
          </Field>
          <Field label="Dificultad">
            <div className="flex gap-1.5">
              {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
                <button key={d} type="button" onClick={() => setDifficulty(difficulty === d ? null : d)} className={clsx("flex-1 rounded-control border px-2 py-2 text-[13px] font-medium", difficulty === d ? "border-ink bg-ink text-white" : "border-line-2")}>{DIFFICULTY_LABEL[d]}</button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Precio">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} /> Gratis</label>
            {!isFree && (
              <>
                <input type="number" min={0} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="Desde $" className={clsx(inputCls, "w-28")} />
                <input type="number" min={0} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="Hasta $" className={clsx(inputCls, "w-28")} />
                <input value={priceNote} onChange={(e) => setPriceNote(e.target.value)} placeholder="acceso · con guía · por persona" className={clsx(inputCls, "w-56")} />
              </>
            )}
          </div>
        </Field>

        <Field label="Disponibilidad (resumen en tarjetas)">
          <input value={availabilityText} onChange={(e) => setAvailabilityText(e.target.value)} className={inputCls} placeholder="Todos los días · Sáb y dom · 6:30" />
        </Field>

        <Field label="Horarios">
          <div className="space-y-2">
            {hours.map((h, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_36px] gap-2">
                <input value={h.days} onChange={(e) => setHours((p) => p.map((r, j) => (j === i ? { ...r, days: e.target.value } : r)))} placeholder="Lun – Vie" className={inputCls} />
                <input value={h.time} onChange={(e) => setHours((p) => p.map((r, j) => (j === i ? { ...r, time: e.target.value } : r)))} placeholder="8:00 – 17:00" className={inputCls} />
                <button type="button" onClick={() => setHours((p) => p.filter((_, j) => j !== i))} aria-label="Quitar horario" className="grid h-9 w-9 place-items-center rounded-control border border-line text-ink-2"><Trash2 size={16} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setHours((p) => [...p, { days: "", time: "" }])} className="flex items-center gap-1 text-[13px] font-semibold underline"><Plus size={14} /> Agregar horario</button>
          </div>
        </Field>

        <Field label="Temporada y recomendaciones">
          <textarea value={seasonText} onChange={(e) => setSeasonText(e.target.value)} rows={2} className={inputCls} placeholder="Mejor temporada: junio a noviembre. Con lluvias la cascada lleva más agua." />
        </Field>

        <Field label="Qué llevar (uno por línea)">
          <textarea value={bring} onChange={(e) => setBring(e.target.value)} rows={3} className={inputCls} placeholder={"Calzado con suela\nAgua (1.5 L)\nEfectivo para el acceso"} />
        </Field>

        <Field label="Contacto y reservación">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Teléfono · 55 1234 5678" className={clsx(inputCls, "w-56")} />
              <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.checked)} /> Tiene WhatsApp</label>
            </div>
            <input value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} placeholder="Reserva con un día de anticipación · grupos de máx. 15" className={inputCls} />
            <div className="grid gap-2 md:grid-cols-3">
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Sitio web" className={inputCls} />
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram · @usuario" className={inputCls} />
              <input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Facebook · página o URL" className={inputCls} />
            </div>
          </div>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Información verificada el">
            <input type="date" value={verifiedAt} onChange={(e) => setVerifiedAt(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Vigente hasta (opcional)">
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
            <p className="mt-1 text-[12px] text-ink-3">Después de esta fecha deja de listarse hasta que la vuelvas a verificar.</p>
          </Field>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-6 py-3 backdrop-blur md:left-[240px]">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-end gap-2">
            {msg && <p className={clsx("mr-auto text-[13px]", msg.ok ? "text-free" : "text-error")}>{msg.text}</p>}
            {x?.status === "published" && <a href={`/experiencia/${x.slug}`} target="_blank" rel="noreferrer" className="rounded-control px-4 py-2.5 text-[14px] font-semibold underline">Ver en el sitio</a>}
            {status === "published" ? (
              <>
                <button type="button" disabled={pending || !valid} onClick={() => save("draft", "Guardada como borrador; ya no se ve en el sitio.")} className="rounded-control px-4 py-2.5 text-[14px] font-semibold text-ink-2 disabled:opacity-40">Despublicar</button>
                <button type="button" disabled={pending || !valid} onClick={() => save("published", "Cambios publicados.")} className="rounded-control bg-accent px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40">Guardar cambios</button>
              </>
            ) : (
              <>
                <button type="button" disabled={pending || !valid} onClick={() => save(status === "archived" ? "archived" : "draft", "Borrador guardado.")} className="rounded-control border border-ink px-4 py-2.5 text-[14px] font-semibold disabled:opacity-40">Guardar borrador</button>
                <button type="button" disabled={pending || !valid} onClick={() => save("published", "Publicada.")} className="rounded-control bg-accent px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40">Publicar</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-control border border-line-2 bg-white px-3 py-2 text-[14px] focus:border-ink focus:outline-none disabled:bg-bg-2";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-2">{label}</label>
      {children}
    </div>
  );
}
