/**
 * Listino dei servizi acquistabili online. UNICA fonte dei prezzi: il server ricalcola sempre
 * il totale da qui, il prezzo inviato dal browser non viene mai usato.
 *
 * Modulo "puro" (nessuna dipendenza da Next o Node): lo usano sia il browser sia il server sia i test.
 */

export type ServiceId = "registrazione" | "beat-studio" | "beat-remoto" | "mix-studio" | "mix-remoto";

export interface BookableService {
  id: ServiceId;
  title: string;
  /** Breve descrizione mostrata nel checkout */
  summary: string;
  /** In studio = occupa il calendario; a distanza = nessuno slot da scegliere */
  where: "studio" | "remoto";
  /** Prezzo di una unità, in centesimi di euro */
  unitPriceCents: number;
  /** Nome dell'unità al singolare / plurale (ora, sessione, beat, brano) */
  unit: { one: string; many: string };
  /** Minuti occupati in calendario da una unità (solo servizi in studio) */
  minutesPerUnit: number;
  /** Mostrare la durata al cliente? (per il Mix & Master in studio no) */
  showDuration: boolean;
  /** Quantità massima acquistabile in un solo checkout */
  maxUnits: number;
  /** Si può pagare in contanti in studio? */
  cashAllowed: boolean;
}

/** Ore massime prenotabili in un solo blocco. */
export const MAX_BOOKING_MINUTES = 6 * 60;

export const bookableServices: BookableService[] = [
  {
    id: "registrazione",
    title: "Sessione di Registrazione",
    summary: "Slot da un'ora in sala con l'engineer: in un'ora si chiude una canzone.",
    where: "studio",
    unitPriceCents: 5000,
    unit: { one: "ora", many: "ore" },
    minutesPerUnit: 60,
    showDuration: true,
    maxUnits: 6,
    cashAllowed: true,
  },
  {
    id: "beat-studio",
    title: "Sessione di Beat in Studio",
    summary: "Un'ora e mezza fianco a fianco con il producer per costruire il beat da zero.",
    where: "studio",
    unitPriceCents: 6000,
    unit: { one: "sessione", many: "sessioni" },
    minutesPerUnit: 90,
    showDuration: true,
    maxUnits: 4, // 4 × 1,5 h = 6 h
    cashAllowed: true,
  },
  {
    id: "beat-remoto",
    title: "Beat a Distanza su Commissione",
    summary: "Commissioni un beat su misura: lo sviluppiamo da remoto e te lo consegniamo online.",
    where: "remoto",
    unitPriceCents: 6000,
    unit: { one: "beat", many: "beat" },
    minutesPerUnit: 0,
    showDuration: false,
    maxUnits: 6,
    cashAllowed: false,
  },
  {
    id: "mix-studio",
    title: "Mix & Master in Studio",
    summary: "Sessione presenziale: ascolti il mix crescere e decidi tutto con l'engineer.",
    where: "studio",
    unitPriceCents: 7000,
    unit: { one: "brano", many: "brani" },
    minutesPerUnit: 120, // in calendario dura 2 ore, ma al cliente non viene mostrato
    showDuration: false,
    maxUnits: 3, // 3 × 2 h = 6 h
    cashAllowed: true,
  },
  {
    id: "mix-remoto",
    title: "Mix & Master a Distanza",
    summary: "Carichi le tracce, ricevi mix e master pronti per le piattaforme.",
    where: "remoto",
    unitPriceCents: 7000,
    unit: { one: "brano", many: "brani" },
    minutesPerUnit: 0,
    showDuration: false,
    maxUnits: 6,
    cashAllowed: false,
  },
];

/**
 * Sconti per quantità, in percentuale sul prezzo pieno: { quantità minima: percentuale }.
 *
 * Stessa scala del calcolatore del sito (sito-online/js/main.js, funzione `sconto`):
 * 1–2 listino · 3+ −10% · 5+ −20% · 10+ −30%.
 * Si può impostare una tabella diversa per servizio in DISCOUNTS_BY_SERVICE.
 */
export const DISCOUNTS: Record<number, number> = { 3: 10, 5: 20, 10: 30 };

export const DISCOUNTS_BY_SERVICE: Partial<Record<ServiceId, Record<number, number>>> = {};

/** Catalogo dei beat già pronti (licenza base 30 €): link al negozio BeatStars. Vuoto = sezione nascosta. */
export const BEATSTARS_URL = "";
export const BEATSTARS_LICENSE_PRICE = "30 €";

export function getService(id: string): BookableService | undefined {
  return bookableServices.find((s) => s.id === id);
}

/** Massimo di unità acquistabili rispettando anche il tetto di 6 ore per i servizi in studio. */
export function maxUnitsFor(service: BookableService): number {
  if (service.where !== "studio" || service.minutesPerUnit <= 0) return service.maxUnits;
  return Math.min(service.maxUnits, Math.floor(MAX_BOOKING_MINUTES / service.minutesPerUnit));
}

export function bookingMinutes(service: BookableService, units: number): number {
  return service.where === "studio" ? service.minutesPerUnit * units : 0;
}

/** Collegamento dai servizi della landing (lib/content.ts) al servizio acquistabile. */
export const landingServiceToBookable: Record<string, ServiceId> = {
  registrazione: "registrazione",
  produzione: "beat-studio",
  "produzione-remoto": "beat-remoto",
  "mix-master-studio": "mix-studio",
  "mix-master-remoto": "mix-remoto",
};
