import { Marketplace } from "@/components/beats/marketplace/marketplace";
import { FeedSections } from "@/components/beats/search/feed-sections";
import { parseFilters } from "@/lib/beats/filters";
import { producerPairs } from "@/lib/beats/pairs";
import { getBackend } from "@/lib/beats/server/backend";
import { loadCatalog } from "@/lib/beats/server/catalog";
import { getFacets } from "@/lib/beats/server/queries";

export const metadata = { title: "Cerca" };

/**
 * Cerca (unisce Feed e Cerca): all'apertura le nuove uscite; toccando la barra compaiono i filtri
 * pronti (producer, collab, collab tra producer, genere) e la ricerca per parole chiave.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const [facets, result, catalog] = await Promise.all([getFacets(), (await getBackend()).search(filters), loadCatalog("new", 5)]);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Uscite, producer e generi</p>
        <h1 className="chrome-text mt-1 font-display text-4xl font-black tracking-tight">Cerca</h1>
      </div>
      <Marketplace initialFilters={filters} initialResult={result} facets={facets} idle={<FeedSections />} pairs={producerPairs(catalog)} />
    </div>
  );
}
