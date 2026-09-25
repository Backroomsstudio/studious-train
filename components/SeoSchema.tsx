import { JsonLdScript } from "next-seo";
import { faqs, services, studioPhotos } from "@/lib/content";
import { SEO_DESCRIPTION, SEO_TITLE } from "@/lib/seo";
import { DAY_NAMES, SITE_URL, studio } from "@/lib/studio";

/**
 * Dati strutturati JSON-LD (schema.org) in un unico @graph collegato tramite @id:
 * RecordingStudio/LocalBusiness + WebSite + WebPage + FAQPage.
 * Renderizzato lato server: Google lo legge senza eseguire JavaScript.
 */
export function SeoSchema() {
  const studioId = `${SITE_URL}/#studio`;
  const websiteId = `${SITE_URL}/#website`;
  const pageId = `${SITE_URL}/#webpage`;
  const imageUrl = `${SITE_URL}/opengraph-image`;

  const recordingStudio = {
    "@type": ["RecordingStudio", "LocalBusiness"],
    "@id": studioId,
    name: studio.name,
    legalName: studio.legalName,
    description: studio.description,
    slogan: "Il suono di livello mondiale, nel cuore di Vicenza.",
    url: SITE_URL,
    image: [...studioPhotos.map((p) => `${SITE_URL}${p.src}`), imageUrl],
    logo: `${SITE_URL}/brand/logo-br.png`,
    telephone: studio.phone,
    email: studio.email,
    vatID: studio.vatId,
    foundingDate: String(studio.foundingYear),
    address: {
      "@type": "PostalAddress",
      streetAddress: studio.address.street,
      addressLocality: studio.address.city,
      addressRegion: studio.address.province,
      postalCode: studio.address.postalCode,
      addressCountry: studio.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: studio.geo.lat,
      longitude: studio.geo.lng,
    },
    hasMap: studio.googleMapsUrl,
    openingHoursSpecification: studio.openingHours.map((slot) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: slot.days.map((d) => `https://schema.org/${DAY_NAMES[d]}`),
      opens: slot.opens,
      closes: slot.closes,
    })),
    areaServed: studio.areaServed.map((city) => ({ "@type": "City", name: city })),
    sameAs: Object.values(studio.social),
    knowsAbout: [
      "Registrazione audio",
      "Mixaggio",
      "Mastering analogico",
      "Produzione musicale",
      "Beatmaking",
      "Podcast",
      "Sound design",
      "Voiceover",
    ],
    ...(studio.rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: studio.rating.value.toFixed(1),
            reviewCount: studio.rating.count,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Servizi dello studio di registrazione",
      itemListElement: services.map((s) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: s.title,
          description: s.description,
          serviceType: s.kicker,
          areaServed: { "@type": "City", name: studio.address.city },
          provider: { "@id": studioId },
        },
      })),
    },
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
