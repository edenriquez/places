"use client";

import { LogOut } from "lucide-react";
import { GoogleButton } from "./login-sheet";
import { useSession } from "./session-provider";

export function SignInButton({ className }: { className?: string }) {
  const { signIn } = useSession();
  return <GoogleButton onClick={() => signIn()} className={className} />;
}

export function SignOutButton() {
  const { signOut } = useSession();
  return (
    <button type="button" onClick={signOut} className="flex items-center gap-2 rounded-control border border-line-2 px-4 py-2.5 text-[14px] font-semibold hover:bg-bg-2">
      <LogOut size={16} /> Cerrar sesión
    </button>
  );
}
