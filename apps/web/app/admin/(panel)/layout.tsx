import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./nav";
import { relativeTime } from "@/lib/format";
import { JOB_KIND_LABEL, workerIsOnline, type Job, type Worker } from "@/lib/types";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ count: pending }, { data: workerRow }] = await Promise.all([
    sb.from("raw_ingestions").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
    sb.from("workers").select("*").order("last_seen_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const worker = workerRow as Worker | null;
  const online = !!worker && workerIsOnline(worker);
  let currentJob: Job | null = null;
  if (online && worker?.current_job_id) {
    const { data } = await sb.from("jobs").select("kind, progress_done, progress_total").eq("id", worker.current_job_id).maybeSingle();
    currentJob = data as Job | null;
  }
  const headerText = !worker
    ? "Mac sin conectar"
    : !online
      ? `Mac sin conexión · vista ${relativeTime(worker.last_seen_at)}`
      : currentJob
        ? `Mac ocupada · ${JOB_KIND_LABEL[currentJob.kind].toLowerCase()} ${currentJob.progress_done}/${currentJob.progress_total ?? "?"}`
        : "Mac en línea · libre";

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
          <Link href="/admin/jobs" className="ml-auto flex items-center gap-2 text-[12px] font-medium hover:underline">
            <span className={`h-2 w-2 rounded-full ${!online ? "bg-ink-3" : currentJob ? "bg-warn live-dot" : "bg-free"}`} />
            {headerText}
          </Link>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
