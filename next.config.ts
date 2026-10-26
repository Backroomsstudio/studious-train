import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Microfono solo per il nostro dominio: serve allo studio "Registra" (/beats/registra). La policy è
  // del documento, quindi va concessa a tutto il sito: ci si arriva anche con la navigazione client.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  images: { formats: ["image/avif", "image/webp"] },
  // Vecchie sezioni del Beat Store: Feed è dentro Cerca, Libreria è diventata Profilo, i servizi
  // dello Studio stanno in fondo a Registra. Temporanei (307): la struttura può ancora cambiare.
  async redirects() {
    return [
      { source: "/beats/feed", destination: "/beats/cerca", permanent: false },
      { source: "/beats/libreria", destination: "/beats/profilo", permanent: false },
      { source: "/beats/studio", destination: "/beats/registra#servizi", permanent: false },
      { source: "/beats/feat", destination: "/beats", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/audio/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
