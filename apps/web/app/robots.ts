import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/site";

// Admin y endpoints internos no aportan nada en un buscador (y /reporte son links privados). /perfil y /guardados
// sí se dejan rastrear: el menú los enlaza en todas las páginas y su `noindex` solo se respeta si el robot lo puede leer.
const PRIVATE = ["/admin", "/api/", "/auth/", "/oauth/", "/reporte/"];

// Buscadores con IA nombrados explícitamente: la agenda es pública y queremos que la citen con link.
const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot",
  "Perplexity-User", "Google-Extended", "Applebot-Extended", "meta-externalagent", "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: ["/", "/llms.txt"], disallow: PRIVATE },
    ],
    sitemap: absUrl("/sitemap.xml"),
  };
}
