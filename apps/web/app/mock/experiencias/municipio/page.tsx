import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Heart } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { SectionHeader } from "@/components/ui";
import { EVENTS, EXPERIENCES, IMG, PLACES } from "../data";
import { BASE, DatedCard, ExperienceCard, ExperienceTile, MockBar } from "../ui";

export default function MockMunicipio() {
  const here = EXPERIENCES.filter((e) => e.municipality === "Tlalmanalco");
  return (
    <>
      <MockBar current="municipio" />
      <main className="mx-auto max-w-screen-sm pb-28">
        <div className="relative aspect-[4/3] bg-ink">
          <Image src={IMG.cascada} alt="Tlalmanalco" fill priority sizes="640px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="absolute inset-x-4 top-3 flex justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><ArrowLeft size={20} /></span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Heart size={18} /></span>
          </div>
          <div className="absolute inset-x-5 bottom-5 text-white">
            <h1 className="text-[34px] font-extrabold leading-none">Tlalmanalco</h1>
            <p className="mt-1 text-[14px] opacity-90">Estado de México · 1 h 10 min desde CDMX</p>
          </div>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4">
          <span className="shrink-0 whitespace-nowrap rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium">♾️ {here.length} experiencias</span>
          <span className="shrink-0 whitespace-nowrap rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium">📅 {EVENTS.length} próximos</span>
          <span className="shrink-0 whitespace-nowrap rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium">{PLACES.length} lugares</span>
          <span className="shrink-0 whitespace-nowrap rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium">Gratis: 1</span>
        </div>

        <div className="mx-5 mt-4 grid grid-cols-3 rounded-full bg-bg-2 p-1 text-[14px] font-semibold">
          <span className="rounded-full bg-white py-2 text-center shadow-soft">Todo</span>
          <span className="rounded-full py-2 text-center text-ink-2">Experiencias</span>
          <span className="rounded-full py-2 text-center text-ink-2">Eventos</span>
        </div>

        <SectionHeader title="Qué hacer cualquier día" subtitle="Experiencias en Tlalmanalco" />
        <ExperienceCard e={here[0]} />
        <div className="no-scrollbar flex snap-x scroll-px-5 gap-4 overflow-x-auto px-5 pt-2">
          {here.slice(1).map((e) => <ExperienceTile key={e.slug} e={e} />)}
        </div>

        <SectionHeader title="Próximas fechas" subtitle="Eventos y salidas guiadas" />
        {EVENTS.map((d) => <DatedCard key={d.title} d={d} />)}

        <SectionHeader title="Lugares" subtitle="Cada lugar reúne sus experiencias y eventos" />
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-5">
          {PLACES.map((p) => (
            <Link key={p.slug} href={`${BASE}/lugar`} className="w-[210px] shrink-0 overflow-hidden rounded-card border border-line">
              <div className="relative aspect-[16/10] bg-bg-2"><Image src={p.img} alt="" fill sizes="210px" className="object-cover" /></div>
              <div className="p-3">
                <p className="line-clamp-1 text-[14px] font-semibold">{p.name}</p>
                <p className="text-[12px] text-ink-2">{p.kind}</p>
                <p className="mt-1 text-[12px] text-ink-2">
                  {p.experiences > 0 && <>♾️ {p.experiences} experiencia{p.experiences === 1 ? "" : "s"} · </>}📅 {p.events} fecha{p.events === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <SectionHeader title="Fechas que no te puedes perder" subtitle="Fiestas que se repiten cada año" />
        <ul className="mx-5 divide-y divide-line rounded-card border border-line">
          {[["Ene", "Fiesta de San Luis Obispo", "Centro"], ["Ago", "Feria del Santuario", "San Rafael"]].map(([m, n, l]) => (
            <li key={n} className="flex items-center gap-4 px-4 py-3">
              <span className="w-12 shrink-0 text-[13px] font-semibold uppercase text-ink-2">{m}</span>
              <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium">{n}</span><span className="block text-[13px] text-ink-2">{l}</span></span>
              <ChevronRight size={16} className="text-ink-3" />
            </li>
          ))}
        </ul>
      </main>
      <BottomNav />
    </>
  );
}
