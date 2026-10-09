import { Bike, Mountain, Music, PartyPopper, Search, Users, UtensilsCrossed, Palette } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { SectionHeader } from "@/components/ui";
import { EVENTS, EXPERIENCES, TYPES } from "../data";
import { DatedCard, ExperienceCard, MockBar } from "../ui";

const INTENTS = [
  { label: "Música", icon: Music, bg: "bg-[#fdecef]", fg: "text-[#d6204b]" },
  { label: "Fiesta", icon: PartyPopper, bg: "bg-[#fff3e0]", fg: "text-[#e07a00]" },
  { label: "Comida", icon: UtensilsCrossed, bg: "bg-[#fdeee6]", fg: "text-[#c2410c]" },
  { label: "Naturaleza", icon: Mountain, bg: "bg-[#e8f5ee]", fg: "text-[#17734a]", active: true },
  { label: "Aventura", icon: Bike, bg: "bg-[#e9f0fd]", fg: "text-[#2557c7]" },
  { label: "Cultura", icon: Palette, bg: "bg-[#f2ecfd]", fg: "text-[#6d3fd1]" },
];

export default function MockExplorar() {
  const near = EXPERIENCES.filter((e) => e.municipality === "Tlalmanalco");
  return (
    <>
      <MockBar current="explorar" />
      <main className="mx-auto max-w-screen-sm pb-28">
        <div className="px-5 pt-4">
          <div className="flex items-center gap-3 rounded-full border border-line px-5 py-3 shadow-soft">
            <Search size={18} />
            <span>
              <span className="block text-[15px] font-semibold leading-tight">¿A dónde vas este finde?</span>
              <span className="block text-[12px] text-ink-2">Cerca de Tlalmanalco</span>
            </span>
          </div>
        </div>

        <SectionHeader title="¿Qué quieres hacer?" subtitle="Elige y te mostramos lo que hay cerca de ti" />
        <div className="grid grid-cols-3 gap-2.5 px-5">
          {INTENTS.map(({ label, icon: Icon, bg, fg, active }) => (
            <div key={label} className={`rounded-card border p-3 ${active ? "border-ink ring-1 ring-ink" : "border-line"}`}>
              <span className={`grid h-9 w-9 place-items-center rounded-full ${bg} ${fg}`}><Icon size={18} /></span>
              <p className="mt-2 text-[14px] font-semibold">{label}</p>
            </div>
          ))}
        </div>

        <div className="mx-5 mt-6 grid grid-cols-3 rounded-full bg-bg-2 p-1 text-[14px] font-semibold">
          <span className="rounded-full py-2 text-center text-ink-2">Ahora</span>
          <span className="rounded-full py-2 text-center text-ink-2">Próximos</span>
          <span className="rounded-full bg-white py-2 text-center shadow-soft">Cualquier día</span>
        </div>

        <SectionHeader title="Para cualquier día" subtitle="Experiencias cerca de Tlalmanalco que no dependen de una fecha" />
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1">
          <span className="inline-flex h-9 shrink-0 items-center rounded-full border border-ink bg-ink px-4 text-[14px] font-medium text-white">Todo</span>
          {TYPES.map((t) => (
            <span key={t.id} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line-2 bg-white px-4 text-[14px] font-medium">
              <span>{t.emoji}</span> {t.label}
            </span>
          ))}
        </div>
        {near.map((e) => <ExperienceCard key={e.slug} e={e} />)}

        <SectionHeader title="Y con fecha" subtitle="Salidas guiadas y eventos de naturaleza este mes" />
        {EVENTS.filter((d) => d.from).map((d) => <DatedCard key={d.title} d={d} />)}

        <div className="mx-5 mt-6 flex items-center gap-3 rounded-card bg-bg-2 p-4">
          <Users size={20} className="shrink-0 text-ink-2" />
          <p className="text-[13px] text-ink-2">¿Ofreces recorridos, talleres o visitas? <b className="text-ink">Publica tu experiencia</b> una vez y agrega fechas cuando tengas salidas.</p>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
