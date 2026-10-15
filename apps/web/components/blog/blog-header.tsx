import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Barra mínima del blog: volver a la izquierda y el cambio de idioma a la derecha. */
export function BlogHeader({ back, backLabel, switchTo }: {
  back: string;
  backLabel: string;
  switchTo?: { href: string; label: string; lang: string } | null;
}) {
  return (
    <header className="rise flex items-center justify-between text-[13px]">
      <Link href={back} className="group inline-flex items-center gap-2 font-medium text-ink-2 transition-colors hover:text-ink">
        <ArrowLeft size={16} className="transition-transform duration-300 group-hover:-translate-x-1" />
        {backLabel}
      </Link>
      {switchTo && (
        <Link href={switchTo.href} hrefLang={switchTo.lang} lang={switchTo.lang} className="link-line text-ink-2">
          {switchTo.label}
        </Link>
      )}
    </header>
  );
}
