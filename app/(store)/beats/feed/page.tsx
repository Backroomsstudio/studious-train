import { TrackList } from "@/components/beats/marketplace/track-row";
import { DEFAULT_FILTERS } from "@/lib/beats/filters";
import { getBackend } from "@/lib/beats/server/backend";

export const metadata = { title: "Feed" };

const WEEK = 7 * 86_400_000;

/** Nuove uscite della settimana e beat più ascoltati. */
export default async function FeedPage() {
  const backend = await getBackend();
  const [latest, popular] = await Promise.all([
    backend.search({ ...DEFAULT_FILTERS, sort: "new" }),
    backend.search({ ...DEFAULT_FILTERS, sort: "popular" }),
  ]);
  const now = Date.now();
  const thisWeek = latest.items.filter((b) => now - new Date(b.releasedAt).getTime() < WEEK);
  const earlier = latest.items.filter((b) => now - new Date(b.releasedAt).getTime() >= WEEK);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Feed</p>
        <h1 className="chrome-text mt-1 font-display text-4xl font-black tracking-tight">Nuove uscite</h1>
      </div>
      {thisWeek.length > 0 && (
        <section aria-labelledby="feed-week" className="space-y-2">
          <h2 id="feed-week" className="font-display text-xl font-bold">Questa settimana</h2>
          <TrackList beats={thisWeek} />
        </section>
      )}
      <section aria-labelledby="feed-popular" className="space-y-2">
        <h2 id="feed-popular" className="font-display text-xl font-bold">I più ascoltati</h2>
        <TrackList beats={popular.items.slice(0, 8)} />
      </section>
      {earlier.length > 0 && (
        <section aria-labelledby="feed-earlier" className="space-y-2">
          <h2 id="feed-earlier" className="font-display text-xl font-bold">Prima</h2>
          <TrackList beats={earlier} />
        </section>
      )}
    </div>
  );
}
