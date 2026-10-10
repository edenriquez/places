import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BASE } from "./ui";

const SCREENS = [
  { href: "explorar", title: "Explorar", note: "Nueva sección “Para cualquier día”: experiencias por tipo, junto a los eventos con fecha." },
  { href: "municipio", title: "Municipio · Tlalmanalco", note: "Municipio → Lugares → Experiencias + Eventos. Ya no se queda vacío si no hay fechas." },
  { href: "lugar", title: "Lugar · Parque Dos Aguas", note: "Qué se puede hacer en el lugar (siempre) y qué fechas hay ahí (a veces)." },
  { href: "detalle", title: "Experiencia · Ruta Cascada Los Diamantes", note: "Duración, distancia, dificultad, horarios, temporada, prestador y sus próximas salidas guiadas." },
  { href: "salida", title: "Evento · Salida guiada", note: "Un evento generado por la experiencia: si la fecha pasa, la experiencia sigue." },
];

export default function MockIndex() {
  return (
    <main className="mx-auto max-w-screen-sm px-5 pb-16 pt-8">
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">Mock · no es producción</p>
      <h1 className="mt-1 text-[30px] font-extrabold leading-tight">Experiencias</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
        Una <b className="text-ink">experiencia</b> es algo que puedes hacer en un lugar sin depender de una fecha. Un{" "}
        <b className="text-ink">evento</b> ocurre en una fecha y hora; una experiencia puede generar eventos (salidas guiadas),
        pero sigue existiendo cuando esas fechas pasan.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
        <div className="rounded-card border border-line p-4">
          <p className="font-bold">📅 Evento</p>
          <p className="mt-1 text-ink-2">Senderismo nocturno · 24 oct, 7:00 PM</p>
        </div>
        <div className="rounded-card border border-line p-4">
          <p className="font-bold">♾️ Experiencia</p>
          <p className="mt-1 text-ink-2">Ruta Cascada Los Diamantes · Tlalmanalco</p>
        </div>
      </div>

      <h2 className="mt-8 text-[18px] font-bold">Pantallas (celular)</h2>
      <ul className="mt-2 divide-y divide-line rounded-card border border-line">
        {SCREENS.map((s) => (
          <li key={s.href}>
            <Link href={`${BASE}/${s.href}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-bg-2/60">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{s.title}</span>
                <span className="block text-[13px] text-ink-2">{s.note}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
