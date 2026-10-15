import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { Marked, type Tokens } from "marked";
import { parse as parseYaml } from "yaml";

/**
 * Blog: guías en Markdown dentro de `content/blog/<slug>.md`, con un encabezado YAML entre `---`.
 * Publicar es agregar el archivo; un post con `published` en el futuro no aparece hasta ese día (hora de la CDMX),
 * así que se pueden dejar listos semanas antes de cada fiesta. La línea `<!-- eventos -->` marca dónde va el
 * bloque de eventos en vivo; si falta, va al final del texto.
 */

const DIR = path.join(process.cwd(), "content/blog");
const EVENTS_MARKER = /^<!--\s*eventos\s*-->\s*$/m;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FaqItem = { q: string; a: string };

export type PostMeta = {
  slug: string;
  title: string;
  /** título para compartir y para la tarjeta OG; si falta, `title` */
  ogTitle?: string;
  /** meta description: 150–160 caracteres */
  description: string;
  /** YYYY-MM-DD */
  published: string;
  updated: string;
  /** slugs de municipio: enlaces, portada y de dónde salen los eventos en vivo */
  municipios: string[];
  /** rango de fechas (YYYY-MM-DD, inclusive) de los eventos en vivo; sin él no hay bloque */
  eventos?: { desde: string; hasta: string };
  faq: FaqItem[];
  readingMinutes: number;
};

export type Post = PostMeta & {
  /** HTML antes y después del bloque de eventos */
  before: string;
  after: string;
  /** subtítulos (h2) para el índice; el bloque de eventos va después de los primeros `eventsAt` */
  toc: { id: string; label: string }[];
  eventsAt: number;
};

export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth, text }: Tokens.Heading) {
      const inner = this.parser.parseInline(tokens);
      return depth === 2 ? `<h2 id="${slugify(text)}">${inner}</h2>\n` : `<h${depth}>${inner}</h${depth}>\n`;
    },
    link({ href, title, tokens }: Tokens.Link) {
      const inner = this.parser.parseInline(tokens);
      const t = title ? ` title="${title.replace(/"/g, "&quot;")}"` : "";
      return href.startsWith("/") || href.startsWith("#")
        ? `<a href="${href}"${t}>${inner}</a>`
        : `<a href="${href}"${t} target="_blank" rel="noopener">${inner}</a>`;
    },
  },
});

/** Markdown en línea (respuestas de las preguntas frecuentes). */
export const inlineHtml = (md: string) => marked.parseInline(md) as string;

/** Texto sin Markdown para JSON-LD: `[texto](url)` → texto, sin asteriscos. */
export const plainText = (md: string) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "");

const todayMx = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

function parseFile(slug: string, raw: string): Post {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`content/blog/${slug}.md: falta el encabezado entre ---`);
  const fm = parseYaml(m[1]) as Record<string, unknown>;
  const body = m[2];

  const str = (k: string, required = true) => {
    const v = fm[k] instanceof Date ? (fm[k] as Date).toISOString().slice(0, 10) : fm[k];
    if (v == null && !required) return undefined;
    if (typeof v !== "string" || !v.trim()) throw new Error(`content/blog/${slug}.md: falta "${k}"`);
    return v.trim();
  };
  const published = str("published")!;
  const updated = str("updated", false) ?? published;
  for (const d of [published, updated]) if (!DATE.test(d)) throw new Error(`content/blog/${slug}.md: fecha inválida "${d}" (YYYY-MM-DD)`);
  const ev = fm.eventos as { desde?: unknown; hasta?: unknown } | undefined;
  const eventos = ev ? { desde: String(ev.desde), hasta: String(ev.hasta) } : undefined;
  if (eventos && (!DATE.test(eventos.desde) || !DATE.test(eventos.hasta))) throw new Error(`content/blog/${slug}.md: "eventos" necesita desde y hasta (YYYY-MM-DD)`);

  const [beforeMd, afterMd = ""] = body.split(EVENTS_MARKER);
  const h2 = (md: string) => marked.lexer(md)
    .filter((t): t is Tokens.Heading => t.type === "heading" && t.depth === 2)
    .map((t) => ({ id: slugify(t.text), label: plainText(t.text) }));
  const tocBefore = h2(beforeMd);
  const words = body.split(/\s+/).filter(Boolean).length;

  return {
    slug,
    title: str("title")!,
    ogTitle: str("ogTitle", false),
    description: str("description")!,
    published,
    updated,
    municipios: Array.isArray(fm.municipios) ? fm.municipios.map(String) : [],
    eventos,
    faq: Array.isArray(fm.faq) ? (fm.faq as FaqItem[]).map((f) => ({ q: String(f.q), a: String(f.a) })) : [],
    readingMinutes: Math.max(1, Math.round(words / 200)),
    before: marked.parse(beforeMd) as string,
    after: marked.parse(afterMd) as string,
    toc: [...tocBefore, ...h2(afterMd)],
    eventsAt: tocBefore.length,
  };
}

const allPosts = cache(async (): Promise<Post[]> => {
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".md"));
  const posts = await Promise.all(files.map(async (f) => parseFile(f.slice(0, -3), await readFile(path.join(DIR, f), "utf8"))));
  return posts.sort((a, b) => b.published.localeCompare(a.published));
});

/** Los publicados a hoy, del más nuevo al más viejo. */
export async function listPosts(): Promise<PostMeta[]> {
  const today = todayMx();
  return (await allPosts()).filter((p) => p.published <= today);
}

export async function postBySlug(slug: string): Promise<Post | null> {
  const p = (await allPosts()).find((x) => x.slug === slug);
  return p && p.published <= todayMx() ? p : null;
}

/** Guías que mencionan un municipio (para enlazarlas desde su página). */
export async function postsForMunicipality(slug: string): Promise<PostMeta[]> {
  return (await listPosts()).filter((p) => p.municipios.includes(slug));
}

/** "15 de octubre de 2026" */
export const fmtPostDate = (d: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
