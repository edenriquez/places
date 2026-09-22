import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { municipalities } from "@/lib/queries";

export const metadata = { title: "Perfil" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const munis = await municipalities();
  return (
    <main className="mx-auto max-w-screen-sm px-5 pb-28 pt-8">
      <h1 className="text-[26px] font-bold">Perfil</h1>
      <p className="mt-1 text-[14px] text-ink-2">Las cuentas llegan pronto. Mientras, síguenos donde ya estás.</p>

      <a href="https://whatsapp.com/channel/entrelugares" className="mt-6 flex items-center gap-4 rounded-card border border-line p-4">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-whatsapp text-white"><MessageCircle size={22} /></span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">Canal de WhatsApp</span>
          <span className="block text-[13px] text-ink-2">La cartelera del finde cada jueves</span>
        </span>
      </a>

      <a href="mailto:hola@entrelugares.mx?subject=Quiero publicar un evento" className="mt-3 flex items-center gap-4 rounded-card border border-line p-4">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white"><Send size={20} /></span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">¿Organizas algo?</span>
          <span className="block text-[13px] text-ink-2">Mándanos tu flyer y lo publicamos gratis</span>
        </span>
      </a>

      <h2 className="mt-8 text-[18px] font-bold">Pueblos</h2>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {munis.map((m) => (
          <li key={m.cvegeo}>
            <Link href={`/municipio/${m.slug}`} className="block rounded-card border border-line px-4 py-3">
              <span className="block text-[15px] font-semibold">{m.name}</span>
              <span className="block text-[12px] text-ink-2">{m.state}</span>
            </Link>
          </li>
        ))}
      </ul>
      <BottomNav />
    </main>
  );
}
