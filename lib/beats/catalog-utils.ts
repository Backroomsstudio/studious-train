import { PAGE_SIZE, type BeatFilters } from "./filters";
import { compatibleKeys, keyId, parseKeyId, type MusicalKey } from "./music";
import type { BeatSummary, SearchResult } from "./types";

/** Tonalità ammesse dal filtro (una sola, o le 4 compatibili sulla ruota Camelot). */
export function keysForFilter(filters: Pick<BeatFilters, "key" | "compatible">): MusicalKey[] | null {
  const key = filters.key ? parseKeyId(filters.key) : null;
  if (!key) return null;
  return filters.compatible ? compatibleKeys(key) : [key];
}

export function sortBeats(items: BeatSummary[], sort: BeatFilters["sort"], plays: (b: BeatSummary) => number): BeatSummary[] {
  const sorted = [...items];
  switch (sort) {
    case "popular":
      return sorted.sort((a, b) => plays(b) - plays(a));
    case "bpm_asc":
      return sorted.sort((a, b) => a.bpm - b.bpm);
    case "bpm_desc":
      return sorted.sort((a, b) => b.bpm - a.bpm);
    case "new":
      return sorted.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
    default:
      return sorted; // "relevance": l'ordine arriva già dal punteggio di ricerca
  }
}

export function paginate(items: BeatSummary[], page: number): SearchResult {
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  return {
    items: items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    total: items.length,
    page: current,
    pageCount,
  };
}

/** Beat affini: tonalità compatibile e BPM entro ±10% (stesso "pocket" per la voce). */
export function isSimilar(base: BeatSummary, other: BeatSummary): boolean {
  if (base.id === other.id) return false;
  const keys = new Set(compatibleKeys(base.key).map(keyId));
  return keys.has(keyId(other.key)) && Math.abs(other.bpm - base.bpm) <= base.bpm * 0.1;
}
