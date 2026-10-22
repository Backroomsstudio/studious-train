/**
 * Statistiche d'ascolto (funzioni pure, testabili): dal registro locale degli ascolti
 * si calcolano ore totali, produttore, genere e beat preferiti, serie di giorni consecutivi.
 * Alimentano Wrapped, la stanza e i badge.
 */
import type { BeatSummary } from "./types";

/** Quanto basta di un beat per mostrarlo e raggrupparlo (niente forma d'onda nel registro). */
export type ListenedBeat = Pick<BeatSummary, "id" | "slug" | "title" | "bpm" | "key" | "coverUrl" | "producers" | "genres">;

export interface ListenRecord {
  beat: ListenedBeat;
  /** Secondi di ascolto effettivo (tempo reale, pause escluse). */
  seconds: number;
  /** Ascolti "veri": almeno `PLAY_THRESHOLD_SEC` di fila sullo stesso beat. */
  plays: number;
  lastAt: string;
}

export interface ListeningLog {
  beats: Record<string, ListenRecord>;
  /** Secondi ascoltati per giorno locale (AAAA-MM-GG). */
  days: Record<string, number>;
  /** Secondi ascoltati tra mezzanotte e le 5. */
  nightSeconds: number;
}

export const EMPTY_LOG: ListeningLog = { beats: {}, days: {}, nightSeconds: 0 };
export const PLAY_THRESHOLD_SEC = 10;
/** Un giorno conta per la serie se ascolti almeno un minuto. */
export const STREAK_MIN_SEC = 60;

const GENRE_LABELS: Record<string, string> = {
  trap: "Trap",
  drill: "Drill",
  rnb: "R&B",
  pop: "Pop",
  synthwave: "Synthwave",
  afro: "Afro",
};

export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

export function toListenedBeat(beat: ListenedBeat): ListenedBeat {
  const { id, slug, title, bpm, key, coverUrl, producers, genres } = beat;
  return { id, slug, title, bpm, key, coverUrl, producers, genres };
}

/** Aggiunge `seconds` di ascolto di `beat` al registro (immutabile). */
export function addListening(
  log: ListeningLog,
  beat: ListenedBeat,
  seconds: number,
  at: Date,
  options: { countPlay?: boolean } = {},
): ListeningLog {
  if (seconds <= 0 && !options.countPlay) return log;
  const prev = log.beats[beat.id];
  const day = dayKey(at);
  const hour = at.getHours();
  return {
    beats: {
      ...log.beats,
      [beat.id]: {
        beat: toListenedBeat(beat),
        seconds: (prev?.seconds ?? 0) + seconds,
        plays: (prev?.plays ?? 0) + (options.countPlay ? 1 : 0),
        lastAt: at.toISOString(),
      },
    },
    days: { ...log.days, [day]: (log.days[day] ?? 0) + seconds },
    nightSeconds: log.nightSeconds + (hour < 5 ? seconds : 0),
  };
}

/** Serie corrente (finisce oggi, o ieri se oggi non hai ancora ascoltato) e serie più lunga. */
export function streaks(days: Record<string, number>, now: Date): { current: number; longest: number } {
  const active = new Set(Object.entries(days).filter(([, s]) => s >= STREAK_MIN_SEC).map(([d]) => d));
  const today = dayKey(now);
  let cursor = active.has(today) ? today : shiftDay(today, -1);
  let current = 0;
  while (active.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }
  let longest = 0;
  for (const day of active) {
    if (active.has(shiftDay(day, -1))) continue; // non è l'inizio di una serie
    let len = 1;
    while (active.has(shiftDay(day, len))) len++;
    longest = Math.max(longest, len);
  }
  return { current, longest };
}

export interface RankedProducer {
  slug: string;
  name: string;
  accentColor: string | null;
  seconds: number;
}

export interface RankedGenre {
  slug: string;
  name: string;
  seconds: number;
  /** Quota sul totale, 0–100. */
  pct: number;
}

export interface ListeningStats {
  totalSeconds: number;
  /** Ore con un decimale (per i numeri grandi in Wrapped). */
  hours: number;
  minutes: number;
  plays: number;
  activeDays: number;
  streak: number;
  longestStreak: number;
  nightOwl: boolean;
  topBeat: (ListenRecord & { beat: ListenedBeat }) | null;
  topProducer: RankedProducer | null;
  topGenre: RankedGenre | null;
  genres: RankedGenre[];
  producers: RankedProducer[];
}

/** Il genere principale di un beat: il padre del primo genere (Plugg → Trap). */
function mainGenre(beat: ListenedBeat): { slug: string; name: string } | null {
  const first = beat.genres[0];
  if (!first) return null;
  const slug = first.parent ?? first.slug;
  const name = first.parent ? (GENRE_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1)) : first.name;
  return { slug, name };
}

/** Aggrega il registro: con `year` considera solo i giorni di quell'anno per ore e serie. */
export function computeListeningStats(log: ListeningLog, now = new Date(), year?: number): ListeningStats {
  const records = Object.values(log.beats).filter((r) => (year ? new Date(r.lastAt).getFullYear() === year : true));
  const days = year ? Object.fromEntries(Object.entries(log.days).filter(([d]) => d.startsWith(`${year}-`))) : log.days;
  const totalSeconds = Math.round(Object.values(days).reduce((a, s) => a + s, 0));

  const producers = new Map<string, RankedProducer>();
  const genres = new Map<string, Omit<RankedGenre, "pct">>();
  for (const r of records) {
    for (const p of r.beat.producers) {
      const cur = producers.get(p.slug) ?? { slug: p.slug, name: p.name, accentColor: p.accentColor, seconds: 0 };
      // Il produttore principale prende tutto il tempo, il co-produttore metà.
      cur.seconds += p.role === "CO_PRODUCER" ? r.seconds / 2 : r.seconds;
      producers.set(p.slug, cur);
    }
    const g = mainGenre(r.beat);
    if (g) {
      const cur = genres.get(g.slug) ?? { ...g, seconds: 0 };
      cur.seconds += r.seconds;
      genres.set(g.slug, cur);
    }
  }
  const genreTotal = [...genres.values()].reduce((a, g) => a + g.seconds, 0) || 1;
  const rankedGenres = [...genres.values()]
    .sort((a, b) => b.seconds - a.seconds)
    .map((g) => ({ ...g, pct: Math.round((g.seconds / genreTotal) * 100) }));
  const rankedProducers = [...producers.values()].sort((a, b) => b.seconds - a.seconds);
  const topBeat = [...records].sort((a, b) => b.seconds - a.seconds || b.plays - a.plays)[0] ?? null;
  const { current, longest } = streaks(days, now);

  return {
    totalSeconds,
    hours: Math.round((totalSeconds / 3600) * 10) / 10,
    minutes: Math.round(totalSeconds / 60),
    plays: records.reduce((a, r) => a + r.plays, 0),
    activeDays: Object.values(days).filter((s) => s >= STREAK_MIN_SEC).length,
    streak: current,
    longestStreak: longest,
    nightOwl: log.nightSeconds >= STREAK_MIN_SEC,
    topBeat,
    topProducer: rankedProducers[0] ?? null,
    topGenre: rankedGenres[0] ?? null,
    genres: rankedGenres.slice(0, 4),
    producers: rankedProducers,
  };
}
