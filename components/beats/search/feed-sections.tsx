import { NewArrivals } from "@/components/beats/home/new-arrivals";
import { TrackList } from "@/components/beats/marketplace/track-row";
import { RevealList } from "@/components/beats/ui/reveal";
import { daysUntilNextDrop, isNewRelease, releaseWeekLabel } from "@/lib/beats/drops";
import { DEFAULT_FILTERS } from "@/lib/beats/filters";
import { groupByGenre } from "@/lib/beats/genres";
import { getBackend } from "@/lib/beats/server/backend";
import { getFacets } from "@/lib/beats/server/queries";
import type { BeatSummary } from "@/lib/beats/types";

/**
 * Le uscite (ex pagina Feed), vista iniziale di Cerca: il drop della settimana, diviso per genere,
 * i più ascoltati e le uscite precedenti settimana per settimana.
 */
export async function FeedSections() {
  const backend = await getBackend();
  const [arrivals, latest, popular, facets] = await Promise.all([
    backend.newArrivals(),
    backend.search({ ...DEFAULT_FILTERS, sort: "new" }),
    backend.search({ ...DEFAULT_FILTERS, sort: "popular" }),
    getFacets(),
  ]);
  const earlier = latest.items.filter((b) => !isNewRelease(b.releasedAt));
  const weeks = new Map<string, BeatSummary[]>();
  for (const beat of earlier) {
    const label = releaseWeekLabel(beat.releasedAt);
    weeks.set(label, [...(weeks.get(label) ?? []), beat]);
  }

  return (
    <RevealList className="space-y-10">
      <NewArrivals beats={arrivals} daysToNextDrop={daysUntilNextDrop()} />

      {arrivals.length > 0 && (
        <section aria-labelledby="feed-genres" className="space-y-5">
          <h2 id="feed-genres" className="font-display text-xl font-bold">Il drop diviso per genere</h2>
          {groupByGenre(arrivals, facets).map((g) => (
            <div key={g.slug} className="space-y-2">
              <h3 className="flex items-center gap-2.5 font-display text-lg font-bold">
                <span className="h-6 w-1.5 rounded-full" style={{ background: g.color, boxShadow: `0 0 10px ${g.color}` }} aria-hidden />
                {g.name} <span className="text-chrome-400">· {g.beats.length}</span>
              </h3>
              <TrackList beats={g.beats} />
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="feed-popular" className="space-y-2">
        <h2 id="feed-popular" className="font-display text-xl font-bold">I più ascoltati</h2>
        <TrackList beats={popular.items.slice(0, 6)} />
      </section>

      {[...weeks].map(([label, beats]) => (
        <section key={label} aria-label={label} className="space-y-2">
          <h2 className="font-display text-xl font-bold">
            {label} <span className="text-chrome-400">· {beats.length}</span>
          </h2>
          <TrackList beats={beats} />
        </section>
      ))}
    </RevealList>
  );
}
