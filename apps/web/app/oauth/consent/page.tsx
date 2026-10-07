import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decide } from "./actions";

export const metadata = { title: "Conectar asistente · Admin", robots: { index: false, follow: false } };

/** Pantalla de consentimiento del servidor OAuth de Supabase: la usa ChatGPT/Claude para conectarse al MCP. */
export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ authorization_id?: string }> }) {
  const { authorization_id: id } = await searchParams;
  if (!id) return <Shell><p className="mt-3 text-[14px] text-ink-2">Falta la solicitud de autorización.</p></Shell>;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/admin/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (!isAdmin) redirect("/admin/login?error=no-admin");

  const { data, error } = await sb.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) return <Shell><p className="mt-3 text-[13px] text-error">{error?.message ?? "Solicitud inválida o vencida."}</p></Shell>;
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  return (
    <Shell>
      <h1 className="mt-5 text-[22px] font-bold">Conectar {data.client.name || "asistente"}</h1>
      <p className="mt-2 text-[14px] text-ink-2">
        Podrá buscar municipios y lugares y <b>crear eventos y subir flyers a revisión</b> con tu cuenta ({user.email}). Nada se publica sin que lo apruebes.
      </p>
      <p className="mt-3 break-all text-[12px] text-ink-3">Regresa a: {data.redirect_uri}</p>
      <form action={decide} className="mt-5 grid grid-cols-2 gap-2">
        <input type="hidden" name="authorization_id" value={data.authorization_id} />
        <button name="decision" value="deny" className="rounded-control border border-line-2 py-3 text-[15px] font-semibold">Cancelar</button>
        <button name="decision" value="approve" className="rounded-control bg-accent py-3 text-[15px] font-semibold text-white">Autorizar</button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg-2 px-5">
      <div className="w-full max-w-[420px] rounded-card border border-line bg-white p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white">EL</span>
          <span className="text-[15px] font-bold">Entre Lugares · Admin</span>
        </div>
        {children}
      </div>
    </main>
  );
}
