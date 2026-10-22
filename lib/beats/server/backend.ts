/**
 * Contratto unico del beat store. Due implementazioni:
 * - `prisma-backend.ts`: PostgreSQL + R2 (produzione)
 * - `demo-backend.ts`: catalogo in memoria con audio sintetizzato (sviluppo, anteprime)
 * Le route e le pagine parlano solo con questo contratto.
 */
import "server-only";
import type { BeatFilters } from "../filters";
import type { DownloadAsset, LicenseType } from "../licenses";
import type { CustomizationOption } from "../customizations";
import type { PaidWith, ServiceKind } from "../offers";
import type { StemName } from "../stems";
import type { FeatFilters, FeatPostInput, FeatReportInput } from "../feat";
import type {
  AuctionSummary,
  BeatDetail,
  BeatSummary,
  CustomizationSummary,
  Facets,
  FeatInbox,
  FeatMessageItem,
  FeatPostSummary,
  FeatThreadDetail,
  GiftCardSummary,
  LiveOverlay,
  OwnedLicense,
  ProductSummary,
  ProjectSummary,
  PurchaseResponse,
  SearchResult,
  ServiceOrderSummary,
  Viewer,
} from "../types";
import { storeEnv } from "./env";

export interface LibraryEntry {
  license: OwnedLicense & { creditsSpent: number };
  beat: BeatSummary;
}

export interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

export type FileTarget =
  | { kind: "r2"; objectKey: string; filename: string; contentType: string }
  | { kind: "demo"; beatId: string; filename: string }
  | { kind: "text"; body: string; filename: string };

export interface ServiceRequest {
  kind: ServiceKind;
  tierId: string;
  beatId?: string;
  notes: string;
  scheduledFor?: string;
  paidWith: PaidWith;
}

/** Acquisti con carta che passano da Stripe Checkout. */
export type CheckoutItem =
  | { purpose: "TOPUP"; packId: string }
  | { purpose: "GIFT"; cardId: string; recipientName?: string; message?: string }
  | { purpose: "AUCTION"; auctionId: string };

export interface StoreBackend {
  search(filters: BeatFilters): Promise<SearchResult>;
  facets(): Promise<Facets>;
  beatBySlug(slug: string): Promise<BeatDetail | null>;
  beatOfTheDay(now?: Date): Promise<BeatSummary | null>;
  similar(beat: BeatSummary, limit?: number): Promise<BeatSummary[]>;
  viewer(userId: string): Promise<Viewer | null>;
  projects(userId: string): Promise<ProjectSummary[]>;
  library(userId: string): Promise<LibraryEntry[]>;
  ledger(userId: string, limit?: number): Promise<LedgerEntry[]>;
  unlock(userId: string, beatId: string, license: LicenseType): Promise<{ license: OwnedLicense; balance: number; alreadyOwned: boolean }>;
  resolveDownload(
    userId: string,
    licenseId: string,
    asset: DownloadAsset,
    meta: { ipHash?: string; userAgent?: string },
  ): Promise<FileTarget>;
  preview(beatId: string): Promise<FileTarget | null>;
  /** Anteprima di uno stem per il mixer (con watermark come l'anteprima); null se il beat non ha stems. */
  stemPreview(beatId: string, stem: StemName): Promise<FileTarget | null>;
  /** Beat usciti negli ultimi 7 giorni (drop settimanale), dal più recente. */
  newArrivals(limit?: number): Promise<BeatSummary[]>;
  customize(
    userId: string,
    beatId: string,
    input: { options: CustomizationOption[]; express: boolean; notes: string; referenceUrl?: string },
  ): Promise<{ request: CustomizationSummary; balance: number }>;
  customizations(userId: string): Promise<CustomizationSummary[]>;

  /* Monetizzazione oltre all'abbonamento (lib/beats/offers.ts) */
  products(userId: string | null): Promise<ProductSummary[]>;
  buyProduct(userId: string, productId: string, paidWith: PaidWith, origin: string): Promise<PurchaseResponse>;
  productDownload(userId: string, productId: string): Promise<FileTarget>;
  orderService(userId: string, input: ServiceRequest, origin: string): Promise<PurchaseResponse>;
  orders(userId: string): Promise<ServiceOrderSummary[]>;
  checkout(userId: string, item: CheckoutItem, origin: string): Promise<PurchaseResponse>;
  giftCards(userId: string): Promise<GiftCardSummary[]>;
  redeemGift(userId: string, code: string): Promise<{ credits: number; balance: number }>;
  auctions(viewerId: string | null): Promise<AuctionSummary[]>;
  auction(id: string, viewerId: string | null): Promise<AuctionSummary | null>;
  bid(userId: string, auctionId: string, amountCents: number): Promise<AuctionSummary>;
  liveOverlay(): Promise<LiveOverlay>;
  pause(userId: string, resume: boolean): Promise<{ pausedUntil: string | null }>;

  /* Cerco feat: bacheca delle collaborazioni e chat private (lib/beats/feat.ts) */
  /** Annunci aperti dal più recente (più quelli dell'artista collegato, anche chiusi). */
  featPosts(viewerId: string | null, filters?: FeatFilters): Promise<FeatPostSummary[]>;
  createFeatPost(userId: string, input: FeatPostInput): Promise<FeatPostSummary>;
  /** Solo l'autore chiude il suo annuncio. */
  closeFeatPost(userId: string, postId: string): Promise<FeatPostSummary>;
  /** Apre (o ritrova) la chat tra chi risponde (l'artista collegato) e l'autore dell'annuncio. */
  openFeatThread(userId: string, postId: string): Promise<FeatThreadDetail>;
  /** Messaggi della chat, solo per i due partecipanti; segna come letti quelli ricevuti. */
  featThread(userId: string, threadId: string): Promise<FeatThreadDetail>;
  sendFeatMessage(userId: string, threadId: string, body: string): Promise<FeatMessageItem>;
  /** Chat con almeno un messaggio (come autore o come chi ha risposto) e totale non letti. */
  featInbox(userId: string): Promise<FeatInbox>;
  reportFeat(userId: string, input: FeatReportInput): Promise<void>;
}

let backend: Promise<StoreBackend> | null = null;

export function getBackend(): Promise<StoreBackend> {
  backend ??= storeEnv.demoMode
    ? import("./demo-backend").then((m) => m.createDemoBackend())
    : import("./prisma-backend").then((m) => m.createPrismaBackend());
  return backend;
}
