import { login } from "./actions";

export const metadata = { title: "Entrar · Admin" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-bg-2 px-5">
      <form action={login} className="w-full max-w-[380px] rounded-card border border-line bg-white p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white">EL</span>
          <span className="text-[15px] font-bold">Entre Lugares · Admin</span>
        </div>
        <h1 className="mt-5 text-[22px] font-bold">Entrar</h1>
        {sp.error === "no-admin" && <p className="mt-2 text-[13px] text-error">Esa cuenta no es administradora.</p>}
        {sp.error === "bad" && <p className="mt-2 text-[13px] text-error">Correo o contraseña incorrectos.</p>}
        <input type="hidden" name="next" value={sp.next ?? "/admin/upload"} />
        <label className="mt-4 block text-[13px] font-medium">Correo
          <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-control border border-line-2 px-3 py-2.5 text-[15px]" />
        </label>
        <label className="mt-3 block text-[13px] font-medium">Contraseña
          <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-control border border-line-2 px-3 py-2.5 text-[15px]" />
        </label>
        <button className="mt-5 w-full rounded-control bg-accent py-3 text-[15px] font-semibold text-white">Entrar</button>
      </form>
    </main>
  );
}
