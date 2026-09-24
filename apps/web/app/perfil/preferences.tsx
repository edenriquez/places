"use client";

import { useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { CATEGORY_LABEL } from "@/lib/types";
import { COMPANIONS, type Profile } from "@/lib/account";
import { savePreferences } from "./actions";

// "otro" no dice nada de los gustos de alguien
const CATEGORIES = Object.entries(CATEGORY_LABEL).filter(([id]) => id !== "otro");

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14px] font-medium transition-[background-color,border-color,color] duration-200 active:scale-95",
        on ? "border-ink bg-ink text-white" : "border-line-2 bg-white text-ink hover:border-ink",
      )}
    >
      {on && <Check size={14} strokeWidth={3} className="anim-text-in" />}
      {children}
    </button>
  );
}

/** Preferencias declaradas: se guardan solas en cada cambio. */
export function Preferences({ initial, municipalities }: { initial: Profile; municipalities: { cvegeo: string; name: string; state: string }[] }) {
  const [p, setP] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, start] = useTransition();
  const seq = useRef(0);

  function update(next: Profile) {
    setP(next);
    setStatus("saving");
    const mine = ++seq.current;
    start(async () => {
      const res = await savePreferences(next);
      if (mine === seq.current) setStatus(res.ok ? "saved" : "error");
    });
  }
  const flip = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const byState = municipalities.reduce<Record<string, typeof municipalities>>((acc, m) => ((acc[m.state] ??= []).push(m), acc), {});

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[15px] font-semibold">¿Qué te late?</p>
        <p className="text-[13px] text-ink-2">Elige todo lo que quieras ver primero.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map(([id, label]) => (
            <Toggle key={id} on={p.categories.includes(id)} onClick={() => update({ ...p, categories: flip(p.categories, id) })}>{label}</Toggle>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[15px] font-semibold">¿Con quién sales?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {COMPANIONS.map((c) => (
            <Toggle key={c.id} on={p.companions.includes(c.id)} onClick={() => update({ ...p, companions: flip(p.companions, c.id) })}>{c.label}</Toggle>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="text-[15px] font-semibold">Tu pueblo</span>
        <span className="block text-[13px] text-ink-2">Donde vives o a donde más te escapas.</span>
        <select
          value={p.home_municipality ?? ""}
          onChange={(e) => update({ ...p, home_municipality: e.target.value || null })}
          className="mt-3 w-full rounded-control border border-line-2 bg-white px-3 py-2.5 text-[15px]"
        >
          <option value="">Sin elegir</option>
          {Object.entries(byState).map(([state, ms]) => (
            <optgroup key={state} label={state}>
              {ms.map((m) => <option key={m.cvegeo} value={m.cvegeo}>{m.name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <p className="h-4 text-[12px] text-ink-3" aria-live="polite">
        {status === "saving" && "Guardando…"}
        {status === "saved" && <span className="anim-text-in inline-block text-free">Guardado ✓</span>}
        {status === "error" && <span className="text-error">No se pudo guardar. Intenta de nuevo.</span>}
      </p>
    </div>
  );
}
