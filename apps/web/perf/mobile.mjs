#!/usr/bin/env node
/**
 * Carga en un teléfono de gama media (perfil móvil de Lighthouse: Moto G Power, CPU 4× más lenta,
 * 4G lento: 150 ms RTT, 1.6 Mbps). Corre cada escenario N veces con caché fría, toma la mediana y
 * falla (exit 1) si alguna métrica se pasa del presupuesto.
 *
 *   pnpm --filter web perf:mobile                                 # producción
 *   pnpm --filter web perf:mobile --url http://localhost:3000     # local (después de `next build && next start`)
 *   pnpm --filter web perf:mobile --runs 5 --cpu 6 --only home-returning,evento
 *
 * PERF_BYPASS: secreto de "Protection Bypass for Automation" de Vercel, para medir previews protegidos.
 *
 * `--cpu auto` (default) mide la máquina y elige el multiplicador para que el teléfono emulado sea el mismo
 * en cualquier lado: 4× en una Mac M-series, menos en un runner de CI más lento. `--cpu 6` lo fija.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import { pageFunctions } from "lighthouse/core/lib/page-functions.js";
import puppeteer from "puppeteer-core";

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    url: { type: "string", default: process.env.PERF_URL ?? "https://entrelugares-web-mauve.vercel.app" },
    runs: { type: "string", default: "3" },
    cpu: { type: "string", default: "auto" },
    // devtools: la red y la CPU se frenan de verdad; refleja prioridades y lazy loading y varía poco entre
    // corridas. simulate (el de PageSpeed) es más rápido, pero contra localhost su LCP brinca ±1.3 s
    throttling: { type: "string", default: "devtools" },
    only: { type: "string" },
    out: { type: "string", default: path.join(import.meta.dirname, "reports") },
  },
});

const BASE = new URL(args.url.replace(/\/$/, ""));
const RUNS = Number(args.runs);
const CHROME_FLAGS = ["--headless=new", "--no-first-run"];

/** benchmarkIndex de Lighthouse del teléfono emulado: lo que da una Mac M-series (~3600) con CPU 4× */
const TARGET_BENCHMARK = 900;

/** Mide la máquina con el mismo benchmark que Lighthouse y revisa si WebGL tiene GPU o es por software. */
async function probeHost() {
  const browser = await puppeteer.launch({ executablePath: chromeLauncher.Launcher.getFirstInstallation(), args: CHROME_FLAGS });
  try {
    const page = await browser.newPage();
    const bench = Math.max(
      await page.evaluate(pageFunctions.computeBenchmarkIndex),
      await page.evaluate(pageFunctions.computeBenchmarkIndex),
    );
    const renderer = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl");
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl ? "webgl" : "none";
    });
    return { bench, softwareGl: /swiftshader|llvmpipe|software|none/i.test(renderer), renderer };
  } finally {
    await browser.close();
  }
}
const HOST = await probeHost();
const CPU = args.cpu === "auto" ? Math.min(10, Math.max(1, Math.round((HOST.bench / TARGET_BENCHMARK) * 10) / 10)) : Number(args.cpu);

/**
 * Presupuesto contra regresiones, sobre la mediana de las corridas: un poco arriba de lo medido en oct 2026
 * contra producción. La meta sigue siendo el "bueno" de Core Web Vitals (LCP ≤ 2.5 s, FCP ≤ 1.8 s).
 * Los bytes cuentan todo lo que baja hasta que la red queda quieta, también lo diferido (mapa, relieve) y
 * dependen de qué flyers haya publicados.
 */
const BUDGET = { fcp: 2500, lcp: 4000, tbt: 300, cls: 0.1, jsKB: 250, totalKB: 1600 };

// quien ya eligió dónde buscar (la mayoría de las visitas): la página pide más eventos y pinta más tarjetas
const LOC = { name: "el_loc", value: encodeURIComponent(JSON.stringify({ lat: 18.9853, lng: -99.0997, radiusKm: 40, label: "Tepoztlán", cvegeo: "17020" })) };

/** Previews protegidos: el secreto se cambia por la cookie de Vercel para que no viaje a otros dominios. */
async function bypassCookies() {
  const secret = process.env.PERF_BYPASS;
  if (!secret) return [];
  const res = await fetch(BASE, { redirect: "manual", headers: { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" } });
  return res.headers.getSetCookie().map((c) => {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    return { name: pair.slice(0, i), value: pair.slice(i + 1) };
  });
}
const BYPASS = await bypassCookies();
const cookieHeader = (cookies) => cookies.map((c) => `${c.name}=${c.value}`).join("; ");

async function firstEventPath() {
  const html = await (await fetch(BASE, { headers: { cookie: cookieHeader([...BYPASS, LOC]) } })).text();
  return html.match(/href="(\/evento\/[^"?#]+)"/)?.[1];
}

/** `budget`: excepciones por escenario. `webgl`: pinta un mapa; sin GPU su TBT no dice nada del teléfono. */
const SCENARIOS = [
  { name: "home-first-visit", path: "/" },
  { name: "home-returning", path: "/", cookies: [LOC] },
  // la lista de Próximos siempre tiene varias tarjetas; "Ahora" depende de qué esté pasando a esa hora
  { name: "home-proximos", path: "/?r=15d", cookies: [LOC] },
  // maplibre (~430 KB br con el worker) es el contenido de la página; el sombreado son ~1 MB de teselas
  { name: "mapa", path: "/mapa", cookies: [LOC], webgl: true, budget: { jsKB: 700, totalKB: 3300 } },
  // el mini mapa es una imagen; maplibre solo baja si lo tocan
  { name: "evento", path: firstEventPath, cookies: [LOC] },
];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function runOnce(url, cookies) {
  // perfil nuevo por corrida: caché fría; las cookies se ponen en el navegador (solo viajan al sitio, y el
  // JS de la página las ve como en una visita real) y por eso no se limpia el storage antes de medir
  const chrome = await chromeLauncher.launch({ chromeFlags: CHROME_FLAGS });
  try {
    const all = [...BYPASS, ...cookies];
    if (all.length) {
      const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
      await browser.setCookie(...all.map((c) => ({ ...c, domain: BASE.hostname, path: "/", secure: BASE.protocol === "https:" })));
      await browser.disconnect();
    }
    return await lighthouse(url, {
      port: chrome.port,
      output: ["json", "html"],
      logLevel: "error",
      onlyCategories: ["performance"],
      formFactor: "mobile",
      disableStorageReset: true,
      throttlingMethod: args.throttling,
      throttling: {
        rttMs: 150,
        throughputKbps: 1638.4,
        requestLatencyMs: 150 * 3.75,
        downloadThroughputKbps: 1638.4 * 0.9,
        uploadThroughputKbps: 750 * 0.9,
        cpuSlowdownMultiplier: CPU,
      },
    });
  } finally {
    await chrome.kill();
  }
}

function metrics(lhr) {
  const a = lhr.audits;
  const byType = Object.fromEntries(
    (a["resource-summary"]?.details?.items ?? []).map((r) => [r.resourceType, r.transferSize]),
  );
  return {
    score: Math.round(lhr.categories.performance.score * 100),
    fcp: a["first-contentful-paint"].numericValue,
    lcp: a["largest-contentful-paint"].numericValue,
    tbt: a["total-blocking-time"].numericValue,
    cls: a["cumulative-layout-shift"].numericValue,
    si: a["speed-index"].numericValue,
    ttfb: a["server-response-time"]?.numericValue ?? NaN,
    jsKB: (byType.script ?? 0) / 1024,
    imgKB: (byType.image ?? 0) / 1024,
    totalKB: (byType.total ?? 0) / 1024,
    lcpElement: a["lcp-breakdown-insight"]?.details?.items?.find((i) => i.type === "node")?.snippet?.slice(0, 120),
  };
}

const fmt = { ms: (v) => `${Math.round(v)} ms`, kb: (v) => `${Math.round(v)} KB`, cls: (v) => v.toFixed(3) };
const COLS = [
  ["score", (v) => String(v)],
  ["fcp", fmt.ms],
  ["lcp", fmt.ms],
  ["tbt", fmt.ms],
  ["cls", fmt.cls],
  ["si", fmt.ms],
  ["ttfb", fmt.ms],
  ["jsKB", fmt.kb],
  ["imgKB", fmt.kb],
  ["totalKB", fmt.kb],
];

await fs.mkdir(args.out, { recursive: true });
const header = `Gama media · ${BASE.origin} · ${RUNS} corridas · CPU ${CPU}× (benchmarkIndex ${Math.round(HOST.bench)}) · ${args.throttling}`;
// sin GPU, maplibre pinta con WebGL por software y su TBT se dispara: se reporta, pero no cuenta
const gpuNote = HOST.softwareGl ? `WebGL por software (${HOST.renderer}): el TBT de las páginas con mapa no cuenta para el presupuesto` : "";
console.log(`${header}${gpuNote ? `\n${gpuNote}` : ""}\n`);

const failures = [];
const summary = [];
for (const sc of SCENARIOS.filter((s) => !args.only || args.only.split(",").includes(s.name))) {
  const p = typeof sc.path === "function" ? await sc.path() : sc.path;
  if (!p) {
    console.log(`- ${sc.name}: sin ruta (¿no hay eventos?), se omite`);
    continue;
  }
  const url = BASE.origin + p;
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const { lhr, report } = await runOnce(url, sc.cookies ?? []);
    if (lhr.runtimeError) throw new Error(`${sc.name}: ${lhr.runtimeError.message}`);
    const m = metrics(lhr);
    runs.push({ m, report });
    console.log(`  ${sc.name} #${i + 1}: score ${m.score} · LCP ${fmt.ms(m.lcp)} · TBT ${fmt.ms(m.tbt)} · ${fmt.kb(m.totalKB)}`);
  }
  const med = Object.fromEntries(COLS.map(([k]) => [k, median(runs.map((r) => r.m[k]))]));
  // reporte HTML de la corrida con el LCP mediano, para abrirlo y ver el detalle
  const rep = runs.reduce((best, r) => (Math.abs(r.m.lcp - med.lcp) < Math.abs(best.m.lcp - med.lcp) ? r : best));
  await fs.writeFile(path.join(args.out, `${sc.name}.html`), rep.report[1]);
  await fs.writeFile(path.join(args.out, `${sc.name}.json`), rep.report[0]);
  summary.push({ name: sc.name, url, med, lcpElement: rep.m.lcpElement });

  for (const [k, limit] of Object.entries({ ...BUDGET, ...sc.budget })) {
    if (k === "tbt" && sc.webgl && HOST.softwareGl) continue;
    if (med[k] > limit) failures.push(`${sc.name}: ${k} ${k === "cls" ? med[k].toFixed(3) : Math.round(med[k])} > ${limit}`);
  }
}

console.log("\nMedianas:");
console.table(Object.fromEntries(summary.map((s) => [s.name, Object.fromEntries(COLS.map(([k, f]) => [k, f(s.med[k])]))])));
for (const s of summary) console.log(`LCP ${s.name}: ${s.lcpElement ?? "—"}`);
console.log(`\nreportes en ${args.out}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    `### ${header}`,
    "",
    `| escenario | ${COLS.map(([k]) => k).join(" | ")} |`,
    `|---|${COLS.map(() => "---").join("|")}|`,
    ...summary.map((s) => `| [${s.name}](${s.url}) | ${COLS.map(([k, f]) => f(s.med[k])).join(" | ")} |`),
    "",
    failures.length ? `**Fuera de presupuesto:**\n${failures.map((f) => `- ${f}`).join("\n")}` : "Todo dentro del presupuesto.",
    gpuNote && `\n_${gpuNote}_`,
  ].join("\n");
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}

if (failures.length) {
  console.log(`\nFuera de presupuesto:\n  ${failures.join("\n  ")}`);
  if (process.env.GITHUB_ACTIONS) for (const f of failures) console.log(`::warning title=Presupuesto de rendimiento::${f}`);
  process.exit(1);
}
console.log("\nTodo dentro del presupuesto.");
