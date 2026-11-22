/**
 * Listino dei servizi acquistabili online. UNICA fonte dei prezzi: il server ricalcola sempre
 * il totale da qui, il prezzo inviato dal browser non viene mai usato.
 *
 * Modulo "puro" (nessuna dipendenza da Next o Node): lo usano sia il browser sia il server sia i test.
 */

export type ServiceId = "registrazione" | "beat-studio" | "beat-remoto" | "mix-studio" | "mix-remoto" | "noleggio";

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
  /** true = mai sconti per quantità (es. noleggio studio) */
  noDiscount?: boolean;
  /** Quanto conta dentro il Pass mensile (null = non incluso nel Pass) */
  passUnit: PassUnit | null;
}

export type PassUnit = "sessions" | "beats" | "mixes";

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
    passUnit: "sessions",
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
    passUnit: "beats",
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
    passUnit: "beats",
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
    passUnit: "mixes",
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
    passUnit: "mixes",
  },
  {
    id: "noleggio",
    title: "Noleggio Studio",
    summary: "La Lounge tutta per te, senza engineer: porti il tuo fonico o lavori in autonomia.",
    where: "studio",
    unitPriceCents: 3500,
    unit: { one: "ora", many: "ore" },
    minutesPerUnit: 60,
    showDuration: true,
    maxUnits: 6,
    cashAllowed: true,
    noDiscount: true, // prezzo fisso, mai scontato
    passUnit: null,
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
export const BEATSTARS_URL = "https://beatstars.com/backroomss";
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

/* ------------------------------------------------------------------ */
/* Backrooms Pass: abbonamento mensile proposto subito prima di pagare  */
/* ------------------------------------------------------------------ */

export type PassId = "start" | "pro" | "label";

export interface Pass {
  id: PassId;
  title: string;
  tagline: string;
  includes: Record<PassUnit, number>;
  /** Prezzo mensile di listino, in centesimi */
  monthlyCents: number;
  /** Valore dei servizi inclusi a prezzo pieno, in centesimi */
  valueCents: number;
  recommended?: boolean;
}

/** Stessi Pass del sito: Start, Pro, Label. */
export const passes: Pass[] = [
  { id: "start", title: "Pass Start", tagline: "Per chi pubblica con costanza", includes: { sessions: 4, beats: 1, mixes: 2 }, monthlyCents: 25000, valueCents: 40000 },
  { id: "pro", title: "Pass Pro", tagline: "Il pieno di musica, ogni mese", includes: { sessions: 5, beats: 2, mixes: 3 }, monthlyCents: 30000, valueCents: 58000, recommended: true },
  { id: "label", title: "Pass Label", tagline: "Per artisti e team che lavorano forte", includes: { sessions: 8, beats: 4, mixes: 5 }, monthlyCents: 45000, valueCents: 99000 },
];

/** Ulteriore sconto (%) sul Pass se lo si attiva dal checkout, valido su ogni mese. */
export const PASS_CHECKOUT_EXTRA_DISCOUNT = 10;

/** Vantaggi del Pass oltre ai servizi inclusi (come sul sito). */
export const PASS_PERKS = ["Priorità sulle date", "−20% su ogni altro servizio", "Disdici quando vuoi"];

export const PASS_UNIT_LABELS: Record<PassUnit, { one: string; many: string }> = {
  sessions: { one: "sessione di registrazione", many: "sessioni di registrazione" },
  beats: { one: "beat su misura", many: "beat su misura" },
  mixes: { one: "mix & master", many: "mix & master" },
};

export function getPass(id: string): Pass | undefined {
  return passes.find((p) => p.id === id);
}

/** Prezzo mensile del Pass attivato dal checkout (con l'ulteriore sconto, arrotondato all'euro). */
export function passCheckoutCents(pass: Pass): number {
  return Math.round((pass.monthlyCents * (100 - PASS_CHECKOUT_EXTRA_DISCOUNT)) / 100 / 100) * 100;
}

/** Il Pass copre l'acquisto in corso? (es. 6 ore di registrazione stanno solo nel Pass Label) */
export function passCovers(pass: Pass, service: BookableService, units: number): boolean {
  return service.passUnit !== null && pass.includes[service.passUnit] >= units;
}

export function passesFor(service: BookableService, units: number): Pass[] {
  return passes.filter((p) => passCovers(p, service, units));
}
