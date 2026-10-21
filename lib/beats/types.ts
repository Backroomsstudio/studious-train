/** DTO condivisi tra server e client (serializzabili in JSON). */
import type { LicenseType } from "./licenses";
import type { MusicalKey } from "./music";
import type { PlanTier } from "./plans";

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
  genres: TagRef[];
  typeTags: TagRef[];
  moods: string[];
  releasedAt: string;
  isCollab: boolean;
  hasStems: boolean;
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

export interface Viewer {
  id: string;
  name: string;
  artistName: string | null;
  image: string | null;
  creditBalance: number;
  plan: { tier: PlanTier; status: string; renewsAt: string; cancelAtPeriodEnd: boolean } | null;
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

export interface ApiError {
  error: { code: string; message: string };
}
