import Link from "next/link";
import { ArrowLeft, Backpack, CalendarDays, CheckCircle2, Clock, Heart, MapPin, MessageCircle, Mountain, Route, Share2, Sun, Ticket } from "lucide-react";
import { FlyerCarousel } from "@/components/flyer-carousel";
import { EXPERIENCES } from "../data";
import { AnyDayBadge, BASE, MockBar, TypeBadge } from "../ui";

const HOURS = [
  ["Lun – Vie", "8:00 – 17:00"],
  ["Sáb – Dom", "7:00 – 17:00"],
];
const SALIDAS = [
  { day: "Sáb", date: "18 oct", time: "8:00", price: "$250", spots: "6 lugares" },
  { day: "Sáb", date: "25 oct", time: "8:00", price: "$250", spots: "12 lugares" },
  { day: "Sáb", date: "1 nov", time: "7:30", price: "$280", spots: "Con desayuno" },
];

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[18px] font-bold">{children}</h2>;
}

export default function MockDetalle() {
  const e = EXPERIENCES[0];
  return (
    <>
      <MockBar current="detalle" />
      <main className="mx-auto max-w-screen-sm pb-32">
        <div className="relative">
          <FlyerCarousel slides={e.gallery.map((src) => ({ src }))} alt={e.title} sizes="(max-width: 640px) 100vw, 640px" slideClassName="aspect-[4/3]" />
          <div className="pointer-events-none absolute inset-x-4 top-3 flex justify-between [&>*]:pointer-events-auto">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><ArrowLeft size={20} /></span>
            <span className="flex gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Share2 size={18} /></span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Heart size={18} /></span>
            </span>
          </div>
        </div>

        <div className="space-y-7 px-5 pt-4">
          <div>
            <div className="flex flex-wrap gap-1.5"><TypeBadge e={e} /><AnyDayBadge text="Disponible todos los días" /></div>
            <h1 className="mt-3 text-[26px] font-bold leading-tight">{e.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-2"><MapPin size={15} /> {e.place}, {e.municipality} · Estado de México</p>

            <div className="mt-5 grid grid-cols-4 divide-x divide-line rounded-card border border-line py-3 text-center">
              {[
                [Clock, "Duración", e.duration],
                [Route, "Distancia", e.distance],
                [Mountain, "Dificultad", e.difficulty],
                [Ticket, "Acceso", "$50"],
              ].map(([Icon, label, value]) => {
                const I = Icon as typeof Clock;
                return (
                  <div key={label as string} className="px-1">
                    <I size={18} className="mx-auto text-ink-2" />
                    <p className="mt-1 text-[14px] font-semibold leading-tight">{value as string}</p>
                    <p className="text-[11px] text-ink-3">{label as string}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <section>
            <H2>Cuándo ir</H2>
            <ul className="mt-3 divide-y divide-line rounded-card border border-line text-[14px]">
              {HOURS.map(([d, h]) => (
                <li key={d} className="flex justify-between px-4 py-2.5"><span className="text-ink-2">{d}</span><span className="font-medium">{h}</span></li>
              ))}
              <li className="flex items-start gap-2.5 px-4 py-3"><Sun size={16} className="mt-0.5 shrink-0 text-warn" /><span><b>Mejor temporada: junio a noviembre.</b> <span className="text-ink-2">Con las lluvias la cascada lleva más agua; en secas el sendero es más fácil.</span></span></li>
            </ul>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-3"><CheckCircle2 size={13} /> Información verificada en octubre 2026 · vigente hasta marzo 2027</p>
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <H2>Salidas con guía</H2>
              <span className="text-[13px] text-ink-2">{SALIDAS.length} próximas</span>
            </div>
            <p className="mt-1 text-[13px] text-ink-2">Puedes ir por tu cuenta cualquier día. Estas fechas incluyen guía local y transporte desde el centro.</p>
            <ul className="mt-3 space-y-2">
              {SALIDAS.map((s) => (
                <li key={s.date}>
                  <Link href={`${BASE}/salida`} className="flex items-center gap-3 rounded-card border border-line p-3 hover:border-ink">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-accent-soft text-center leading-none text-accent">
                      <span><span className="block text-[11px] font-semibold uppercase">{s.day}</span><span className="block text-[15px] font-bold">{s.date.split(" ")[0]}</span></span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">{s.date} · {s.time}</span>
                      <span className="block text-[13px] text-ink-2">{s.spots}</span>
                    </span>
                    <span className="text-[15px] font-semibold">{s.price}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <H2>Sobre la experiencia</H2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              Sendero entre pinos y oyameles que sigue el arroyo hasta la caída de Los Diamantes, de unos 30 m. El camino
              empieza en San Rafael, sube de forma constante el primer tramo y termina en una poza donde se puede descansar.
            </p>
          </section>

          <section>
            <H2>Qué llevar</H2>
            <ul className="mt-2 grid grid-cols-2 gap-2 text-[14px]">
              {["Calzado con suela", "Agua (1.5 L)", "Impermeable", "Efectivo para el acceso"].map((t) => (
                <li key={t} className="flex items-center gap-2"><Backpack size={15} className="text-ink-3" /> {t}</li>
              ))}
            </ul>
          </section>

          <section>
            <H2>Quién la ofrece</H2>
            <div className="mt-3 flex items-center gap-3 rounded-card border border-line p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bg-2 text-[13px] font-bold text-ink-2">GC</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Guías Comunitarios San Rafael</span>
                <span className="block text-[13px] text-ink-2">Prestador local · responde en ~1 h</span>
              </span>
            </div>
          </section>

          <section>
            <H2>Cómo llegar</H2>
            <p className="mt-1 text-[13px] text-ink-2">Inicio del sendero: Calle del Río, San Rafael. Estacionamiento a 200 m.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <span className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Abrir en Maps</span>
              <span className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Waze</span>
            </div>
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-3 px-5 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
            <div>
              <p className="text-[18px] font-bold leading-tight">$50 <span className="text-[13px] font-normal text-ink-2">acceso</span></p>
              <p className="flex items-center gap-1 text-[12px] text-ink-2"><CalendarDays size={12} /> o salida con guía desde $250</p>
            </div>
            <span className="flex items-center gap-2 rounded-control bg-whatsapp px-4 py-3 text-[15px] font-semibold text-white"><MessageCircle size={18} /> Reservar</span>
          </div>
        </div>
      </main>
    </>
  );
}
