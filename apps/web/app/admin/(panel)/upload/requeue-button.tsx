"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { requeueIngestion } from "../actions";

export function RequeueButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await requeueIngestion(id); router.refresh(); })}
      className="text-[13px] font-semibold text-ink underline"
    >
      Reintentar
    </button>
  );
}
