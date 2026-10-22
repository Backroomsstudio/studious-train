import { SwipeDeck } from "@/components/beats/engage/swipe-deck";
import { loadCatalog } from "@/lib/beats/server/catalog";

export const metadata = { title: "Swipe", description: "Scopri i beat uno alla volta: scorri a destra quelli che ti piacciono." };

/** Modalità Swipe. Con `?da=<slug>` il mazzo parte da quel beat. */
export default async function SwipePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { da } = await searchParams;
  const catalog = await loadCatalog();
  const start = typeof da === "string" ? catalog.findIndex((b) => b.slug === da) : -1;
  const deck = start > 0 ? [...catalog.slice(start), ...catalog.slice(0, start)] : catalog;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Modalità Swipe</p>
        <h1 className="chrome-text mt-1 font-display text-4xl font-black tracking-tight">Un beat alla volta</h1>
      </div>
      <SwipeDeck beats={deck} />
    </div>
  );
}
