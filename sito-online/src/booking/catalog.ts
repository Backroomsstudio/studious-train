/**
 * Listino dei servizi acquistabili online. UNICA fonte dei prezzi: il server ricalcola sempre
 * il totale da qui, il prezzo inviato dal browser non viene mai usato.
 *
 * Modulo "puro" (nessuna dipendenza da Next o Node): lo usano sia il browser sia il server sia i test.
 */

export type ServiceId = "prova" | "registrazione" | "beat-studio" | "beat-remoto" | "mix-studio" | "mix-remoto" | "noleggio";

export interface BookableService {
  id: ServiceId;
  title: string;
  /** Nome breve usato nel carrello e nel calendario */
  short: string;
  /** Breve descrizione mostrata nel checkout */
  summary: string;
  /** In studio = occupa il calendario; a distanza = nessuno slot da scegliere */
  where: "studio" | "remoto";
  /** Prezzo di una unità, in centesimi di euro */
  unitPriceCents: number;
  /** Nome dell'unità al singolare / plurale (traccia, beat, brano, ora) */
  unit: { one: string; many: string };
  /** Minuti occupati in calendario da una unità (solo servizi in studio) */
  minutesPerUnit: number;
  /** Minuti in più per ogni appuntamento (registrazione: 30 minuti di preparazione) */
  setupMinutes?: number;
  /** Mostrare la durata al cliente? (per il Mix & Master in studio no) */
  showDuration: boolean;
  /** Quantità massima acquistabile in un solo checkout */
  maxUnits: number;
  /** Si può pagare in contanti in studio? */
  cashAllowed: boolean;
  /** true = mai sconti per quantità (es. noleggio studio) */
  noDiscount?: boolean;
  /** false = non si paga online: si paga solo in studio, il giorno della sessione */
  onlineAllowed?: boolean;
  /** true = una sola volta per cliente (stessa email o stesso telefono) */
  oncePerCustomer?: boolean;
  /** true = si prenota da sola, senza altri servizi nel carrello */
  standalone?: boolean;
  /** Etichetta in evidenza nella scheda del servizio */
  badge?: string;
  /** Quanto conta dentro il Pass mensile (null = non incluso nel Pass) */
  passUnit: PassUnit | null;
}

export type PassUnit = "sessions" | "beats" | "mixes";

/** Ore massime di un singolo appuntamento in studio: oltre si divide in più appuntamenti. */
export const MAX_BOOKING_MINUTES = 6 * 60;

export const bookableServices: BookableService[] = [
  {
    id: "prova",
    title: "Prima Sessione di Prova",
    short: "Sessione di prova",
    summary: "La tua prima ora in sala con l'engineer a prezzo di benvenuto: 20 € invece di 50 €. Si paga in studio.",
    where: "studio",
    unitPriceCents: 2000,
    unit: { one: "sessione", many: "sessioni" },
    minutesPerUnit: 60,
    showDuration: true,
    maxUnits: 1,
    cashAllowed: true,
    onlineAllowed: false, // solo in presenza
    oncePerCustomer: true,
    standalone: true,
    noDiscount: true,
    passUnit: null,
    badge: "Prima volta · 20 € invece di 50 €",
  },
  {
    id: "registrazione",
    title: "Registrazione con engineer",
    short: "Registrazione",
    summary: "Registri le tue tracce in sala con l'engineer: si paga a traccia, il tempo lo calcoliamo noi.",
    where: "studio",
    unitPriceCents: 5000,
    unit: { one: "traccia", many: "tracce" },
    // 1 traccia = 1 ora + 30 minuti di preparazione per appuntamento: 2 tracce 2 h 30, 3 tracce 3 h 30.
    minutesPerUnit: 60,
    setupMinutes: 30,
    showDuration: true,
    maxUnits: 10,
    cashAllowed: true,
    passUnit: "sessions",
  },
  {
    id: "beat-studio",
    title: "Beat su misura in studio",
    short: "Beat in studio",
    summary: "Un'ora e mezza a beat, fianco a fianco con il producer: il beat nasce da zero sulla tua voce.",
    where: "studio",
    unitPriceCents: 6000,
    unit: { one: "beat", many: "beat" },
    minutesPerUnit: 90,
    showDuration: true,
    maxUnits: 10,
    cashAllowed: true,
    passUnit: "beats",
  },
  {
    id: "beat-remoto",
    title: "Beat su misura a distanza",
    short: "Beat a distanza",
    summary: "Ci mandi le reference: il producer costruisce il beat e te lo consegna online.",
    where: "remoto",
    unitPriceCents: 6000,
    unit: { one: "beat", many: "beat" },
    minutesPerUnit: 0,
    showDuration: false,
    maxUnits: 10,
    cashAllowed: false,
    passUnit: "beats",
  },
  {
    id: "mix-studio",
    title: "Mix & Master in studio",
    short: "Mix & Master in studio",
    summary: "Ascolti il mix crescere e decidi tutto con l'engineer, in sala.",
    where: "studio",
    unitPriceCents: 7000,
    unit: { one: "brano", many: "brani" },
    minutesPerUnit: 120, // in calendario dura 2 ore a brano, ma al cliente non viene mostrato
    showDuration: false,
    maxUnits: 10,
    cashAllowed: true,
    passUnit: "mixes",
  },
  {
    id: "mix-remoto",
    title: "Mix & Master a distanza",
    short: "Mix & Master",
    summary: "Lo facciamo noi: ascolti e approvi da casa. Master pronto per Spotify e tutte le piattaforme.",
    where: "remoto",
    unitPriceCents: 7000,
    unit: { one: "brano", many: "brani" },
    minutesPerUnit: 0,
    showDuration: false,
    maxUnits: 10,
    cashAllowed: false,
    passUnit: "mixes",
  },
  {
    id: "noleggio",
    title: "Sala senza fonico",
    short: "Sala senza fonico",
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
 * Sconti per quantità sul carrello libero, in percentuale sul prezzo pieno: { servizi minimi: percentuale }.
 * Come sul sito: "più prendi, meno paghi, in qualsiasi combinazione" (3+ −10%, 5+ −20%, 10+ −30%).
 * Contano tutte le unità del carrello (tracce, beat, brani), tranne i servizi a prezzo fisso.
 */
export const DISCOUNTS: Record<number, number> = { 3: 10, 5: 20, 10: 30 };

/** Catalogo dei beat già pronti (licenza base 30 €): link al negozio BeatStars. Vuoto = sezione nascosta. */
export const BEATSTARS_URL = "https://beatstars.com/backroomss";
export const BEATSTARS_LICENSE_PRICE = "30 €";

export function getService(id: string): BookableService | undefined {
  return bookableServices.find((s) => s.id === id);
}

export function maxUnitsFor(service: BookableService): number {
  return service.maxUnits;
}

/** Durata in calendario di UN appuntamento con `units` unità. */
export function bookingMinutes(service: BookableService, units: number): number {
  if (service.where !== "studio" || units <= 0) return 0;
  return service.minutesPerUnit * units + (service.setupMinutes ?? 0);
}

/** Quante unità stanno al massimo in un solo appuntamento (tetto di 6 ore). */
export function unitsPerBlock(service: BookableService): number {
  return Math.max(1, Math.floor((MAX_BOOKING_MINUTES - (service.setupMinutes ?? 0)) / service.minutesPerUnit));
}

/* ------------------------------------------------------------------ */
/* Carrello: righe e appuntamenti                                       */
/* ------------------------------------------------------------------ */

export interface CartLine {
  serviceId: ServiceId;
  units: number;
}

/** Un appuntamento in studio da fissare in calendario (una riga può richiederne più di uno). */
export interface Block {
  serviceId: ServiceId;
  units: number;
  minutes: number;
}

/** Ordine naturale del lavoro: prima il beat, poi la registrazione, poi il mix. */
const STUDIO_ORDER: ServiceId[] = ["prova", "beat-studio", "registrazione", "mix-studio", "noleggio"];

/**
 * Gli appuntamenti in studio che servono per un carrello, nell'ordine in cui si fanno.
 * Una riga che supera le 6 ore si divide in più appuntamenti il più possibile uguali (es. 5 beat = 3 + 2).
 */
export function planBlocks(lines: CartLine[]): Block[] {
  const out: Block[] = [];
  for (const id of STUDIO_ORDER) {
    const line = lines.find((l) => l.serviceId === id);
    const service = getService(id)!;
    if (!line || line.units <= 0) continue;
    const per = unitsPerBlock(service);
    const n = Math.ceil(line.units / per);
    const base = Math.floor(line.units / n);
    let extra = line.units % n;
    for (let i = 0; i < n; i++) {
      const units = base + (extra-- > 0 ? 1 : 0);
      out.push({ serviceId: id, units, minutes: bookingMinutes(service, units) });
    }
  }
  return out;
}

/** Righe pulite: un solo servizio per riga, quantità valide, ordine fisso. */
export function normalizeLines(lines: CartLine[]): CartLine[] {
  const merged = new Map<ServiceId, number>();
  for (const l of lines) {
    const s = getService(l.serviceId);
    if (!s || !Number.isInteger(l.units) || l.units <= 0) continue;
    merged.set(s.id, (merged.get(s.id) ?? 0) + l.units);
  }
  const order: ServiceId[] = ["prova", "beat-studio", "beat-remoto", "registrazione", "mix-studio", "mix-remoto", "noleggio"];
  return order.filter((id) => merged.has(id)).map((id) => ({ serviceId: id, units: merged.get(id)! }));
}

/* ------------------------------------------------------------------ */
/* Pacchetti pronti                                                     */
/* ------------------------------------------------------------------ */

export type PackageId = "singolo" | "typebeat" | "doppio" | "ep";

export interface Package {
  id: PackageId;
  title: string;
  /** Cosa c'è dentro, in una riga */
  tagline: string;
  /** Per chi è */
  forWho: string;
  priceCents: number;
  lines: CartLine[];
  badge?: string;
}

/** Nei pacchetti il master lo facciamo noi, senza l'artista: in calendario si fissano solo beat e registrazione. */
export const packages: Package[] = [
  {
    id: "singolo",
    title: "Singolo completo",
    tagline: "1 beat su misura + 1 traccia registrata + mix & master",
    forWho: "Esci con un brano finito, da zero.",
    priceCents: 15900,
    lines: [
      { serviceId: "beat-studio", units: 1 },
      { serviceId: "registrazione", units: 1 },
      { serviceId: "mix-remoto", units: 1 },
    ],
  },
  {
    id: "typebeat",
    title: "Type beat",
    tagline: "1 traccia registrata + mix & master, sul tuo beat",
    forWho: "Hai già il beat: registri e te lo consegniamo pronto.",
    priceCents: 10900,
    lines: [
      { serviceId: "registrazione", units: 1 },
      { serviceId: "mix-remoto", units: 1 },
    ],
  },
  {
    id: "doppio",
    title: "Doppio singolo",
    tagline: "2 beat su misura + 2 tracce registrate + 2 mix & master",
    forWho: "Due uscite pronte, una dietro l'altra.",
    priceCents: 30900,
    lines: [
      { serviceId: "beat-studio", units: 2 },
      { serviceId: "registrazione", units: 2 },
      { serviceId: "mix-remoto", units: 2 },
    ],
  },
  {
    id: "ep",
    title: "EP 5 brani",
    tagline: "5 beat su misura + 5 tracce registrate + 5 mix & master",
    forWho: "Un progetto intero, con un sound coerente.",
    priceCents: 69000,
    lines: [
      { serviceId: "beat-studio", units: 5 },
      { serviceId: "registrazione", units: 5 },
      { serviceId: "mix-remoto", units: 5 },
    ],
    badge: "Il più conveniente",
  },
];

export function getPackage(id: string): Package | undefined {
  return packages.find((p) => p.id === id);
}

/** Prezzo pieno di un insieme di righe, senza sconti (in centesimi). */
export function listCents(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + getService(l.serviceId)!.unitPriceCents * l.units, 0);
}

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

/** Il Pass copre l'acquisto in corso? Conta tutte le righe del carrello (es. 6 tracce stanno solo nel Pass Label). */
export function passCovers(pass: Pass, lines: CartLine[]): boolean {
  if (!lines.length) return false;
  const need: Record<PassUnit, number> = { sessions: 0, beats: 0, mixes: 0 };
  for (const l of lines) {
    const unit = getService(l.serviceId)?.passUnit;
    if (!unit) return false;
    need[unit] += l.units;
  }
  return (Object.keys(need) as PassUnit[]).every((k) => pass.includes[k] >= need[k]);
}

export function passesFor(lines: CartLine[]): Pass[] {
  return passes.filter((p) => passCovers(p, lines));
}

/** Regola di cancellazione dei pagamenti online per le sessioni in studio. */
export const CANCELLATION_HOURS = 24;
export const CANCELLATION_POLICY =
  `Puoi spostare o annullare la sessione avvisandoci almeno ${CANCELLATION_HOURS} ore prima dell'inizio. ` +
  `Se avvisi meno di ${CANCELLATION_HOURS} ore prima, o non ti presenti, il pagamento online non è rimborsabile.`;
