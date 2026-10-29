/** DTO condivisi tra server e client (serializzabili in JSON). */
import type { UserRole } from "./launch";
import type { LicenseType } from "./licenses";
import type { MusicalKey } from "./music";
import type { ProductKind, ServiceKind } from "./offers";
import type { PlanInterval, PlanTier } from "./plans";

export interface ProducerRef {
  slug: string;
  name: string;
  role: "MAIN" | "CO_PRODUCER";
  accentColor: string | null;
}

export interface TagRef {
  slug: string;
  name: string;
}

export interface DealRef {
  discountPct: number;
  endsAt: string;
}

export interface BeatSummary {
  id: string;
  slug: string;
  title: string;
  bpm: number;
  key: MusicalKey;
  durationSec: number;
  coverUrl: string | null;
  peaks: number[];
  producers: ProducerRef[];
  /** `parent` = genere principale (Plugg → trap): serve per colore e raggruppamento. */
  genres: Array<TagRef & { parent?: string | null }>;
  typeTags: TagRef[];
  moods: string[];
  releasedAt: string;
  isCollab: boolean;
  hasStems: boolean;
  /** Stems non scaricabili dal sito: li manda lo staff in chat privata dopo l'acquisto. */
  stemsOnRequest: boolean;
  deal: DealRef | null;
}

export interface BeatDetail extends BeatSummary {
  description: string | null;
  exclusiveAvailable: boolean;
}

export interface SearchResult {
  items: BeatSummary[];
  total: number;
  page: number;
  pageCount: number;
}

export interface Facets {
  producers: Array<{ slug: string; name: string; isResident: boolean; accentColor: string | null; count: number }>;
  genres: Array<TagRef & { parent: string | null; count: number }>;
  typeTags: Array<TagRef & { count: number }>;
  bpm: { min: number; max: number };
}

export interface OwnedLicense {
  id: string;
  beatId: string;
  type: LicenseType;
  createdAt: string;
}

export interface LevelInfo {
  id: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  name: string;
  color: string;
  months: number;
  studioDiscountPct: number;
  perks: string[];
  next: { name: string; monthsToNext: number } | null;
}

export interface Viewer {
  id: string;
  name: string;
  artistName: string | null;
  image: string | null;
  /** ARTIST per tutti; PRODUCER e ADMIN sono lo staff (area Gestione, accesso prima del lancio). */
  role: UserRole;
  /** Profilo producer collegato all'account dello staff (firma dei beat caricati). */
  producerSlug: string | null;
  /** Totale spendibile (abbonamento + portafoglio). */
  creditBalance: number;
  /** Le due borse: `subscription` segue rollover e scadenza, `wallet` non scade. */
  credits: { subscription: number; wallet: number };
  level: LevelInfo;
  referralCode: string | null;
  plan: {
    tier: PlanTier;
    interval: PlanInterval;
    status: string;
    renewsAt: string;
    cancelAtPeriodEnd: boolean;
    pausedUntil: string | null;
  } | null;
  /** licenze possedute, indicizzate per beatId */
  owned: Record<string, LicenseType[]>;
}

export interface ProjectSummary {
  id: string;
  title: string;
  summary: string;
  status: "DRAFT" | "IN_STUDIO" | "DELIVERED";
  dueAt: string | null;
}

export interface UnlockResponse {
  license: OwnedLicense;
  balance: number;
  alreadyOwned: boolean;
  downloads: Array<{ asset: "MP3" | "WAV" | "STEMS"; url: string }>;
}

export interface CustomizationSummary {
  id: string;
  beat: Pick<BeatSummary, "id" | "slug" | "title" | "producers" | "coverUrl">;
  options: string[];
  express: boolean;
  notes: string;
  creditsSpent: number;
  status: "REQUESTED" | "IN_PROGRESS" | "DELIVERED" | "REFUNDED";
  dueAt: string;
  createdAt: string;
}

export interface CustomizationResponse {
  request: CustomizationSummary;
  balance: number;
}

export interface ProductSummary {
  id: string;
  slug: string;
  kind: ProductKind;
  title: string;
  description: string;
  contents: string[];
  priceCents: number;
  credits: number;
  coverColor: string;
  producer: { name: string; accentColor: string | null } | null;
  owned: boolean;
  /** C'è una demo d'ascolto (`/api/products/<id>/preview`). */
  hasPreview: boolean;
}

export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "IN_PROGRESS" | "DELIVERED" | "CANCELED" | "REFUNDED";

export interface ServiceOrderSummary {
  id: string;
  kind: ServiceKind;
  tierId: string;
  beat: { slug: string; title: string } | null;
  notes: string;
  scheduledFor: string | null;
  paidWith: "CREDITS" | "CARD";
  creditsSpent: number;
  amountCents: number;
  discountPct: number;
  status: OrderStatus;
  createdAt: string;
}

export interface GiftCardSummary {
  id: string;
  code: string;
  credits: number;
  recipientName: string | null;
  redeemed: boolean;
  createdAt: string;
}

export interface AuctionSummary {
  id: string;
  beat: BeatSummary;
  startsAt: string;
  endsAt: string;
  phase: "SCHEDULED" | "LIVE" | "ENDED";
  status: "OPEN" | "AWAITING_PAYMENT" | "PAID" | "UNSOLD";
  live: boolean;
  startPriceCents: number;
  minIncrementCents: number;
  topBidCents: number | null;
  minNextBidCents: number;
  bidCount: number;
  /** Nome d'artista del miglior offerente (o del vincitore). */
  leader: string | null;
  bids: Array<{ artist: string; amountCents: number; at: string }>;
  viewer: { isLeader: boolean; isWinner: boolean; payBy: string | null; earlyAccess: boolean } | null;
}

/** Dati per l'overlay della diretta TikTok (app overlay-live). */
export interface LiveOverlay {
  auction: AuctionSummary | null;
  /** Coda dei pezzi da ascoltare stasera, prima chi ha pagato di più. */
  queue: Array<{ artist: string; tier: string; tierName: string }>;
  updatedAt: string;
}

/** Esito di un acquisto: fatto subito (crediti) o da completare su Stripe (carta). */
export type PurchaseResponse = { kind: "done"; balance: number; message: string } | { kind: "redirect"; url: string };

export interface ApiError {
  error: { code: string; message: string };
}

/* ------------------------------------------------------------------ */
/* Cerco feat (lib/beats/feat.ts)                                      */
/* ------------------------------------------------------------------ */

/** Artista come appare in bacheca e in chat: nome d'artista, colore dell'avatar, livello Resident. */
export interface FeatArtist {
  name: string;
  color: string;
  level: Pick<LevelInfo, "id" | "name" | "color">;
}

export interface FeatPostSummary {
  id: string;
  role: string;
  text: string;
  genre: TagRef | null;
  city: string | null;
  beat: BeatSummary | null;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  expiresAt: string;
  author: FeatArtist;
  /** L'annuncio è dell'artista collegato. */
  isMine: boolean;
  /** Artisti che hanno risposto (chat con almeno un messaggio). */
  replyCount: number;
  /** Chat già aperta dall'artista collegato su questo annuncio. */
  threadId: string | null;
}

export interface FeatMessageItem {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface FeatThreadSummary {
  id: string;
  post: { id: string; role: string; text: string; status: "OPEN" | "CLOSED"; beatTitle: string | null };
  /** L'altra persona della chat. */
  other: FeatArtist;
  /** L'artista collegato è l'autore dell'annuncio (gli altri gli hanno risposto). */
  isAuthor: boolean;
  last: FeatMessageItem | null;
  unread: number;
  updatedAt: string;
}

export interface FeatThreadDetail extends FeatThreadSummary {
  messages: FeatMessageItem[];
}

export interface FeatInbox {
  threads: FeatThreadSummary[];
  unread: number;
}
