import Link from "next/link";
import { BackButton } from "./back-button";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * Plantilla de las páginas legales (/privacidad, /terminos): índice con anclas, fecha de actualización y enlace a la otra.
 * Cada sección lleva `id` para poder enlazar directo ("/privacidad#arco").
 */
export function LegalPage({ title, updated, intro, toc, other, children }: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  toc: { id: string; label: string }[];
  other: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[720px] px-5 pb-20 pt-6 text-[15px] leading-relaxed text-ink-2 [&_b]:text-ink [&_li]:mt-1.5">
      <BackButton className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-bg-2" />
      <h1 className="mt-5 text-[28px] font-bold leading-tight text-ink">{title}</h1>
      <p className="mt-1 text-[13px]">Última actualización: <time>{updated}</time></p>

      <div className="mt-6">{intro}</div>

      <nav aria-label="Contenido" className="mt-6 rounded-card border border-line bg-bg-2/50 px-5 py-4">
        <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink">Contenido</p>
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[14px]">
          {toc.map((t) => <li key={t.id} className="!mt-0.5"><a href={`#${t.id}`} className="hover:text-ink hover:underline">{t.label}</a></li>)}
        </ol>
      </nav>

      {children}

      <footer className="mt-10 border-t border-line pt-6 text-[14px]">
        <p>
          ¿Dudas? Escríbenos a <Mail />. Consulta también nuestro <Link href={other.href} className="font-medium text-ink underline">{other.label}</Link>.
        </p>
      </footer>
    </main>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mt-9 text-[18px] font-bold text-ink">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5">{children}</ul>;
}

export function Mail({ subject }: { subject?: string }) {
  return (
    <a href={`mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`} className="font-medium text-ink underline">
      {CONTACT_EMAIL}
    </a>
  );
}
