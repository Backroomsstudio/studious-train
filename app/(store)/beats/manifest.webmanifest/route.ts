import type { MetadataRoute } from "next";

/**
 * Manifest dell'app installabile del Beat Store, con scope /beats.
 * Il file convenzionale `app/manifest.ts` vale solo alla radice di `app` ed è quello della landing:
 * il negozio ha il suo, servito qui e collegato da `metadata.manifest` nel layout del negozio.
 */
export const dynamic = "force-static";

const manifest: MetadataRoute.Manifest = {
  id: "/beats",
  name: "Backrooms Beat Store",
  short_name: "Backrooms Beats",
  description: "Beat, stems e licenze dei produttori resident di Backrooms Studio. Ascolta, sblocca con i crediti, scarica.",
  start_url: "/beats",
  scope: "/beats",
  display: "standalone",
  orientation: "portrait",
  background_color: "#f8f9fa",
  theme_color: "#f8f9fa",
  lang: "it",
  categories: ["music", "entertainment"],
  icons: [
    { src: "/brand/beats-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/brand/beats-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/brand/beats-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "Nuove uscite", url: "/beats/feed" },
    { name: "Cerca un beat", url: "/beats/cerca" },
    { name: "La tua libreria", url: "/beats/libreria" },
  ],
};

export function GET() {
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
