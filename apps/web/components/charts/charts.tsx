import clsx from "clsx";

/**
 * Charts del admin, en SVG/HTML de servidor (sin librería). Paleta validada con el validador de dataviz
 * (azul/naranja, categórica en orden fijo; secuencial azul para magnitud). Texto siempre en tokens de
 * texto, nunca del color de la serie. Tooltips: <title> nativo sobre objetivos más grandes que la marca.
 */
export const SERIES = ["#2a78d6", "#eb6834"] as const;
// rampa secuencial azul (100 → 650) para el mapa de calor
// barras sin foco: el paso claro de la rampa (misma entidad, menos peso); el valor siempre va en texto al lado
export const MUTED = "#c4d9f3";
const SEQ = ["#eef4fc", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#104281"];

/** Paso de la rampa secuencial para un valor (celdas de tabla de calor); el texto encima cambia a blanco en los pasos oscuros. */
export function seqStep(v: number, max: number) {
  if (!v || max <= 0) return { bg: "transparent", dark: false };
  const i = Math.min(SEQ.length - 1, 1 + Math.floor((v / max) * (SEQ.length - 2)));
  return { bg: SEQ[i], dark: i >= 5 };
}

const nf = new Intl.NumberFormat("es-MX");
const cf = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 });
export const fmtN = (n: number) => (n >= 10000 ? cf.format(n) : nf.format(n));
export const fmtPct = (n: number) => `${n >= 10 || n === 0 ? Math.round(n) : n.toFixed(1)}%`;

const UNKNOWN = /^sin (dato|ubicación)$/i;

/**
 * Quién lidera una lista y con qué parte del total. "Sin dato" nunca es el hallazgo, y si el segundo está a menos
 * de 10% del primero no hay líder: van parejos (no se destaca a nadie y el título lo dice).
 */
export function leader<T extends { label: string; value: number }>(rows: T[]) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  const known = rows.filter((r) => !UNKNOWN.test(r.label) && r.value > 0).sort((a, b) => b.value - a.value);
  if (!known.length || !total) return null;
  const [top, second] = known;
  return { row: top, pct: (top.value / total) * 100, second, secondPct: second ? (second.value / total) * 100 : 0, tied: !!second && second.value >= top.value * 0.9, total };
}

/** Título con el hallazgo de una lista: quién lidera y cuánto; si van parejos, lo dice; sin datos, la métrica. */
export function finding<T extends { label: string; value: number }>(rows: T[], say: (label: string, pct: string, row: T) => string, fallback: string) {
  const l = leader(rows);
  if (!l) return fallback;
  if (l.tied && l.second) return `${l.row.label} y ${l.second.label} van parejos (${fmtPct(l.pct)} y ${fmtPct(l.secondPct)})`;
  return say(l.row.label, fmtPct(l.pct), l.row);
}

export function Card({ title, subtitle, children, className, action }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={clsx("rounded-card border border-line bg-surface p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-ink-2">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Empty({ children = "Aún no hay datos en este rango." }: { children?: React.ReactNode }) {
  return <p className="py-6 text-center text-[13px] text-ink-3">{children}</p>;
}

/** Cifra con etiqueta. `hero`: la única cifra grande de la vista. */
export function Stat({ label, value, hint, hero }: { label: string; value: string; hint?: string; hero?: boolean }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-[12px] font-medium text-ink-2">{label}</p>
      <p className={clsx("mt-1 font-semibold leading-none text-ink", hero ? "text-[44px]" : "text-[26px]")}>{value}</p>
      {hint && <p className="mt-1.5 text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}

/**
 * Barras horizontales de una sola serie: etiqueta, barra delgada y valor en la punta.
 * `focus`: la barra de la que habla el título va en color y el resto en el tono claro de la misma rampa (siguen
 * visibles para verificar). `reference`: línea punteada vertical (promedio, meta) con su etiqueta.
 */
export function BarList({ rows, unit = "", showPct, color = SERIES[0], wideLabels, focus, reference }: {
  rows: { label: string; sub?: string | null; value: number }[];
  unit?: string;
  showPct?: boolean;
  color?: string;
  wideLabels?: boolean;
  /** etiqueta a destacar; "top" = la más grande */
  focus?: string | "top";
  reference?: { value: number; label: string };
}) {
  if (!rows.length) return <Empty />;
  const max = Math.max(...rows.map((r) => r.value), reference?.value ?? 0, 1);
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  const lead = focus === "top" ? leader(rows) : null;
  const focusLabel = focus === "top" ? (lead && !lead.tied ? lead.row.label : undefined) : focus;
  // la barra ocupa hasta (100% - 4.5rem); la referencia se ubica en la misma escala
  const at = (v: number) => `calc((100% - 4.5rem) * ${v / max})`;
  return (
    <div>
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const pct = (r.value / total) * 100;
          const on = !focusLabel || r.label === focusLabel;
          const tip = `${r.label}${r.sub ? ` (${r.sub})` : ""}: ${nf.format(r.value)}${unit}${showPct ? ` · ${fmtPct(pct)}` : ""}`;
          return (
            <li key={`${r.label}-${r.sub ?? ""}`} title={tip} className={clsx("group grid items-center gap-3 text-[13px]", wideLabels ? "grid-cols-[minmax(0,13rem)_1fr]" : "grid-cols-[minmax(0,9rem)_1fr]")}>
              <span className="min-w-0 truncate">
                <span className={clsx("text-ink", focusLabel && on ? "font-semibold" : "font-medium")}>{r.label}</span>
                {r.sub && <span className="text-ink-3"> · {r.sub}</span>}
              </span>
              <span className="relative flex items-center gap-2">
                <span className="h-3 rounded-r-[4px] transition-opacity group-hover:opacity-80" style={{ width: r.value ? `max(2px, ${at(r.value)})` : 0, background: on ? color : MUTED }} />
                <span className="shrink-0 tabular-nums text-ink-2">
                  {fmtN(r.value)}{unit}{showPct && <span className="text-ink-3"> · {fmtPct(pct)}</span>}
                </span>
                {reference && <span aria-hidden className="pointer-events-none absolute -inset-y-1.5 border-l border-dashed border-ink-3" style={{ left: at(reference.value) }} />}
              </span>
            </li>
          );
        })}
      </ul>
      {reference && (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-ink-2">
          <span aria-hidden className="h-3 border-l border-dashed border-ink-3" />{reference.label}: <span className="tabular-nums">{fmtN(Math.round(reference.value * 10) / 10)}{unit}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Dos medidas comparables por renglón (p. ej. % de la demanda contra % de la oferta), en la misma escala.
 * Dos barras delgadas por renglón, leyenda arriba y el valor en texto: nunca solo color.
 */
export function PairedBars({ rows, series, unit = "", flag }: {
  rows: { label: string; a: number; b: number; note?: string }[];
  series: [string, string];
  unit?: string;
  /** etiqueta corta para los renglones con alerta (va como texto, no solo color) */
  flag?: (r: { a: number; b: number }) => string | null;
}) {
  if (!rows.length || rows.every((r) => !r.a && !r.b)) return <Empty />;
  const max = Math.max(...rows.flatMap((r) => [r.a, r.b]), 1);
  const bar = (v: number, i: 0 | 1, label: string) => (
    <span className="flex items-center gap-2" title={`${label}: ${fmtN(Math.round(v))}${unit}`}>
      <span className="h-2 rounded-r-[3px]" style={{ width: v ? `max(2px, calc((100% - 3.5rem) * ${v / max}))` : 0, background: SERIES[i] }} />
      <span className="shrink-0 text-[12px] tabular-nums text-ink-2">{Math.round(v)}{unit}</span>
    </span>
  );
  return (
    <div>
      <ul className="mb-3 flex gap-4 text-[12px] text-ink-2">
        {series.map((s, i) => <li key={s} className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-[2px]" style={{ background: SERIES[i] }} />{s}</li>)}
      </ul>
      <ul className="space-y-3">
        {rows.map((r) => {
          const f = flag?.(r);
          return (
            <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-[13px]">
              <span className="min-w-0">
                <span className={clsx("block truncate text-ink", f ? "font-semibold" : "font-medium")}>{r.label}</span>
                {(f || r.note) && <span className="block truncate text-[11px] text-ink-3">{[f && <b key="f" className="font-semibold text-warn-ink">{f}</b>, r.note].filter(Boolean).reduce<React.ReactNode[]>((acc, x, i) => (i ? [...acc, " · ", x] : [x]), [])}</span>}
              </span>
              <span className="space-y-1">{bar(r.a, 0, series[0])}{bar(r.b, 1, series[1])}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Proporción de un todo en 2–3 partes (dispositivos): barra apilada con separación de 2px + leyenda. */
export function SplitBar({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <Empty />;
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-[4px]">
        {parts.map((p, i) => (
          <span key={p.label} title={`${p.label}: ${fmtPct((p.value / total) * 100)}`} style={{ width: `${(p.value / total) * 100}%`, background: SERIES[i % SERIES.length] }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
            <span className="text-ink">{p.label}</span>
            <span className="tabular-nums text-ink-2">{fmtPct((p.value / total) * 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const niceMax = (v: number) => {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p / (v / p > 5 ? 2 : 1)) * p * (v / p > 5 ? 2 : 1);
};
const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

/**
 * Serie diaria: 1–2 líneas en un solo eje, lavado bajo la primera, tooltip por día y tabla.
 * El trazo es SVG estirable (preserveAspectRatio="none", trazo que no escala); ejes, puntos y
 * etiquetas son HTML, así el texto mide lo mismo en una columna angosta que a todo lo ancho.
 */
export function LineChart({ days, series, compact, average }: {
  days: { day: string; [k: string]: number | string }[];
  series: { key: string; label: string }[];
  compact?: boolean;
  /** línea punteada con el promedio diario de la primera serie (referencia interna) */
  average?: boolean;
}) {
  if (!days.length) return <Empty />;
  const val = (d: (typeof days)[number], k: string) => Number(d[k]) || 0;
  const max = niceMax(Math.max(1, ...days.flatMap((d) => series.map((s) => val(d, s.key)))));
  const n = days.length;
  const xp = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100); // % del ancho
  const yp = (v: number) => (1 - v / max) * 100; // % del alto
  const path = (k: string) => days.map((d, i) => `${i ? "L" : "M"}${(xp(i) * 10).toFixed(1)},${yp(val(d, k)).toFixed(2)}`).join("");
  const ticks = [max, max / 2, 0];
  const xTicks = n <= 7 ? days.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  const last = n - 1;
  // anotación: el pico de la primera serie (si no es el último punto, que ya lleva su valor)
  const first = series[0].key;
  const peak = days.reduce((m, d, i) => (val(d, first) > val(days[m], first) ? i : m), 0);
  const showPeak = n > 2 && peak !== last && val(days[peak], first) > 0;
  const avg = days.reduce((a, d) => a + val(d, first), 0) / n;
  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-3 flex gap-4 text-[12px] text-ink-2">
          {series.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5"><span className="h-[2px] w-4 rounded" style={{ background: SERIES[i] }} />{s.label}</li>
          ))}
        </ul>
      )}
      <div className={clsx("relative ml-9 mr-10", compact ? "h-[120px]" : "h-[180px]")} role="img" aria-label={`Serie diaria: ${series.map((s) => s.label).join(" y ")}`}>
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: `${yp(t)}%` }}>
            <span className="absolute -left-9 w-7 -translate-y-1/2 text-right text-[11px] tabular-nums text-ink-3">{fmtN(t)}</span>
          </div>
        ))}
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <path d={`${path(series[0].key)}L${xp(last) * 10},100L${xp(0) * 10},100Z`} fill={SERIES[0]} opacity={0.1} />
          {series.map((s, i) => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={SERIES[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
          {/* objetivos de hover: una franja por día con cruce vertical */}
          {days.map((d, i) => {
            const w = n > 1 ? 1000 / (n - 1) : 1000;
            return (
              <g key={d.day} className="group">
                <rect x={xp(i) * 10 - w / 2} y={0} width={w} height={100} fill="transparent" />
                <line x1={xp(i) * 10} x2={xp(i) * 10} y1={0} y2={100} stroke="#b0b0b0" strokeWidth={1} vectorEffect="non-scaling-stroke" className="opacity-0 group-hover:opacity-100" />
                <title>{`${dayLabel(d.day)} · ${series.map((s) => `${s.label}: ${fmtN(val(d, s.key))}`).join(" · ")}`}</title>
              </g>
            );
          })}
        </svg>
        {average && avg > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3" style={{ top: `${yp(avg)}%` }}>
            <span className="absolute right-0 -translate-y-full pb-0.5 text-[11px] tabular-nums text-ink-2">prom. {fmtN(Math.round(avg * 10) / 10)}/día</span>
          </div>
        )}
        {showPeak && (
          <div className="pointer-events-none absolute" style={{ left: `${xp(peak)}%`, top: `${yp(val(days[peak], first))}%` }}>
            <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface" style={{ borderColor: SERIES[0] }} />
            <span className={clsx("absolute bottom-2 whitespace-nowrap text-[11px] font-medium tabular-nums text-ink", peak < n * 0.15 ? "" : peak > n * 0.85 ? "-translate-x-full" : "-translate-x-1/2")}>
              máx. {fmtN(val(days[peak], first))} · {dayLabel(days[peak].day)}
            </span>
          </div>
        )}
        {/* punto final con anillo del color de la superficie + valor al final de la línea */}
        {series.map((s, i) => (
          <div key={s.key} className="pointer-events-none absolute" style={{ left: `${xp(last)}%`, top: `${yp(val(days[last], s.key))}%` }}>
            <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ background: SERIES[i] }} />
            <span className="absolute left-2.5 -translate-y-1/2 text-[11px] font-medium tabular-nums text-ink">{fmtN(val(days[last], s.key))}</span>
          </div>
        ))}
        {xTicks.map((i) => (
          <span key={i} className={clsx("absolute top-full mt-1.5 whitespace-nowrap text-[11px] text-ink-3", i === 0 ? "" : i === last ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${xp(i)}%` }}>
            {dayLabel(days[i].day)}
          </span>
        ))}
      </div>
      <details className="mt-8 text-[12px] text-ink-2">
        <summary className="cursor-pointer select-none">Ver tabla</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead><tr className="text-left text-ink-3"><th className="py-1 font-medium">Día</th>{series.map((s) => <th key={s.key} className="py-1 text-right font-medium">{s.label}</th>)}</tr></thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-t border-line"><td className="py-1">{dayLabel(d.day)}</td>{series.map((s) => <td key={s.key} className="py-1 text-right">{fmtN(val(d, s.key))}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const DOW_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Celda con más actividad y la franja del día donde se concentra: para el título del mapa de calor. */
export function heatPeak(cells: { dow: number; hour: number; n: number }[]) {
  if (!cells.length) return null;
  const top = cells.reduce((m, c) => (c.n > m.n ? c : m));
  const total = cells.reduce((a, c) => a + c.n, 0) || 1;
  const weekend = cells.filter((c) => c.dow >= 5).reduce((a, c) => a + c.n, 0);
  const evening = cells.filter((c) => c.hour >= 18).reduce((a, c) => a + c.n, 0);
  return { ...top, day: DOW_LONG[top.dow - 1], weekendPct: (weekend / total) * 100, eveningPct: (evening / total) * 100 };
}
/** Día de la semana × hora (hora de México), rampa secuencial azul por cuantiles. */
export function Heatmap({ cells, unit = "vistas" }: { cells: { dow: number; hour: number; n: number }[]; unit?: string }) {
  if (!cells.length) return <Empty />;
  const grid = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.n]));
  const max = Math.max(...cells.map((c) => c.n), 1);
  const color = (n: number) => (n ? SEQ[Math.min(SEQ.length - 1, 1 + Math.floor((n / max) * (SEQ.length - 2)))] : SEQ[0]);
  const peak = heatPeak(cells)!;
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[520px] grid-cols-[1.25rem_repeat(24,minmax(0,1fr))] gap-[2px] text-[10px] text-ink-3">
        {DOW.map((d, di) => (
          <div key={di} className="contents">
            <span className="self-center">{d}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const n = grid.get(`${di + 1}-${h}`) ?? 0;
              const top = peak.dow === di + 1 && peak.hour === h;
              return <span key={h} title={`${DOW_LONG[di]} ${h}:00 · ${fmtN(n)} ${unit}`} className={clsx("aspect-square rounded-[3px]", top && "ring-2 ring-ink ring-offset-1")} style={{ background: color(n) }} />;
            })}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 6 === 0 ? `${h}h` : ""}</span>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-3">
        <span className="flex items-center gap-2">Menos {SEQ.slice(1).map((c) => <span key={c} className="h-2.5 w-4 rounded-[2px]" style={{ background: c }} />)} Más</span>
        <span className="flex items-center gap-1.5 text-ink-2"><span className="h-2.5 w-2.5 rounded-[2px] ring-2 ring-ink" />Pico: {DOW_LONG[peak.dow - 1]} {peak.hour}:00 · {fmtN(peak.n)} {unit}</span>
      </div>
    </div>
  );
}

/** Embudo: etapas ordenadas, una sola tonalidad, con % respecto a la etapa anterior. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(steps[0]?.value ?? 0, 1);
  if (!steps[0]?.value) return <Empty />;
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : s.value;
        return (
          <li key={s.label} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 text-[13px]" title={`${s.label}: ${fmtN(s.value)}`}>
            <span className="truncate font-medium">{s.label}</span>
            <span className="flex items-center gap-2">
              <span className="h-3 rounded-r-[4px]" style={{ width: `${Math.max(2, (s.value / top) * 100)}%`, background: SERIES[0], maxWidth: "calc(100% - 6rem)" }} />
              <span className="shrink-0 tabular-nums text-ink-2">{fmtN(s.value)}{i > 0 && <span className="text-ink-3"> · {fmtPct(prev ? (s.value / prev) * 100 : 0)}</span>}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
