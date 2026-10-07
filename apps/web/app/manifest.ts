import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${SITE_NAME}: eventos en pueblos cerca de ti`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/?utm_source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "es-MX",
    dir: "ltr",
    categories: ["events", "travel", "lifestyle", "entertainment"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Este fin de semana", short_name: "Este finde", url: "/?r=finde", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Mapa de eventos", short_name: "Mapa", url: "/mapa", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Publicar un evento", short_name: "Publicar", url: "/publicar", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
