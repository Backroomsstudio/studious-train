import type { MetadataRoute } from "next";
import { SEO_DESCRIPTION } from "@/lib/seo";
import { studio } from "@/lib/studio";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${studio.name} · Studio di registrazione Vicenza`,
    short_name: studio.name,
    description: SEO_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#0B0C10",
    theme_color: "#0B0C10",
    lang: "it",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
