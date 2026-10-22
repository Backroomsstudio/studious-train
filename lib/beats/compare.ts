/**
 * Confronto A/B: i candidati migliori per B sono i beat con BPM vicino a quello di A,
 * con un vantaggio a quelli in tonalità compatibile (ruota di Camelot).
 */
import { compatibleKeys, keyId } from "./music";
import type { BeatSummary } from "./types";

type Comparable = Pick<BeatSummary, "id" | "bpm" | "key">;

export function rankCandidates<T extends Comparable>(a: Comparable, pool: T[], limit = 6): T[] {
  const keys = new Set(compatibleKeys(a.key).map(keyId));
  const score = (x: T) => Math.abs(x.bpm - a.bpm) - (keys.has(keyId(x.key)) ? 3 : 0);
  return pool
    .filter((x) => x.id !== a.id)
    .map((x, i) => ({ x, i, s: score(x) }))
    .sort((p, q) => p.s - q.s || p.i - q.i)
    .slice(0, limit)
    .map((p) => p.x);
}

export const keysCompatible = (a: Comparable, b: Comparable) => compatibleKeys(a.key).some((k) => keyId(k) === keyId(b.key));

export function compareHref(a: string, b?: string): string {
  const params = new URLSearchParams({ a });
  if (b) params.set("b", b);
  return `/beats/confronta?${params}`;
}
