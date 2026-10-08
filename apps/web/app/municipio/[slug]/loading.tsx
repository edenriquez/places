import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { Bone, CardSkeleton } from "@/components/skeleton";

/** Mismo acomodo que la página del municipio: portada, chips y la lista de eventos. */
export default function Loading() {
  return (
    <main role="status" className="mx-auto max-w-screen-sm pb-28">
      <span className="sr-only">Cargando municipio…</span>
      <div className="relative aspect-[4/3] bg-ink motion-safe:animate-pulse">
        <div className="absolute inset-x-4 top-[max(env(safe-area-inset-top),12px)]">
          <Link href="/" aria-label="Volver" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><ArrowLeft size={20} /></Link>
        </div>
        <div className="absolute inset-x-5 bottom-5 space-y-2">
          <div className="h-8 w-1/2 rounded-md bg-white/20" />
          <div className="h-4 w-2/3 rounded-md bg-white/15" />
        </div>
      </div>
      <div className="flex gap-2 px-5 pt-4">
        {["w-24", "w-20", "w-[88px]"].map((w) => <Bone key={w} className={`h-8 rounded-full ${w}`} />)}
      </div>
      <div className="px-5 pb-3 pt-7"><Bone className="h-7 w-48" /></div>
      <CardSkeleton />
      <CardSkeleton />
      <BottomNav />
    </main>
  );
}
