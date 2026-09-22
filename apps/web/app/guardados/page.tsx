import Link from "next/link";
import { Heart } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";

export const metadata = { title: "Guardados" };

export default function SavedPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col px-5 pb-28 pt-8">
      <h1 className="text-[26px] font-bold">Guardados</h1>
      <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-bg-2"><Heart size={28} className="text-ink-2" /></span>
        <p className="mt-4 text-[17px] font-semibold">Guarda lo que no te quieres perder</p>
        <p className="mt-1 max-w-[280px] text-[14px] text-ink-2">Muy pronto podrás guardar eventos y recibir la cartelera de tu zona.</p>
        <Link href="/" className="mt-6 rounded-control bg-ink px-5 py-3 text-[14px] font-semibold text-white">Explorar eventos</Link>
      </div>
      <BottomNav />
    </main>
  );
}
