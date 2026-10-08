import { BackButton } from "@/components/back-button";
import { Bone, DesktopHeaderSkeleton } from "@/components/skeleton";

function InfoRows() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3">
          <Bone className="h-5 w-5 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-4 w-2/3" />
            <Bone className="h-3.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mismo acomodo que EventMobile / EventDesktop, para que el contenido real no brinque al llegar. */
export default function Loading() {
  return (
    <div role="status">
      <span className="sr-only">Cargando evento…</span>
      <main className="mx-auto max-w-screen-sm lg:hidden">
        <Bone className="aspect-[4/3] rounded-none" />
        <div className="fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-40 mx-auto max-w-screen-sm px-4">
          <BackButton className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft" />
        </div>
        <div className="px-5 pt-5">
          <Bone className="h-6 w-24 rounded-full" />
          <Bone className="mt-3 h-7 w-4/5" />
          <Bone className="mt-2 h-7 w-3/5" />
          <div className="mt-5"><InfoRows /></div>
          <Bone className="mt-3 ml-8 h-[140px] rounded-card" />
        </div>
      </main>
      <div className="hidden lg:block">
        <DesktopHeaderSkeleton />
        <main className="mx-auto max-w-[1120px] px-8 pb-16 pt-6">
          <BackButton className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-bg-2" />
          <div className="mt-4">
            <Bone className="h-6 w-24 rounded-full" />
            <Bone className="mt-3 h-10 w-2/3" />
            <Bone className="mt-2 h-5 w-1/3" />
          </div>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_360px] gap-12">
            <div className="space-y-9">
              <Bone className="aspect-[4/3] rounded-card" />
              <InfoRows />
            </div>
            <Bone className="h-[420px] rounded-card" />
          </div>
        </main>
      </div>
    </div>
  );
}
