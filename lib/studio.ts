/**
 * Dati anagrafici dello studio: UNICA fonte di verità per NAP (Name, Address, Phone),
 * orari, social e rating. Vengono riusati in pagina, footer, JSON-LD, sitemap e OG image.
 *
 * ⚠️ Per la Local SEO questi dati devono essere IDENTICI a quelli del profilo
 * Google Business Profile e delle directory (Pagine Gialle, Facebook, ecc.).
 * I valori contrassegnati con "DA VERIFICARE" vanno sostituiti con quelli reali prima della messa online.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.backroomsstudio.it").replace(/\/$/, "");

export type DayCode = "Mo" | "Tu" | "We" | "Th" | "Fr" | "Sa" | "Su";

export interface OpeningSlot {
  days: DayCode[];
  label: string;
  opens: string;
  closes: string;
}

export const studio = {
  name: "Backrooms Studio",
  legalName: "Backrooms Studio", // DA VERIFICARE: ragione sociale / nomi dei professionisti
  tagline: "Studio di registrazione a Vicenza",
  description:
    "Studio di registrazione professionale a Vicenza: registrazione voce e strumenti, mix e mastering analogico, produzione musicale, beatmaking, podcast e sound design.",
  vatId: "IT00000000000", // DA VERIFICARE: Partita IVA
  foundingYear: 2021, // DA VERIFICARE

  address: {
    street: "Via Esempio 1", // DA VERIFICARE
    postalCode: "36100",
    city: "Vicenza",
    province: "VI",
    region: "Veneto",
    country: "IT",
    countryName: "Italia",
  },
  // DA VERIFICARE: coordinate esatte dell'ingresso (tasto destro su Google Maps → copia coordinate)
  geo: { lat: 45.5475, lng: 11.5455 },

  phone: "+39 0444 000000", // DA VERIFICARE
  phoneHref: "+390444000000", // DA VERIFICARE
  whatsapp: "390000000000", // DA VERIFICARE: numero in formato internazionale senza "+"
  email: "info@backroomsstudio.it", // DA VERIFICARE

  priceRange: "$$",

  openingHours: [
    { days: ["Mo", "Tu", "We", "Th", "Fr"], label: "Lun – Ven", opens: "10:00", closes: "22:00" },
    { days: ["Sa"], label: "Sabato", opens: "10:00", closes: "20:00" },
  ] as OpeningSlot[],
  closedLabel: "Domenica su appuntamento",

  /**
   * Rating Google: deve rispecchiare ESATTAMENTE il profilo Google reale.
   * Pubblicare valori diversi da quelli reali è pubblicità ingannevole e viola le linee guida
   * di Google sui dati strutturati (rischio di azione manuale).
   */
  rating: { value: 5.0, count: 50 }, // DA VERIFICARE
  // Link "Lascia una recensione" del Google Business Profile (es. https://g.page/r/XXXX/review). Vuoto = pulsante nascosto.
  googleReviewUrl: "",
  googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Backrooms+Studio+Vicenza",

  social: {
    instagram: "https://www.instagram.com/backroomsstudio",
    tiktok: "https://www.tiktok.com/@backroomsstudio",
    youtube: "https://www.youtube.com/@backroomsstudio",
    spotify: "https://open.spotify.com/",
  },

  areaServed: [
    "Vicenza",
    "Bassano del Grappa",
    "Schio",
    "Thiene",
    "Valdagno",
    "Arzignano",
    "Montecchio Maggiore",
    "Dueville",
    "Padova",
    "Verona",
    "Treviso",
  ],

  directions: [
    {
      mode: "In auto",
      text: "A4 uscita Vicenza Est o Vicenza Ovest, poi 10 minuti verso il centro. Parcheggio gratuito nelle vie limitrofe.",
    },
    {
      mode: "In treno",
      text: "Dalla stazione di Vicenza (linea Milano–Venezia) circa 15 minuti a piedi o 5 in bus urbano SVT.",
    },
    {
      mode: "Carico strumenti",
      text: "Accesso diretto al piano strada per amplificatori, batterie e backline: avvisaci e ti aspettiamo all'ingresso.",
    },
  ],
} as const;

export const fullAddress = `${studio.address.street}, ${studio.address.postalCode} ${studio.address.city} (${studio.address.province})`;

export const DAY_NAMES: Record<DayCode, string> = {
  Mo: "Monday",
  Tu: "Tuesday",
  We: "Wednesday",
  Th: "Thursday",
  Fr: "Friday",
  Sa: "Saturday",
  Su: "Sunday",
};

export function whatsappLink(text: string): string {
  return `https://wa.me/${studio.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function mailtoLink(subject: string, body: string): string {
  return `mailto:${studio.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
