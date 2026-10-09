import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CalendarPlus, ChevronRight, Clock, Heart, Infinity as Always, MapPin, MessageCircle, Share2, Users } from "lucide-react";
import { SectionHeader } from "@/components/ui";
import { EVENTS, EXPERIENCES, IMG } from "../data";
import { BASE, DatedCard, MockBar } from "../ui";

export default function MockSalida() {
  const d = EVENTS[0];
  const parent = EXPERIENCES[0];
  return (
    <>
      <MockBar current="salida" />
      <main className="mx-auto max-w-screen-sm pb-32">
        <div className="relative aspect-[4/3] bg-ink">
          <Image src={IMG.cascada} alt={d.title} fill priority sizes="640px" className="object-cover" />
          <div className="absolute inset-x-4 top-3 flex justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><ArrowLeft size={20} /></span>
            <span className="flex gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Share2 size={18} /></span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Heart size={18} /></span>
            </span>
          </div>
        </div>

        <div className="space-y-6 px-5 pt-5">
          <div>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-accent">Evento · {d.category}</span>
            <h1 className="mt-3 text-[26px] font-bold leading-tight">{d.title}</h1>

            <ul className="mt-4 space-y-3 text-[15px]">
              <li className="flex items-start gap-3"><CalendarDays size={18} className="mt-0.5 text-ink-2" /><span><b>Sábado 18 de octubre</b><span className="block text-[13px] text-ink-2">Solo esta fecha</span></span></li>
              <li className="flex items-start gap-3"><Clock size={18} className="mt-0.5 text-ink-2" /><span><b>8:00 – 13:30</b><span className="block text-[13px] text-ink-2">Punto de reunión: Plaza de Tlalmanalco, 7:45</span></span></li>
              <li className="flex items-start gap-3"><MapPin size={18} className="mt-0.5 text-ink-2" /><span><b>{d.place}</b></span></li>
              <li className="flex items-start gap-3"><Users size={18} className="mt-0.5 text-ink-2" /><span><b>Quedan 6 lugares</b><span className="block text-[13px] text-ink-2">Grupo máximo de 15 personas</span></span></li>
            </ul>
          </div>

          <Link href={`${BASE}/detalle`} className="flex items-center gap-3 rounded-card border border-[#bfe3cf] bg-[#f1faf5] p-3">
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px]">
              <Image src={parent.img} alt="" fill sizes="64px" className="object-cover" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#17734a]"><Always size={12} strokeWidth={2.6} /> Parte de una experiencia</span>
              <span className="block truncate text-[15px] font-semibold">{parent.title}</span>
              <span className="block text-[13px] text-ink-2">También puedes ir por tu cuenta cualquier día · {parent.price}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-ink-3" />
          </Link>

          <section>
            <h2 className="text-[18px] font-bold">Qué incluye</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-2">
              <li>Guía local certificado</li>
              <li>Transporte redondo desde la plaza</li>
              <li>Acceso al parque y seguro de visitante</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[18px] font-bold">Organiza</h2>
            <div className="mt-3 flex items-center gap-3 rounded-card border border-line p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bg-2 text-[13px] font-bold text-ink-2">GC</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Guías Comunitarios San Rafael</span>
                <span className="block text-[13px] text-ink-2">3 salidas próximas · 1 experiencia</span>
              </span>
            </div>
          </section>
        </div>

        <SectionHeader title="Otras fechas de esta experiencia" />
        {[
          { ...d, when: "Sáb 25 de oct · 8:00" },
          { ...d, when: "Sáb 1 de nov · 7:30", price: "$280" },
        ].map((x) => <DatedCard key={x.when} d={{ ...x, from: undefined }} />)}

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-3 px-5 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
            <div>
              <p className="text-[18px] font-bold leading-tight">{d.price} <span className="text-[13px] font-normal text-ink-2">por persona</span></p>
              <p className="flex items-center gap-1 text-[12px] text-ink-2"><CalendarPlus size={12} /> Agregar al calendario</p>
            </div>
            <span className="flex items-center gap-2 rounded-control bg-whatsapp px-4 py-3 text-[15px] font-semibold text-white"><MessageCircle size={18} /> Apartar lugar</span>
          </div>
        </div>
      </main>
    </>
  );
}
