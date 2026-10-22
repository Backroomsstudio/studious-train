import "server-only";
import { isNewRelease } from "../drops";
import { DEFAULT_FILTERS, type SortOrder } from "../filters";
import type { BeatSummary } from "../types";
import { getBackend } from "./backend";

/** Catalogo intero (fino a `maxPages` pagine) per Swipe e Confronto: prima le nuove uscite. */
export async function loadCatalog(sort: SortOrder = "popular", maxPages = 3): Promise<BeatSummary[]> {
  const backend = await getBackend();
  const first = await backend.search({ ...DEFAULT_FILTERS, sort });
  const rest = await Promise.all(
    Array.from({ length: Math.min(first.pageCount, maxPages) - 1 }, (_, i) => backend.search({ ...DEFAULT_FILTERS, sort, page: i + 2 })),
  );
  const all = [first, ...rest].flatMap((r) => r.items);
  const unique = [...new Map(all.map((b) => [b.id, b])).values()];
  // Ordinamento stabile: le uscite della settimana in cima, poi l'ordine richiesto.
  return unique.map((b, i) => ({ b, i, fresh: isNewRelease(b.releasedAt) })).sort((x, y) => Number(y.fresh) - Number(x.fresh) || x.i - y.i).map((x) => x.b);
}
