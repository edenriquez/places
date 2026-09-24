import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";
import { SignInButton, SignOutButton } from "@/components/auth/account-buttons";
import { BottomNav } from "@/components/bottom-nav";
import { municipalities } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Perfil" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const sb = await createClient();
  const [munis, { data: { user } }] = await Promise.all([municipalities(), sb.auth.getUser()]);
  const meta = user?.user_metadata ?? {};
  const name: string = meta.full_name ?? meta.name ?? user?.email ?? "";
  const avatar: string | undefined = meta.avatar_url ?? meta.picture;
  return (
    <main className="mx-auto max-w-screen-sm px-5 pb-28 pt-8">
      <h1 className="text-[26px] font-bold">Perfil</h1>
      {user ? (
        <section className="mt-5 flex flex-wrap items-center gap-4 rounded-card border border-line p-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo de Google
            <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-full bg-bg-2 text-[18px] font-bold text-ink-2">{name.slice(0, 1).toUpperCase()}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{name}</p>
            {user.email && <p className="truncate text-[13px] text-ink-2">{user.email}</p>}
          </div>
          <SignOutButton />
        </section>
      ) : (
        <section className="mt-5 rounded-card border border-line p-5">
          <p className="text-[17px] font-semibold">Entra a entrelugares</p>
          <p className="mt-1 text-[14px] text-ink-2">Guarda eventos, marca a cuáles te interesa ir y encuéntralos en cualquier dispositivo.</p>
          <SignInButton className="mt-4" />
        </section>
      )}

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
