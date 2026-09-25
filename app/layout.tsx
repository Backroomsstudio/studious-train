import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import { BookingProvider } from "@/components/BookingModal";
import { CustomCursor } from "@/components/CustomCursor";
import { SeoSchema } from "@/components/SeoSchema";
import { SmoothScroll } from "@/components/SmoothScroll";
import { SEO_DESCRIPTION, SEO_KEYWORDS, SEO_TITLE } from "@/lib/seo";
import { SITE_URL, studio } from "@/lib/studio";
import "./globals.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  applicationName: studio.name,
  authors: [{ name: studio.name, url: SITE_URL }],
  creator: studio.name,
  publisher: studio.name,
  category: "music",
  alternates: {
    canonical: "/",
    languages: { "it-IT": "/" },
  },
  formatDetection: { telephone: true, email: true, address: true },
  openGraph: {
    type: "website",
    locale: "it_IT",
    url: "/",
    siteName: studio.name,
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  other: {
    "geo.region": `IT-${studio.address.province}`,
    "geo.placename": studio.address.city,
    "geo.position": `${studio.geo.lat};${studio.geo.lng}`,
    ICBM: `${studio.geo.lat}, ${studio.geo.lng}`,
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0C10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${display.variable} ${sans.variable}`}>
      <body className="grain">
        <SeoSchema />
        <SmoothScroll>
          <BookingProvider>
            {children}
            <CustomCursor />
          </BookingProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}
