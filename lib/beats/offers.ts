/**
 * Offerte del Backrooms Beat Store oltre all'abbonamento: servizi dello studio, prodotti digitali,
 * ricariche, gift card, aste delle esclusive, livelli Resident e inviti.
 * Unico punto da modificare per prezzi, crediti e vantaggi.
 *
 * Regola dei crediti: quelli dell'abbonamento seguono rollover e scadenza del piano; quelli
 * comprati, regalati o guadagnati con gli inviti (portafoglio) non scadono mai.
 */

/* ------------------------------------------------------------------ */
/* Servizi dello studio                                                */
/* ------------------------------------------------------------------ */

export type ServiceKind = "HIT_PACKAGE" | "MIX_MASTER" | "FEEDBACK" | "LIVE_SLOT" | "RELEASE";

export interface ServiceTier {
  id: string;
  name: string;
  detail: string;
  includes: string[];
  /** Prezzo in euro (centesimi); null = solo crediti. */
  priceCents: number | null;
  /** Prezzo in crediti; null = solo carta. */
  credits: number | null;
  /** Giorni lavorativi di consegna (null = su appuntamento). */
  days: number | null;
}

export interface ServiceDef {
  kind: ServiceKind;
  name: string;
  tagline: string;
  /** Chiede di scegliere uno dei beat sbloccati (pacchetto, uscita). */
  needsBeat: boolean;
  /** Chiede una data o una fascia preferita (feedback, live). */
  needsSchedule: boolean;
  /** Lo sconto del livello Resident si applica al prezzo in euro. */
  levelDiscount: boolean;
  tiers: ServiceTier[];
}

export const SERVICES: Record<ServiceKind, ServiceDef> = {
  HIT_PACKAGE: {
    kind: "HIT_PACKAGE",
    name: "Dal beat alla hit",
    tagline: "Beat, registrazione, mix e master: esci dallo studio con il pezzo finito.",
    needsBeat: true,
    needsSchedule: true,
    levelDiscount: true,
    tiers: [
      {
        id: "online",
        name: "Online",
        detail: "Registri dove vuoi, noi pensiamo al resto",
        includes: ["Trackout del beat", "Guida alla registrazione a distanza", "Mix & master", "2 revisioni"],
        priceCents: 19900,
        credits: null,
        days: 7,
      },
      {
        id: "studio",
        name: "In studio",
        detail: "3 ore nello Studio Lounge con il produttore",
        includes: ["Trackout del beat", "3 ore di registrazione", "Mix & master", "2 revisioni"],
        priceCents: 29900,
        credits: null,
        days: 7,
      },
      {
        id: "premium",
        name: "Premium",
        detail: "5 ore, copertina e reel per TikTok",
        includes: ["Unlimited del beat", "5 ore di registrazione", "Mix & master", "Copertina", "Reel verticale", "Premiere in live"],
        priceCents: 39900,
        credits: null,
        days: 10,
      },
    ],
  },
  MIX_MASTER: {
    kind: "MIX_MASTER",
    name: "Mix & Master online",
    tagline: "Carichi le tracce, ti riconsegniamo il pezzo pronto per gli store.",
    needsBeat: false,
    needsSchedule: false,
    levelDiscount: false,
    tiers: [
      { id: "master", name: "Solo master", detail: "Volume e brillantezza da store", includes: ["Master stereo", "1 revisione"], priceCents: 1900, credits: 10, days: 3 },
      { id: "mix", name: "Mix + master", detail: "Voce e beat che stanno insieme", includes: ["Mix fino a 16 tracce", "Master", "2 revisioni"], priceCents: 4900, credits: 20, days: 5 },
      { id: "pro", name: "Mix + master pro", detail: "Tuning, effetti creativi e stems", includes: ["Mix fino a 32 tracce", "Tuning voce", "Master", "Stems finali", "3 revisioni"], priceCents: 6900, credits: 25, days: 5 },
    ],
  },
  FEEDBACK: {
    kind: "FEEDBACK",
    name: "Feedback 1:1",
    tagline: "Una videochiamata con un produttore sul tuo pezzo.",
    needsBeat: false,
    needsSchedule: true,
    levelDiscount: false,
    tiers: [
      { id: "short", name: "20 minuti", detail: "Ascolto e consigli mirati", includes: ["Videochiamata 20 min", "Note scritte"], priceCents: 2500, credits: 8, days: null },
      { id: "long", name: "45 minuti", detail: "Analisi completa e piano di lavoro", includes: ["Videochiamata 45 min", "Note scritte", "Riferimenti"], priceCents: 4900, credits: 15, days: null },
    ],
  },
  LIVE_SLOT: {
    kind: "LIVE_SLOT",
    name: "Il tuo pezzo in live",
    tagline: "Il tuo brano ascoltato e commentato nella nostra live TikTok.",
    needsBeat: false,
    needsSchedule: true,
    levelDiscount: false,
    tiers: [
      { id: "skip", name: "Skip", detail: "Salti la coda", includes: ["Ascolto in live"], priceCents: 500, credits: 3, days: null },
      { id: "super-skip", name: "Super Skip", detail: "Tra i primi tre della serata", includes: ["Ascolto in live", "Scheda in evidenza"], priceCents: 1000, credits: 6, days: null },
      { id: "throne", name: "Throne", detail: "Apri la live, con il tuo nome sul trono", includes: ["Primo ascolto", "Scheda dorata", "Clip della reazione"], priceCents: 2000, credits: 12, days: null },
    ],
  },
  RELEASE: {
    kind: "RELEASE",
    name: "Uscita guidata",
    tagline: "Distribuzione, copertina e lancio: il pezzo esce bene, non solo esce.",
    needsBeat: true,
    needsSchedule: false,
    levelDiscount: true,
    tiers: [
      { id: "base", name: "Base", detail: "Pronto per Spotify e Apple Music", includes: ["Distribuzione su tutti gli store", "Copertina", "Metadati e ISRC"], priceCents: 9900, credits: null, days: 10 },
      { id: "launch", name: "Lancio", detail: "Uscita con spinta", includes: ["Tutto del Base", "Reel verticale", "Premiere in live", "Pitch alle playlist"], priceCents: 24900, credits: null, days: 14 },
    ],
  },
};

export const SERVICE_ORDER: ServiceKind[] = ["HIT_PACKAGE", "MIX_MASTER", "FEEDBACK", "LIVE_SLOT", "RELEASE"];

export function findTier(kind: ServiceKind, tierId: string): ServiceTier | undefined {
  return SERVICES[kind]?.tiers.find((t) => t.id === tierId);
}

/* ------------------------------------------------------------------ */
/* Prodotti digitali                                                   */
/* ------------------------------------------------------------------ */

export type ProductKind = "DRUM_KIT" | "SAMPLE_PACK" | "VOCAL_PRESET";

export const PRODUCT_KINDS: Record<ProductKind, string> = {
  DRUM_KIT: "Drum kit",
  SAMPLE_PACK: "Sample pack",
  VOCAL_PRESET: "Preset voce",
};

/* ------------------------------------------------------------------ */
/* Ricariche e gift card                                               */
/* ------------------------------------------------------------------ */

export interface CreditPack {
  id: string;
  credits: number;
  bonus: number;
  priceCents: number;
}

/**
 * Ricariche oneste: costano un po' più dei crediti dell'abbonamento (che resta la scelta migliore),
 * il bonus è dichiarato e i crediti non scadono.
 */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "small", credits: 5, bonus: 0, priceCents: 1790 },
  { id: "medium", credits: 12, bonus: 1, priceCents: 3990 },
  { id: "large", credits: 30, bonus: 4, priceCents: 8990 },
];

export const GIFT_CARDS: CreditPack[] = [
  { id: "gift-10", credits: 10, bonus: 0, priceCents: 3490 },
  { id: "gift-25", credits: 25, bonus: 0, priceCents: 7990 },
  { id: "gift-50", credits: 50, bonus: 5, priceCents: 14990 },
];

/* ------------------------------------------------------------------ */
/* Aste delle esclusive                                                */
/* ------------------------------------------------------------------ */

export const AUCTION = {
  startPriceCents: 30000,
  minIncrementCents: 2500,
  /** Un'offerta negli ultimi secondi allunga l'asta: niente vittorie "da cecchino". */
  antiSnipeSeconds: 60,
  /** Il vincitore ha 48 ore per pagare, poi l'esclusiva passa al secondo. */
  paymentHours: 48,
  maxBidCents: 1_000_000,
} as const;

/* ------------------------------------------------------------------ */
/* Livelli Resident, inviti, piano annuale, pausa                      */
/* ------------------------------------------------------------------ */

export interface ResidentLevel {
  id: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  name: string;
  minMonths: number;
  /** Sconto sui servizi in euro dello studio. */
  studioDiscountPct: number;
  perks: string[];
  color: string;
}

export const LEVELS: ResidentLevel[] = [
  { id: "BRONZE", name: "Bronze", minMonths: 0, studioDiscountPct: 0, perks: ["Accesso al catalogo e ai drop"], color: "#cd7f32" },
  { id: "SILVER", name: "Silver", minMonths: 3, studioDiscountPct: 5, perks: ["-5% sui servizi dello studio", "Drop 24 ore prima"], color: "#c0c7d2" },
  { id: "GOLD", name: "Gold", minMonths: 6, studioDiscountPct: 10, perks: ["-10% sui servizi dello studio", "Drop 24 ore prima", "Prelazione sulle aste", "Nome nei crediti delle live"], color: "#f5c542" },
  { id: "PLATINUM", name: "Platinum", minMonths: 12, studioDiscountPct: 15, perks: ["-15% sui servizi dello studio", "Drop 48 ore prima", "Prelazione sulle aste", "Un feedback 1:1 l'anno incluso"], color: "#e5f0ff" },
];

export function levelFor(months: number): { level: ResidentLevel; next: ResidentLevel | null; monthsToNext: number } {
  const level = [...LEVELS].reverse().find((l) => months >= l.minMonths) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.minMonths > months) ?? null;
  return { level, next, monthsToNext: next ? next.minMonths - months : 0 };
}

export function discounted(priceCents: number, pct: number): number {
  return Math.round((priceCents * (100 - pct)) / 100);
}

export const REFERRAL = { inviterCredits: 5, invitedCredits: 5, maxPerYear: 24 } as const;

export const PAUSE = { months: 1, cooldownMonths: 6 } as const;

/* ------------------------------------------------------------------ */
/* Regole pure (condivise da backend Prisma, demo e test)              */
/* ------------------------------------------------------------------ */

export type PaidWith = "CREDITS" | "CARD";

export type ServiceQuote =
  | { ok: true; paidWith: PaidWith; credits: number; amountCents: number; discountPct: number }
  | { ok: false; message: string };

/** Prezzo di un servizio per il metodo scelto, con lo sconto del livello sui prezzi in euro. */
export function quoteService(kind: ServiceKind, tierId: string, paidWith: PaidWith, levelDiscountPct = 0): ServiceQuote {
  const service = SERVICES[kind];
  const tier = findTier(kind, tierId);
  if (!service || !tier) return { ok: false, message: "Servizio non disponibile." };
  if (paidWith === "CREDITS") {
    if (tier.credits === null) return { ok: false, message: `${service.name} si paga solo con carta.` };
    return { ok: true, paidWith, credits: tier.credits, amountCents: 0, discountPct: 0 };
  }
  if (tier.priceCents === null) return { ok: false, message: `${service.name} si paga solo in crediti.` };
  const discountPct = service.levelDiscount ? levelDiscountPct : 0;
  return { ok: true, paidWith, credits: 0, amountCents: discounted(tier.priceCents, discountPct), discountPct };
}

/** Il pacchetto hit include la licenza del beat: Trackout, Unlimited nel Premium. */
export function serviceLicense(kind: ServiceKind, tierId: string): "TRACKOUT" | "UNLIMITED" | null {
  if (kind !== "HIT_PACKAGE") return null;
  return tierId === "premium" ? "UNLIMITED" : "TRACKOUT";
}

export function findPack(list: CreditPack[], id: string): CreditPack | undefined {
  return list.find((p) => p.id === id);
}

export const packCredits = (p: CreditPack) => p.credits + p.bonus;

/** Codice gift card leggibile a voce: senza 0/O, 1/I. */
export function giftCode(random: (n: number) => number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () => Array.from({ length: 4 }, () => alphabet[random(alphabet.length)]).join("");
  return `BR-${block()}-${block()}`;
}

export const normalizeGiftCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

export interface AuctionView {
  startsAt: Date;
  endsAt: Date;
  startPriceCents: number;
  minIncrementCents: number;
  topBidCents: number | null;
}

export type AuctionPhase = "SCHEDULED" | "LIVE" | "ENDED";

export function auctionPhase(a: Pick<AuctionView, "startsAt" | "endsAt">, now: Date): AuctionPhase {
  if (now < a.startsAt) return "SCHEDULED";
  return now < a.endsAt ? "LIVE" : "ENDED";
}

/** Offerta minima accettata: il prezzo di partenza, poi l'offerta più alta più il rilancio minimo. */
export function minNextBid(a: AuctionView): number {
  return a.topBidCents === null ? a.startPriceCents : a.topBidCents + a.minIncrementCents;
}

export type BidCheck = { ok: true; newEndsAt: Date } | { ok: false; message: string };

/** Valida un'offerta e calcola l'eventuale proroga anti-cecchino. */
export function checkBid(a: AuctionView, amountCents: number, now: Date): BidCheck {
  const phase = auctionPhase(a, now);
  if (phase === "SCHEDULED") return { ok: false, message: "L'asta non è ancora iniziata." };
  if (phase === "ENDED") return { ok: false, message: "L'asta è chiusa." };
  if (!Number.isInteger(amountCents) || amountCents > AUCTION.maxBidCents) return { ok: false, message: "Offerta non valida." };
  const min = minNextBid(a);
  if (amountCents < min) return { ok: false, message: `L'offerta minima ora è ${(min / 100).toLocaleString("it-IT")} €.` };
  const snipeLine = a.endsAt.getTime() - AUCTION.antiSnipeSeconds * 1000;
  const newEndsAt = now.getTime() > snipeLine ? new Date(now.getTime() + AUCTION.antiSnipeSeconds * 1000) : a.endsAt;
  return { ok: true, newEndsAt };
}

/**
 * Chi deve pagare un'asta chiusa: l'offerta più alta di chi non ha già perso il turno per mancato
 * pagamento (un artista conta una volta sola, con la sua offerta migliore).
 */
export function pickWinner<B extends { userId: string; amountCents: number }>(bids: B[], skipped: string[]): B | null {
  return [...bids].sort((x, y) => y.amountCents - x.amountCents).find((b) => !skipped.includes(b.userId)) ?? null;
}

/** Livello per la UI (stesso formato in DB e demo). */
export function levelInfo(months: number): import("./types").LevelInfo {
  const { level, next, monthsToNext } = levelFor(months);
  return {
    id: level.id,
    name: level.name,
    color: level.color,
    months,
    studioDiscountPct: level.studioDiscountPct,
    perks: level.perks,
    next: next ? { name: next.name, monthsToNext } : null,
  };
}

export const hasAuctionEarlyAccess = (levelId: ResidentLevel["id"]) => levelId === "GOLD" || levelId === "PLATINUM";

/** Ordine della coda in live: chi paga di più passa prima. */
export const LIVE_TIER_RANK: Record<string, number> = { throne: 0, "super-skip": 1, skip: 2 };

export const SERVICE_STATUS: Record<string, string> = {
  PENDING_PAYMENT: "In attesa di pagamento",
  PAID: "Confermato",
  IN_PROGRESS: "In lavorazione",
  DELIVERED: "Consegnato",
  CANCELED: "Annullato",
  REFUNDED: "Rimborsato",
};
