import { Megaphone } from "lucide-react";
import { SignInButton } from "@/components/auth/account-buttons";
import { BackButton } from "@/components/back-button";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopHeader } from "@/components/desktop";
import { SearchBar } from "@/components/location-picker";
import { getLoc, hasLoc } from "@/lib/location-server";
import { municipalities } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { SubmitForm } from "./submit-form";

export const metadata = { title: "Publicar un evento" };
export const dynamic = "force-dynamic";

export default async function PublishPage() {
  const sb = await createClient();
  const [munis, loc, isSet, { data: { user } }] = await Promise.all([municipalities(), getLoc(), hasLoc(), sb.auth.getUser()]);
  return (
    <>
      <DesktopHeader><SearchBar loc={loc} municipalities={munis} isSet={isSet} header /></DesktopHeader>
      <main className="mx-auto max-w-[640px] px-5 pb-28 pt-6 lg:pt-10">
        <BackButton className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-bg-2" />
        <h1 className="mt-5 text-[28px] font-bold leading-tight">Publica tu evento</h1>
        <p className="mt-1 text-[15px] text-ink-2">Sube el flyer y cuéntanos lo esencial. Nosotros armamos la ficha con fecha, lugar y precio.</p>
        <div className="mt-6">
          {user ? (
            <SubmitForm userId={user.id} municipalities={munis} />
          ) : (
            <section className="rounded-card border border-line bg-white p-6">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-bg-2"><Megaphone size={20} /></span>
              <h2 className="mt-4 text-[18px] font-bold">Entra para publicar</h2>
              <p className="mt-1 text-[14px] text-ink-2">Así podemos avisarte cuando se publique y ves el estado de tus envíos en tu perfil.</p>
              <SignInButton className="mt-5" />
            </section>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
