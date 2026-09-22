import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./nav";
import { isWithinMinutes, relativeTime } from "@/lib/format";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ count: pending }, { data: lastRun }] = await Promise.all([
    sb.from("raw_ingestions").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
    sb.from("sources").select("last_run_at").order("last_run_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
  ]);
  const { data: lastProcessed } = await sb.from("raw_ingestions").select("processed_at").not("processed_at", "is", null).order("processed_at", { ascending: false }).limit(1).maybeSingle();
  const lastJob = [lastRun?.last_run_at, lastProcessed?.processed_at].filter(Boolean).sort().pop() as string | undefined;
  const jobActive = isWithinMinutes(lastJob, 30);

  return (
    <div className="flex min-h-dvh bg-white text-ink">
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-line px-4 py-5 md:flex">
        <Link href="/admin/upload" className="flex items-center gap-2 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white">EL</span>
          <span>
            <span className="block text-[15px] font-bold leading-tight">Entre Lugares</span>
            <span className="block text-[11px] text-ink-2">Panel de administración</span>
          </span>
        </Link>
        <AdminNav pending={pending ?? 0} />
        <div className="mt-auto px-2 text-[12px] text-ink-2">
          <p className="truncate">{user.email}</p>
          <form action="/admin/login/signout" method="post"><button className="mt-1 underline">Cerrar sesión</button></form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-line px-6 py-3">
          <div className="text-[13px] text-ink-2 md:hidden"><AdminNav pending={pending ?? 0} inline /></div>
          <div className="ml-auto flex items-center gap-2 text-[12px] font-medium">
            <span className={`h-2 w-2 rounded-full ${jobActive ? "bg-free" : "bg-ink-3"}`} />
            {jobActive ? `Job local activo · última corrida ${relativeTime(lastJob!)}` : `Job local sin actividad reciente${lastJob ? ` · ${relativeTime(lastJob)}` : ""}`}
          </div>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
