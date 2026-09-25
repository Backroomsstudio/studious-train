import { JsonLdScript } from "next-seo";
import { faqs, reviews, services, studioPhotos } from "@/lib/content";
import { SEO_DESCRIPTION, SEO_TITLE } from "@/lib/seo";
import { activeSocials, googleMapsUrl, SITE_URL, studio } from "@/lib/studio";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => `https://schema.org/${d}`);

/**
 * Dati strutturati JSON-LD (schema.org) in un unico @graph collegato tramite @id:
 * RecordingStudio/LocalBusiness + WebSite + WebPage + FAQPage.
 * I campi non ancora compilati (telefono, email, P.IVA, coordinate, social) vengono omessi:
 * nessun dato inventato finisce nei risultati di Google.
 */
export function SeoSchema() {
  const studioId = `${SITE_URL}/#studio`;
  const websiteId = `${SITE_URL}/#website`;
  const pageId = `${SITE_URL}/#webpage`;
  const imageUrl = `${SITE_URL}/opengraph-image`;
  const sameAs = activeSocials().map((s) => s.url);

  const recordingStudio = {
    "@type": ["RecordingStudio", "LocalBusiness"],
    "@id": studioId,
    name: studio.name,
    alternateName: `${studio.name} · Studio Lounge`,
    legalName: studio.legalName,
    description: studio.description,
    slogan: "Il primo Studio Lounge di registrazione e Mix/Master a Vicenza.",
    url: SITE_URL,
    image: [...studioPhotos.map((p) => `${SITE_URL}${p.src}`), imageUrl],
    logo: `${SITE_URL}/brand/logo-br.png`,
    ...(studio.phone ? { telephone: studio.phone } : {}),
    ...(studio.email ? { email: studio.email } : {}),
    ...(studio.vatIds.length ? { vatID: studio.vatIds.length === 1 ? `IT${studio.vatIds[0]}` : studio.vatIds.map((v) => `IT${v}`) } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: studio.address.street,
      addressLocality: studio.address.city,
      addressRegion: studio.address.province,
      postalCode: studio.address.postalCode,
      addressCountry: studio.address.country,
    },
    ...(studio.geo ? { geo: { "@type": "GeoCoordinates", latitude: studio.geo.lat, longitude: studio.geo.lng } } : {}),
    hasMap: googleMapsUrl,
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ALL_DAYS,
        opens: "00:00",
        closes: "23:59",
      },
    ],
    areaServed: studio.areaServed.map((name) => ({ "@type": "Place", name })),
    ...(sameAs.length ? { sameAs } : {}),
    amenityFeature: [
      "Studio Lounge da 65 mq",
      "Fino a 6 ospiti per sessione",
      "TV 75 pollici con illuminazione LED",
      "PlayStation 4",
      "Piattaforme streaming (Netflix, Prime Video)",
      "Area relax con divani",
      "Zona bar con macchina del caffè, friggitrice ad aria e frigo",
      "Live streaming 4K delle sessioni",
    ].map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
    knowsAbout: ["Registrazione audio", "Vocal engineering", "Produzione musicale", "Beatmaking", "Arrangiamento", "Mix", "Master", "Live streaming"],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Servizi dello studio di registrazione",
      itemListElement: services.map((s) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: s.title,
          description: s.description,
          serviceType: s.mode,
          provider: { "@id": studioId },
          areaServed: s.mode === "A distanza" ? { "@type": "Country", name: "Italia" } : { "@type": "City", name: "Vicenza" },
        },
      })),
    },
    ...(reviews.length
      ? {
          review: reviews.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author },
            reviewBody: r.text,
          })),
        }
      : {}),
  };

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      recordingStudio,
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: SITE_URL,
        name: studio.name,
        inLanguage: "it-IT",
        publisher: { "@id": studioId },
      },
      {
        "@type": "WebPage",
        "@id": pageId,
        url: SITE_URL,
        name: SEO_TITLE,
        description: SEO_DESCRIPTION,
        inLanguage: "it-IT",
        isPartOf: { "@id": websiteId },
        about: { "@id": studioId },
        primaryImageOfPage: { "@type": "ImageObject", url: imageUrl, width: 1200, height: 630 },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        isPartOf: { "@id": pageId },
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return <JsonLdScript data={graph} scriptKey="studio-jsonld" id="studio-jsonld" />;
}
