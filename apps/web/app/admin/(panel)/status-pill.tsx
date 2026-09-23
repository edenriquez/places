import clsx from "clsx";

const MAP: Record<string, { label: string; cls: string }> = {
  queued: { label: "En cola", cls: "bg-bg-2 text-ink-2" },
  processing: { label: "Procesando", cls: "bg-[#fff4e0] text-[#a86400]" },
  needs_review: { label: "Revisar", cls: "bg-accent-soft text-accent" },
  approved: { label: "Listo", cls: "bg-free-bg text-free" },
  rejected: { label: "Descartado", cls: "bg-bg-2 text-ink-3" },
  duplicate: { label: "Duplicado", cls: "bg-bg-2 text-ink-3" },
  failed: { label: "Error", cls: "bg-[#fde8e5] text-error" },
  published: { label: "Publicado", cls: "bg-free-bg text-free" },
  pending: { label: "Pendiente", cls: "bg-accent-soft text-accent" },
  cancelled: { label: "Cancelado", cls: "bg-bg-2 text-ink-3" },
  // jobs
  running: { label: "Corriendo", cls: "bg-[#fff4e0] text-[#a86400]" },
  done: { label: "Terminada", cls: "bg-free-bg text-free" },
};

export function StatusPill({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, cls: "bg-bg-2 text-ink-2" };
  return <span className={clsx("inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold", s.cls)}>{s.label}</span>;
}
