import Link from "next/link";
import clsx from "clsx";
import { fmtPrice } from "@/lib/format";

export function PriceTag({ isFree, min, max, className }: { isFree: boolean; min: number | null; max: number | null; className?: string }) {
  if (isFree) {
    return (
      <span className={clsx("inline-flex items-center rounded-full bg-free-bg px-2.5 py-1 text-[12px] font-semibold text-free", className)}>
        Gratis
      </span>
    );
  }
  return <span className={clsx("text-[15px] font-semibold text-ink", className)}>{fmtPrice(false, min, max)}</span>;
}

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full bg-[#fff0f3] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-live", className)}>
      <span className="relative inline-block h-2 w-2 rounded-full bg-live live-dot" />
      En vivo
    </span>
  );
}

export function SectionHeader({ title, subtitle, action, live }: { title: string; subtitle?: string; action?: React.ReactNode; live?: boolean }) {
  return (
    <div className="flex items-end justify-between px-5 pb-3 pt-7">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-[22px] font-bold leading-tight">{title}</h2>
          {live && <LiveBadge />}
        </div>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Chip({ active, children, href, onClick }: { active?: boolean; children: React.ReactNode; href?: string; onClick?: () => void }) {
  const cls = clsx(
    "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[14px] font-medium transition",
    active ? "border-ink bg-ink text-white" : "border-line-2 bg-white text-ink hover:border-ink",
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mx-5 rounded-card border border-dashed border-line-2 px-5 py-8 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-ink-2">{hint}</p>}
    </div>
  );
}
