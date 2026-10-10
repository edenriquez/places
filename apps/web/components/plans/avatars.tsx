import clsx from "clsx";
import type { Person } from "@/lib/group-plans";

export function Avatar({ p, size = 28, className }: { p: Person; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  return p.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatar externo de Google
    <img src={p.avatar} alt={p.name} title={p.name} referrerPolicy="no-referrer" style={style} className={clsx("rounded-full object-cover ring-2 ring-white", className)} />
  ) : (
    <span title={p.name} style={style} className={clsx("grid place-items-center rounded-full bg-accent-soft font-bold text-accent ring-2 ring-white", className)}>
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Caras encimadas; si hay más de `max`, un "+n". `total` cuenta también a quien no se muestra (sin cuenta). */
export function Avatars({ people, total, max = 4, size = 28, className }: { people: Person[]; total?: number; max?: number; size?: number; className?: string }) {
  const n = total ?? people.length;
  const shown = people.slice(0, max);
  const rest = n - shown.length;
  if (!n) return null;
  return (
    <span className={clsx("flex items-center -space-x-2", className)}>
      {shown.map((p) => <Avatar key={p.id} p={p} size={size} />)}
      {rest > 0 && (
        <span style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} className="grid place-items-center rounded-full bg-bg-2 font-semibold text-ink-2 ring-2 ring-white">
          +{rest}
        </span>
      )}
    </span>
  );
}
