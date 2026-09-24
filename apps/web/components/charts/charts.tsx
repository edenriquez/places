import clsx from "clsx";

/**
 * Charts del admin, en SVG/HTML de servidor (sin librería). Paleta validada con el validador de dataviz
 * (azul/naranja, categórica en orden fijo; secuencial azul para magnitud). Texto siempre en tokens de
 * texto, nunca del color de la serie. Tooltips: <title> nativo sobre objetivos más grandes que la marca.
 */
export const SERIES = ["#2a78d6", "#eb6834"] as const;
// rampa secuencial azul (100 → 650) para el mapa de calor
const SEQ = ["#eef4fc", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#104281"];

const nf = new Intl.NumberFormat("es-MX");
const cf = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 });
export const fmtN = (n: number) => (n >= 10000 ? cf.format(n) : nf.format(n));
export const fmtPct = (n: number) => `${n >= 10 || n === 0 ? Math.round(n) : n.toFixed(1)}%`;

export function Card({ title, subtitle, children, className, action }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={clsx("rounded-card border border-line bg-white p-5", className)}>
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
    <div className="rounded-card border border-line bg-white p-4">
      <p className="text-[12px] font-medium text-ink-2">{label}</p>
      <p className={clsx("mt-1 font-semibold leading-none text-ink", hero ? "text-[44px]" : "text-[26px]")}>{value}</p>
      {hint && <p className="mt-1.5 text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}

/** Barras horizontales de una sola serie: etiqueta, barra delgada y valor en la punta. */
export function BarList({ rows, unit = "", showPct, color = SERIES[0], wideLabels }: {
  rows: { label: string; sub?: string | null; value: number }[];
  unit?: string;
  showPct?: boolean;
  color?: string;
  wideLabels?: boolean;
}) {
  if (!rows.length) return <Empty />;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = (r.value / total) * 100;
        const tip = `${r.label}${r.sub ? ` (${r.sub})` : ""}: ${nf.format(r.value)}${unit}${showPct ? ` · ${fmtPct(pct)}` : ""}`;
        return (
          <li key={`${r.label}-${r.sub ?? ""}`} title={tip} className={clsx("group grid items-center gap-3 text-[13px]", wideLabels ? "grid-cols-[minmax(0,13rem)_1fr]" : "grid-cols-[minmax(0,9rem)_1fr]")}>
            <span className="min-w-0 truncate">
              <span className="font-medium text-ink">{r.label}</span>
              {r.sub && <span className="text-ink-3"> · {r.sub}</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 rounded-r-[4px] transition-opacity group-hover:opacity-80" style={{ width: r.value ? `${Math.max(2, (r.value / max) * 100)}%` : 0, background: color, maxWidth: "calc(100% - 4.5rem)" }} />
              <span className="shrink-0 tabular-nums text-ink-2">
                {fmtN(r.value)}{unit}{showPct && <span className="text-ink-3"> · {fmtPct(pct)}</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
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
export function LineChart({ days, series, compact }: {
  days: { day: string; [k: string]: number | string }[];
  series: { key: string; label: string }[];
  compact?: boolean;
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
          <div key={t} className="absolute inset-x-0 border-t border-[#ebebeb]" style={{ top: `${yp(t)}%` }}>
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
        {/* punto final con anillo del color de la superficie + valor al final de la línea */}
        {series.map((s, i) => (
          <div key={s.key} className="pointer-events-none absolute" style={{ left: `${xp(last)}%`, top: `${yp(val(days[last], s.key))}%` }}>
            <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ background: SERIES[i] }} />
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
/** Día de la semana × hora (hora de México), rampa secuencial azul por cuantiles. */
export function Heatmap({ cells }: { cells: { dow: number; hour: number; n: number }[] }) {
  if (!cells.length) return <Empty />;
  const grid = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.n]));
  const max = Math.max(...cells.map((c) => c.n), 1);
  const color = (n: number) => (n ? SEQ[Math.min(SEQ.length - 1, 1 + Math.floor((n / max) * (SEQ.length - 2)))] : SEQ[0]);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[520px] grid-cols-[1.25rem_repeat(24,minmax(0,1fr))] gap-[2px] text-[10px] text-ink-3">
        {DOW.map((d, di) => (
          <div key={di} className="contents">
            <span className="self-center">{d}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const n = grid.get(`${di + 1}-${h}`) ?? 0;
              return <span key={h} title={`${["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][di]} ${h}:00 · ${fmtN(n)} vistas`} className="aspect-square rounded-[3px]" style={{ background: color(n) }} />;
            })}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 6 === 0 ? `${h}h` : ""}</span>)}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-3">
        Menos {SEQ.slice(1).map((c) => <span key={c} className="h-2.5 w-4 rounded-[2px]" style={{ background: c }} />)} Más
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
