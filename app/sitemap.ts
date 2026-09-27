import type { MetadataRoute } from "next";
import { landingPages } from "@/lib/landing-pages";
import { SITE_URL } from "@/lib/studio";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      images: [`${SITE_URL}/opengraph-image`],
    },
    ...landingPages.map((p) => ({
      url: `${SITE_URL}/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
