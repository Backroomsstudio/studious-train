/**
 * Licenze sbloccabili con i crediti: costo, file inclusi e termini d'uso.
 * L'esclusiva non passa dai crediti (trattativa diretta con i produttori).
 */

export type LicenseType = "MP3_LEASE" | "WAV_LEASE" | "TRACKOUT" | "UNLIMITED";
export type DownloadAsset = "MP3" | "WAV" | "STEMS";

export interface LicenseTerms {
  streams: number | null;
  musicVideos: number | null;
  distributionCopies: number | null;
  radio: boolean;
}

export interface LicenseDefinition {
  type: LicenseType;
  name: string;
  credits: number;
  assets: DownloadAsset[];
  terms: LicenseTerms;
  summary: string;
}

export const LICENSES: Record<LicenseType, LicenseDefinition> = {
  MP3_LEASE: {
    type: "MP3_LEASE",
    name: "MP3 Lease",
    credits: 2,
    assets: ["MP3"],
    terms: { streams: 100_000, musicVideos: 1, distributionCopies: 2_000, radio: false },
    summary: "MP3 320 kbps · 100k stream",
  },
  WAV_LEASE: {
    type: "WAV_LEASE",
    name: "WAV Lease",
    credits: 4,
    assets: ["MP3", "WAV"],
    terms: { streams: 500_000, musicVideos: 1, distributionCopies: 5_000, radio: true },
    summary: "WAV 24 bit non masterizzato · 500k stream",
  },
  TRACKOUT: {
    type: "TRACKOUT",
    name: "Trackout",
    credits: 8,
    assets: ["MP3", "WAV", "STEMS"],
    terms: { streams: 1_000_000, musicVideos: 2, distributionCopies: 10_000, radio: true },
    summary: "WAV + stems separati · 1M stream",
  },
  UNLIMITED: {
    type: "UNLIMITED",
    name: "Unlimited",
    credits: 15,
    assets: ["MP3", "WAV", "STEMS"],
    terms: { streams: null, musicVideos: null, distributionCopies: null, radio: true },
    summary: "Stems + uso illimitato non esclusivo",
  },
};

export const LICENSE_ORDER: LicenseType[] = ["MP3_LEASE", "WAV_LEASE", "TRACKOUT", "UNLIMITED"];

export function isLicenseType(value: unknown): value is LicenseType {
  return typeof value === "string" && value in LICENSES;
}

/** Costo scontato (beat del giorno): arrotondato, mai sotto 1 credito. */
export function creditCost(type: LicenseType, discountPct = 0): number {
  const base = LICENSES[type].credits;
  if (discountPct <= 0) return base;
  return Math.max(1, Math.round(base * (1 - discountPct / 100)));
}

/** Una licenza superiore sblocca anche i file delle inferiori. */
export function licenseIncludesAsset(type: LicenseType, asset: DownloadAsset): boolean {
  return LICENSES[type].assets.includes(asset);
}
