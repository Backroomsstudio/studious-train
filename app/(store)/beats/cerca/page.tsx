import { Marketplace } from "@/components/beats/marketplace/marketplace";
import { parseFilters } from "@/lib/beats/filters";
import { getBackend } from "@/lib/beats/server/backend";
import { getFacets } from "@/lib/beats/server/queries";

export const metadata = { title: "Cerca" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const [facets, result] = await Promise.all([getFacets(), (await getBackend()).search(filters)]);
  return (
    <div className="space-y-4">
      <h1 className="chrome-text font-display text-4xl font-black tracking-tight">Cerca</h1>
      <Marketplace initialFilters={filters} initialResult={result} facets={facets} autoFocusSearch />
    </div>
  );
}
