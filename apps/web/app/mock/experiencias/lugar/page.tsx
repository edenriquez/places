import Image from "next/image";
import { ArrowLeft, Car, Clock, Heart, MapPin, Share2, Ticket, Toilet } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { SectionHeader } from "@/components/ui";
import { EVENTS, EXPERIENCES, IMG } from "../data";
import { DatedCard, ExperienceCard, MockBar } from "../ui";

export default function MockLugar() {
  const here = EXPERIENCES.filter((e) => e.place === "Parque Dos Aguas");
  const dated = EVENTS.filter((d) => d.place.startsWith("Parque Dos Aguas"));
  return (
    <>
      <MockBar current="lugar" />
      <main className="mx-auto max-w-screen-sm pb-28">
        <div className="relative aspect-[4/3] bg-ink">
          <Image src={IMG.sendero} alt="Parque Dos Aguas" fill priority sizes="640px" className="object-cover" />
          <div className="absolute inset-x-4 top-3 flex justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><ArrowLeft size={20} /></span>
            <span className="flex gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Share2 size={18} /></span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Heart size={18} /></span>
            </span>
          </div>
        </div>

        <div className="px-5 pt-5">
          <span className="rounded-full bg-bg-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-2">Lugar · Parque ecoturístico</span>
          <h1 className="mt-3 text-[26px] font-bold leading-tight">Parque Dos Aguas</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-2"><MapPin size={15} /> Tlalmanalco, Estado de México</p>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
            <p className="flex items-center gap-2 rounded-control border border-line px-3 py-2.5"><Clock size={16} className="text-[#17734a]" /><span><b className="block text-[14px] text-[#17734a]">Abierto hoy</b>8:00 – 17:00</span></p>
            <p className="flex items-center gap-2 rounded-control border border-line px-3 py-2.5"><Ticket size={16} className="text-ink-2" /><span><b className="block text-[14px]">$50</b>entrada general</span></p>
            <p className="flex items-center gap-2 rounded-control border border-line px-3 py-2.5"><Car size={16} className="text-ink-2" /><span><b className="block text-[14px]">Estacionamiento</b>$40 por día</span></p>
            <p className="flex items-center gap-2 rounded-control border border-line px-3 py-2.5"><Toilet size={16} className="text-ink-2" /><span><b className="block text-[14px]">Servicios</b>baños, cabañas, comida</span></p>
          </div>
        </div>

        <SectionHeader title="Qué hacer aquí" subtitle={`${here.length} experiencias · cualquier día`} />
        {here.map((e) => <ExperienceCard key={e.slug} e={e} />)}

        <SectionHeader title="Fechas en este lugar" subtitle="Eventos y salidas con guía" />
        {dated.map((d) => <DatedCard key={d.title} d={d} />)}

        <SectionHeader title="Cómo llegar" />
        <div className="grid grid-cols-2 gap-3 px-5">
          <span className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Abrir en Maps</span>
          <span className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Waze</span>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
