"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, Check, ChevronDown, Infinity as Always } from "lucide-react";

export type Tab = "agenda" | "dia";

/** Una opción del menú "¿cuándo?". Con `href` cambia el rango en el servidor; sin él solo cambia la vista. `short`: en la pestaña. */
export type WhenOption = { key: string; label: string; short?: string; hint: string; live?: boolean; href?: string; onSelect?: () => void };
export type When = { options: WhenOption[]; current: string; subtitle?: string };

const Dot = () => <span className="relative inline-block h-2 w-2 shrink-0 rounded-full bg-live live-dot" />;

/**
 * Agenda (lo que pasa ahora y lo que viene) ⇄ Cualquier día (experiencias sin fecha). La pestaña de Agenda, ya
 * elegida, muestra el periodo ("Este finde ⌄") y al pulsarla se cambia. Sin `anyDay` no hay pestañas: queda solo
 * el botón del periodo. "Cualquier día" va en la URL (?v=dia) para que al volver de una experiencia siga abierta.
 */
export function HomeFeed({ initial, when, agenda, anyDay }: { initial: Tab; when?: When; agenda: React.ReactNode; anyDay?: React.ReactNode }) {
  const [picked, setPicked] = useState<Tab>(initial);
  const [moved, setMoved] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useDismiss(open, () => setOpen(false));
  const tab = anyDay ? picked : "agenda";
  const sel = when && (when.options.find((o) => o.key === when.current) ?? when.options[0]);

  function go(next: Tab) {
    setPicked(next);
    setMoved(true);
    const url = new URL(window.location.href);
    if (next === "dia") url.searchParams.set("v", "dia");
    else url.searchParams.delete("v");
    window.history.replaceState(null, "", url);
  }

  if (!anyDay) {
    return (
      <>
        {when && <WhenPicker when={when} />}
        {agenda}
      </>
    );
  }

  const menuOn = tab === "agenda" && !!sel;
  const btn = (t: Tab) => clsx("flex min-w-0 items-center justify-center gap-1.5 rounded-full py-2 transition", tab === t ? "bg-white shadow-soft" : "text-ink-2");

  return (
    <div>
      <div ref={box} className={clsx("relative px-5 pt-5", open && "z-30")}>
        <div role="tablist" className="grid grid-cols-2 rounded-full bg-bg-2 p-1 text-[14px] font-semibold">
          <button
            role="tab"
            aria-selected={tab === "agenda"}
            aria-haspopup={menuOn ? "menu" : undefined}
            aria-expanded={menuOn ? open : undefined}
            aria-label={sel ? `Agenda: ${sel.label}${menuOn ? ". Cambiar periodo" : ""}` : undefined}
            type="button"
            onClick={() => (tab === "agenda" ? menuOn && setOpen((o) => !o) : go("agenda"))}
            className={clsx(btn("agenda"), menuOn && "pr-1.5 active:scale-[0.97]")}
          >
            {sel?.live ? <Dot /> : <CalendarDays size={15} strokeWidth={2.4} aria-hidden className="shrink-0" />}
            <span className="truncate">{sel ? (sel.short ?? sel.label) : "Agenda"}</span>
            {menuOn && (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bg-2">
                <ChevronDown size={16} strokeWidth={2.4} aria-hidden className={clsx("transition-transform duration-200", open && "rotate-180")} />
              </span>
            )}
          </button>
          <button role="tab" aria-selected={tab === "dia"} type="button" onClick={() => tab !== "dia" && go("dia")} data-track="filter" data-label="vista:cualquier-dia" className={btn("dia")}>
            <Always size={15} strokeWidth={2.4} aria-hidden className={clsx("shrink-0", tab === "dia" && "text-[#17734a]")} />
            <span className="truncate">Cualquier día</span>
          </button>
        </div>
        {open && when && <WhenMenu when={when} sel={sel!} close={() => setOpen(false)} />}
      </div>
      <div key={tab} className={clsx(moved && (tab === "dia" ? "feed-from-right" : "feed-from-left"))}>
        {tab === "agenda" && when?.subtitle && <p className="px-5 pb-1 pt-3 text-[13px] text-ink-2">{when.subtitle}</p>}
        {tab === "dia" ? anyDay : agenda}
      </div>
    </div>
  );
}

/** Sin pestañas: el periodo como botón propio, con el resumen al lado. */
function WhenPicker({ when }: { when: When }) {
  const [open, setOpen] = useState(false);
  const box = useDismiss(open, () => setOpen(false));
  const sel = when.options.find((o) => o.key === when.current) ?? when.options[0];
  return (
    <div ref={box} className={clsx("relative flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 pb-3 pt-5", open && "z-30")}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Cuándo: ${sel.label}. Cambiar`}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "inline-flex h-11 touch-manipulation items-center gap-2 rounded-full border bg-white pl-4 pr-1.5 text-[15px] font-semibold shadow-soft transition active:scale-[0.97]",
          open ? "border-ink ring-1 ring-ink" : "border-line-2 hover:border-ink",
        )}
      >
        {sel.live ? <Dot /> : <CalendarDays size={17} strokeWidth={2.2} aria-hidden />}
        {sel.label}
        <span className="grid h-8 w-8 place-items-center rounded-full bg-bg-2">
          <ChevronDown size={17} strokeWidth={2.4} aria-hidden className={clsx("transition-transform duration-200", open && "rotate-180")} />
        </span>
      </button>
      {when.subtitle && <p className="text-[13px] text-ink-2">{when.subtitle}</p>}
      {open && <WhenMenu when={when} sel={sel} close={() => setOpen(false)} />}
    </div>
  );
}

function WhenMenu({ when, sel, close }: { when: When; sel: WhenOption; close: () => void }) {
  const { options } = when;
  return (
    <div role="menu" className="when-menu absolute left-3 top-[calc(100%+6px)] z-30 w-[min(320px,calc(100%-24px))] rounded-card border border-line bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
      {options.map((o, i) => {
        const on = o === sel;
        const cls = clsx("flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition hover:bg-bg-2", on && "bg-bg-2");
        const data = { role: "menuitemradio", "aria-checked": on, "data-track": "filter", "data-label": `cuando:${o.key}` } as const;
        const pick = () => { close(); o.onSelect?.(); };
        const inner = (
          <>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[15px] font-semibold">{o.live && <Dot />}{o.label}</span>
              <span className="block text-[13px] text-ink-2">{o.hint}</span>
            </span>
            {on && <Check size={18} strokeWidth={2.4} aria-hidden className="shrink-0" />}
          </>
        );
        return (
          <div key={o.key} className={clsx(i > 0 && options[i - 1].live && !o.live && "mt-1.5 border-t border-line/70 pt-1.5")}>
            {o.href && !on ? (
              <Link href={o.href} scroll={false} onClick={pick} className={cls} {...data}>{inner}</Link>
            ) : (
              <button type="button" onClick={pick} className={cls} {...data}>{inner}</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Cierra al tocar fuera o con Escape. */
function useDismiss(open: boolean, close: () => void) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && close();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);
  return box;
}
