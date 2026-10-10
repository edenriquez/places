"use client";

import { RotateCw } from "lucide-react";

export function RetryButton() {
  return (
    <button type="button" onClick={() => window.location.reload()}
      className="mt-6 flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-white">
      <RotateCw size={16} /> Reintentar
    </button>
  );
}
