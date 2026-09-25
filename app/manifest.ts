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
    background_color: "#0D0D0D",
    theme_color: "#0D0D0D",
    lang: "it",
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
