import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF pesa bastante menos que WebP en los flyers (mucho texto y color plano); WebP queda de respaldo
    formats: ["image/avif", "image/webp"],
    // las rutas de los flyers llevan el hash del contenido (uploads/ab/<sha256>.png): nunca cambian en sitio,
    // así que se cachean 31 días en vez de 4 h y se re-optimizan menos (cada formato cuenta aparte)
    minimumCacheTTL: 2678400,
    // Supabase local corre en 127.0.0.1; solo en desarrollo se permite optimizar imágenes de IP privada.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "54361" },
      { protocol: "http", hostname: "localhost", port: "54361" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
