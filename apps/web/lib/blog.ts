import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { Metadata } from "next";
import { Marked, type Tokens } from "marked";
import { parse as parseYaml } from "yaml";
import { BLOG_BASE, BLOG_COPY, LANG_TAG, LOCALES, postPath, type Locale } from "./blog-copy";
import { pageMetadata } from "./site";

/**
 * Blog: guías en Markdown dentro de `content/blog/<idioma>/<slug>.md`, con un encabezado YAML entre `---`.
 * Publicar es agregar el archivo; un post con `published` en el futuro no aparece hasta ese día (hora de la CDMX),
 * así que se pueden dejar listos semanas antes de cada fiesta. La línea `<!-- eventos -->` marca dónde va el
 * bloque de eventos en vivo; si falta, va al final del texto. `translation` es el slug del mismo post en el otro
 * idioma: con él se enlazan entre sí y se declaran como alternos (hreflang).
 *
 * `eventos` acepta fechas fijas (`{ desde, hasta }`) o un rango que se recalcula en cada visita, para las guías
 * que no caducan: `fin-de-semana` (de viernes a domingo, el que está en curso o el siguiente) o `proximos-30-dias`.
 */

const DIR = path.join(process.cwd(), "content/blog");
const EVENTS_MARKER = /^<!--\s*eventos\s*-->\s*$/m;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NEXT_DAYS = /^proximos-(\d{1,3})-dias$/;

export type FaqItem = { q: string; a: string };

export type EventWindow = { desde: string; hasta: string } | { rango: "fin-de-semana" } | { rango: "proximos"; dias: number };

export type PostMeta = {
  slug: string;
  locale: Locale;
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
  /** fechas de los eventos en vivo (ver `eventWindow`); sin ellas no hay bloque */
  eventos?: EventWindow;
  faq: FaqItem[];
  readingMinutes: number;
  /** slug del mismo post en el otro idioma */
  translation?: string;
  /** slugs de guías del mismo idioma que van primero en "Sigue leyendo" */
  relacionadas: string[];
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

const ymd = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

function parseEventWindow(file: string, v: unknown): EventWindow | undefined {
  if (v == null) return undefined;
  if (v === "fin-de-semana") return { rango: "fin-de-semana" };
  const next = typeof v === "string" ? v.match(NEXT_DAYS) : null;
  if (next) return { rango: "proximos", dias: Number(next[1]) };
  const { desde, hasta } = (typeof v === "object" ? v : {}) as { desde?: unknown; hasta?: unknown };
  const w = { desde: ymd(desde), hasta: ymd(hasta) };
  if (!DATE.test(w.desde) || !DATE.test(w.hasta)) {
    throw new Error(`${file}: "eventos" va con desde y hasta (YYYY-MM-DD), "fin-de-semana" o "proximos-N-dias"`);
  }
  return w;
}

/** Suma días a una fecha YYYY-MM-DD. */
const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/**
 * Fechas concretas del bloque de eventos, hoy en la CDMX. Fin de semana = viernes a domingo: de viernes a
 * domingo es el que está en curso; de lunes a jueves, el siguiente.
 */
export function eventWindow(w: EventWindow, today = todayMx()): { desde: string; hasta: string } {
  if ("desde" in w) return w;
  if (w.rango === "proximos") return { desde: today, hasta: addDays(today, w.dias - 1) };
  const sinceFriday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 2) % 7;
  const friday = sinceFriday <= 2 ? addDays(today, -sinceFriday) : addDays(today, 7 - sinceFriday);
  return { desde: friday, hasta: addDays(friday, 2) };
}

function parseFile(locale: Locale, slug: string, raw: string): Post {
  const file = `content/blog/${locale}/${slug}.md`;
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: falta el encabezado entre ---`);
  const fm = parseYaml(m[1]) as Record<string, unknown>;
  const body = m[2];

  const str = (k: string, required = true) => {
    const v = fm[k] instanceof Date ? (fm[k] as Date).toISOString().slice(0, 10) : fm[k];
    if (v == null && !required) return undefined;
    if (typeof v !== "string" || !v.trim()) throw new Error(`${file}: falta "${k}"`);
    return v.trim();
  };
  const published = str("published")!;
  const updated = str("updated", false) ?? published;
  for (const d of [published, updated]) if (!DATE.test(d)) throw new Error(`${file}: fecha inválida "${d}" (YYYY-MM-DD)`);
  const eventos = parseEventWindow(file, fm.eventos);

  const [beforeMd, afterMd = ""] = body.split(EVENTS_MARKER);
  const h2 = (md: string) => marked.lexer(md)
    .filter((t): t is Tokens.Heading => t.type === "heading" && t.depth === 2)
    .map((t) => ({ id: slugify(t.text), label: plainText(t.text) }));
  const tocBefore = h2(beforeMd);
  const words = body.split(/\s+/).filter(Boolean).length;

  return {
    slug,
    locale,
    title: str("title")!,
    ogTitle: str("ogTitle", false),
    description: str("description")!,
    published,
    updated,
    municipios: Array.isArray(fm.municipios) ? fm.municipios.map(String) : [],
    eventos,
    faq: Array.isArray(fm.faq) ? (fm.faq as FaqItem[]).map((f) => ({ q: String(f.q), a: String(f.a) })) : [],
    readingMinutes: Math.max(1, Math.round(words / 200)),
    translation: str("translation", false),
    relacionadas: Array.isArray(fm.relacionadas) ? fm.relacionadas.map(String) : [],
    before: marked.parse(beforeMd) as string,
    after: marked.parse(afterMd) as string,
    toc: [...tocBefore, ...h2(afterMd)],
    eventsAt: tocBefore.length,
  };
}

const allPosts = cache(async (locale: Locale): Promise<Post[]> => {
  const dir = path.join(DIR, locale);
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".md"));
  const posts = await Promise.all(files.map(async (f) => parseFile(locale, f.slice(0, -3), await readFile(path.join(dir, f), "utf8"))));
  return posts.sort((a, b) => b.published.localeCompare(a.published));
});

/** Los publicados a hoy, del más nuevo al más viejo. */
export async function listPosts(locale: Locale = "es"): Promise<PostMeta[]> {
  const today = todayMx();
  return (await allPosts(locale)).filter((p) => p.published <= today);
}

export async function postBySlug(slug: string, locale: Locale = "es"): Promise<Post | null> {
  const p = (await allPosts(locale)).find((x) => x.slug === slug);
  return p && p.published <= todayMx() ? p : null;
}

/** La traducción publicada del post, si existe. */
export async function translationOf(p: PostMeta): Promise<PostMeta | null> {
  if (!p.translation) return null;
  const other = LOCALES.find((l) => l !== p.locale)!;
  return postBySlug(p.translation, other);
}

/**
 * "Sigue leyendo": primero las `relacionadas` del encabezado, luego las que comparten más municipios y al final
 * las más nuevas, para que toda guía enlace a otras aunque no tenga nada en común.
 */
export async function relatedPosts(p: PostMeta, n = 3): Promise<PostMeta[]> {
  const others = (await listPosts(p.locale)).filter((x) => x.slug !== p.slug);
  const pinned = p.relacionadas.map((s) => others.find((x) => x.slug === s)).filter((x): x is PostMeta => !!x);
  const shared = (x: PostMeta) => x.municipios.filter((m) => p.municipios.includes(m)).length;
  const rest = others.filter((x) => !pinned.includes(x)).sort((a, b) => shared(b) - shared(a));
  return [...pinned, ...rest].slice(0, n);
}

/** Guías en español que mencionan un municipio (para enlazarlas desde su página). */
export async function postsForMunicipality(slug: string): Promise<PostMeta[]> {
  return (await listPosts("es")).filter((p) => p.municipios.includes(slug));
}

/** "15 de octubre de 2026" / "October 15, 2026" */
export const fmtPostDate = (d: string, locale: Locale = "es") =>
  new Intl.DateTimeFormat(LANG_TAG[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

/** "16–18 de octubre" / "October 16 – 18"; un solo día si coinciden. */
export const fmtDateRange = (desde: string, hasta: string, locale: Locale = "es") =>
  new Intl.DateTimeFormat(LANG_TAG[locale], { day: "numeric", month: "long", timeZone: "UTC" })
    .formatRange(new Date(`${desde}T12:00:00Z`), new Date(`${hasta}T12:00:00Z`));

/** hreflang: las dos versiones se declaran entre sí; x-default es la española. */
function languageAlternates(es: string | null, en: string | null) {
  const languages: Record<string, string> = {};
  if (es) languages[LANG_TAG.es] = es;
  if (en) languages[LANG_TAG.en] = en;
  if (es) languages["x-default"] = es;
  return Object.keys(languages).length > 1 ? languages : undefined;
}

export async function postAlternates(p: PostMeta) {
  const t = await translationOf(p);
  const self = postPath(p.slug, p.locale);
  const other = t ? postPath(t.slug, t.locale) : null;
  return p.locale === "es" ? languageAlternates(self, other) : languageAlternates(other, self);
}

export async function postMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const p = await postBySlug(slug, locale);
  if (!p) return { title: BLOG_COPY[locale].notFound, robots: { index: false, follow: true } };
  const path = postPath(p.slug, locale);
  const meta = pageMetadata({
    title: p.title,
    ogTitle: p.ogTitle,
    description: p.description,
    path,
    type: "article",
    images: [{ url: `${path}/opengraph-image`, alt: p.ogTitle ?? p.title, type: "image/jpeg" }],
  });
  return {
    ...meta,
    alternates: { ...meta.alternates, languages: await postAlternates(p) },
    openGraph: { ...meta.openGraph, type: "article", locale: LANG_TAG[locale].replace("-", "_"), publishedTime: p.published, modifiedTime: p.updated },
  };
}

export function blogIndexMetadata(locale: Locale): Metadata {
  const c = BLOG_COPY[locale];
  const meta = pageMetadata({ title: c.indexMetaTitle, ogTitle: c.indexOgTitle, description: c.indexMetaDescription, path: BLOG_BASE[locale] });
  return {
    ...meta,
    alternates: { ...meta.alternates, languages: languageAlternates(BLOG_BASE.es, BLOG_BASE.en) },
    openGraph: { ...meta.openGraph, locale: LANG_TAG[locale].replace("-", "_") },
  };
}
