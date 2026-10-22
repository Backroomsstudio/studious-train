import "server-only";

/**
 * Limite di tentativi in memoria (per istanza): basta contro chi prova codici a raffica.
 * Su più istanze serverless ogni istanza ha il suo contatore, quindi è una difesa in più, non l'unica.
 */
export function createThrottle(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; until: number }>();
  return {
    blocked(key: string): boolean {
      const entry = hits.get(key);
      return Boolean(entry && entry.until > Date.now() && entry.count >= max);
    },
    hit(key: string): void {
      const entry = hits.get(key);
      const fresh = !entry || entry.until <= Date.now();
      hits.set(key, { count: fresh ? 1 : entry.count + 1, until: fresh ? Date.now() + windowMs : entry.until });
      if (hits.size > 5000) for (const [k, v] of hits) if (v.until <= Date.now()) hits.delete(k);
    },
  };
}
