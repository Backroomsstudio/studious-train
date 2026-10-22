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
import type {
  BeatDetail,
  BeatSummary,
  CustomizationSummary,
  Facets,
  OwnedLicense,
  ProjectSummary,
  SearchResult,
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
  | { kind: "demo"; beatId: string; filename: string };

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
  /** Beat usciti negli ultimi 7 giorni (drop settimanale), dal più recente. */
  newArrivals(limit?: number): Promise<BeatSummary[]>;
  customize(
    userId: string,
    beatId: string,
    input: { options: CustomizationOption[]; express: boolean; notes: string; referenceUrl?: string },
  ): Promise<{ request: CustomizationSummary; balance: number }>;
  customizations(userId: string): Promise<CustomizationSummary[]>;
}

let backend: Promise<StoreBackend> | null = null;

export function getBackend(): Promise<StoreBackend> {
  backend ??= storeEnv.demoMode
    ? import("./demo-backend").then((m) => m.createDemoBackend())
    : import("./prisma-backend").then((m) => m.createPrismaBackend());
  return backend;
}
