/**
 * Presentazione dei generi: colore di ogni genere principale e raggruppamento dei beat.
 * Un beat appartiene al genere principale (padre) del suo primo genere: Plugg → Trap.
 */
import type { BeatSummary, Facets } from "./types";

export const GENRE_COLORS: Record<string, string> = {
  trap: "#121214",
  drill: "#e0306c",
  rnb: "#66666d",
  pop: "#c9c9ce",
  synthwave: "#2e2e33",
  afro: "#8e8e95",
};

export const genreColor = (slug: string | null | undefined) => (slug && GENRE_COLORS[slug]) || "#8e8e93";

export function topGenreOf(beat: BeatSummary, facets?: Facets): string | null {
  const first = beat.genres[0];
  if (!first) return null;
  return first.parent ?? facets?.genres.find((g) => g.slug === first.slug)?.parent ?? first.slug;
}

export const beatColor = (beat: BeatSummary) => genreColor(topGenreOf(beat));

export interface GenreGroup {
  slug: string;
  name: string;
  color: string;
  subgenres: string[];
  beats: BeatSummary[];
}

/** Gruppi nell'ordine della tassonomia; i generi vuoti non compaiono. */
export function groupByGenre(beats: BeatSummary[], facets: Facets): GenreGroup[] {
  const parents = facets.genres.filter((g) => !g.parent);
  const groups = parents.map((g) => ({
    slug: g.slug,
    name: g.name,
    color: genreColor(g.slug),
    subgenres: facets.genres.filter((s) => s.parent === g.slug).map((s) => s.name),
    beats: [] as BeatSummary[],
  }));
  for (const beat of beats) {
    const top = topGenreOf(beat, facets);
    groups.find((g) => g.slug === top)?.beats.push(beat);
  }
  return groups.filter((g) => g.beats.length);
}
