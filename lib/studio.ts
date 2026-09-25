/**
 * Dati anagrafici dello studio: UNICA fonte di verità per NAP (Name, Address, Phone),
 * orari, contatti e social. Riusati in pagina, footer, JSON-LD, sitemap e OG image.
 *
 * Regola: solo dati reali. I campi lasciati vuoti ("") vengono nascosti automaticamente
 * dal sito e dai dati strutturati, invece di mostrare valori inventati.
 */

const FALLBACK_SITE_URL = "https://www.backroomsstudio.it";

/**
 * URL pubblico del sito. Ordine: NEXT_PUBLIC_SITE_URL → dominio di produzione Vercel → fallback.
 * Valori vuoti, senza protocollo o non validi non fanno fallire la build.
 */
function resolveSiteUrl(): string {
  const candidates = [process.env.NEXT_PUBLIC_SITE_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL, FALLBACK_SITE_URL];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).origin;
    } catch {
      // valore non valido: si prova il successivo
    }
  }
  return FALLBACK_SITE_URL;
}

export const SITE_URL = resolveSiteUrl();

export const studio = {
  name: "Backrooms Studio",
  legalName: "Backrooms Studio", // DA COMPILARE: ragione sociale esatta, se diversa
  concept: "Studio Lounge",
  description:
    "Studio Lounge di registrazione, produzione musicale, mix e master ad Arcugnano (Vicenza): 65 mq in stile americano, aperto 24/7, con live streaming 4K delle sessioni.",

  /** DA COMPILARE: Partita IVA (es. "IT01234567890"). Vuota = non mostrata. */
  vatId: "",

  address: {
    street: "Via Galileo Galilei, 3",
    postalCode: "36057",
    city: "Arcugnano",
    province: "VI",
    provinceName: "Vicenza",
    region: "Veneto",
    country: "IT",
  },
  /** DA COMPILARE (facoltativo): coordinate esatte dell'ingresso da Google Maps. null = omesse. */
  geo: null as { lat: number; lng: number } | null,

  /** Contatti. Vuoti = pulsanti nascosti. whatsapp in formato internazionale senza "+" (es. "393331234567"). */
  phone: "", // DA COMPILARE, es. "+39 333 123 4567"
  whatsapp: "", // DA COMPILARE
  email: "", // DA COMPILARE

  /** Aperto 24 ore su 24, 7 giorni su 7. */
  open247: true,

  /** DA COMPILARE: link reali ai profili. Vuoti = non mostrati. */
  social: {
    instagram: "",
    tiktok: "",
    youtube: "",
    twitch: "",
    kick: "",
  },

  areaServed: ["Arcugnano", "Vicenza", "Veneto", "Italia"],
} as const;

export type SocialKey = keyof typeof studio.social;

export const SOCIAL_LABELS: Record<SocialKey, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitch: "Twitch",
  kick: "Kick",
};

export const fullAddress = `${studio.address.street}, ${studio.address.postalCode} ${studio.address.city} (${studio.address.province})`;

export const mapsQuery = encodeURIComponent(`${studio.address.street}, ${studio.address.postalCode} ${studio.address.city} ${studio.address.province}`);
export const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
export const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`;

export function activeSocials(): { key: SocialKey; label: string; url: string }[] {
  return (Object.keys(studio.social) as SocialKey[])
    .filter((key) => studio.social[key])
    .map((key) => ({ key, label: SOCIAL_LABELS[key], url: studio.social[key] }));
}

export function phoneHref(): string {
  return studio.phone.replace(/[^\d+]/g, "");
}

export function whatsappLink(text: string): string | null {
  return studio.whatsapp ? `https://wa.me/${studio.whatsapp}?text=${encodeURIComponent(text)}` : null;
}

export function mailtoLink(subject: string, body: string): string | null {
  return studio.email ? `mailto:${studio.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
}
