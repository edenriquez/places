import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { flyerUrl, relativeTime } from "@/lib/format";
import type { RawIngestion } from "@/lib/types";
import { Uploader } from "./uploader";
import { StatusPill } from "../status-pill";
import { RequeueButton } from "./requeue-button";

export const metadata = { title: "Subir flyers · Admin" };

export default async function UploadPage() {
  const sb = await createClient();
  const [{ data: munis }, { data: recent }] = await Promise.all([
    sb.from("municipalities_view").select("cvegeo,name").order("name"),
    sb.from("raw_ingestions").select("*, municipalities:municipality_hint(name)").order("received_at", { ascending: false }).limit(30),
  ]);

  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="text-[28px] font-bold">Subir flyers</h1>
      <p className="mt-1 text-[14px] text-ink-2">Las imágenes se encolan y el job local de la Mac las procesa.</p>

      <Uploader municipalities={(munis ?? []) as { cvegeo: string; name: string }[]} />

      <h2 className="mt-10 text-[18px] font-bold">Cargas recientes</h2>
      <div className="mt-3 overflow-hidden rounded-card border border-line">
        <table className="w-full text-[14px]">
          <thead className="bg-bg-2 text-left text-[12px] uppercase tracking-[0.04em] text-ink-2">
            <tr>
              <th className="px-4 py-2.5">Miniatura</th>
              <th className="px-4 py-2.5">Archivo</th>
              <th className="px-4 py-2.5">Municipio</th>
              <th className="px-4 py-2.5">Subido</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(recent ?? []).map((r) => {
              const row = r as RawIngestion & { municipalities: { name: string } | null };
              const url = flyerUrl(row.media_path);
              return (
                <tr key={row.id} className="h-14">
                  <td className="px-4 py-2">
                    <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-bg-2">
                      {url && <Image src={url} alt="" fill sizes="40px" className="object-cover" />}
                    </div>
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-2 font-medium">
                    {String(row.payload?.filename ?? row.media_path?.split("/").pop() ?? "")}
                    {row.error && <span className="block truncate text-[12px] text-error">{row.error}</span>}
                  </td>
                  <td className="px-4 py-2 text-ink-2">{row.municipalities?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-2">{relativeTime(row.received_at)}</td>
                  <td className="px-4 py-2"><StatusPill status={row.status} /></td>
                  <td className="px-4 py-2 text-right">
                    {row.status === "needs_review" && <a href={`/admin/review/${row.id}`} className="text-[13px] font-semibold text-accent">Revisar</a>}
                    {row.status === "failed" && <RequeueButton id={row.id} />}
                  </td>
                </tr>
              );
            })}
            {!recent?.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-2">Aún no has subido nada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
