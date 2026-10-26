/** Coppia di produttori che hanno firmato insieme almeno un beat (preset "Collab tra producer"). */
export interface ProducerPair {
  slugs: [string, string];
  names: [string, string];
  colors: [string, string];
  count: number;
}

/** Coppie di produttori dal catalogo, ordinate per numero di beat insieme. */
export function producerPairs(beats: Array<{ producers: Array<{ slug: string; name: string; accentColor: string | null }> }>): ProducerPair[] {
  const map = new Map<string, ProducerPair>();
  for (const beat of beats) {
    const ps = [...beat.producers].sort((a, b) => a.slug.localeCompare(b.slug));
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const key = `${ps[i].slug}|${ps[j].slug}`;
        const entry = map.get(key) ?? {
          slugs: [ps[i].slug, ps[j].slug] as [string, string],
          names: [ps[i].name, ps[j].name] as [string, string],
          colors: [ps[i].accentColor ?? "#0066ff", ps[j].accentColor ?? "#0066ff"] as [string, string],
          count: 0,
        };
        entry.count++;
        map.set(key, entry);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
