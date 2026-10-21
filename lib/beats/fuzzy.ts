/**
 * Ricerca fuzzy in memoria con la stessa idea di pg_trgm (similarità a trigrammi),
 * usata in modalità demo. Tollera refusi: "travis scot", "frya", "levl 0".
 */

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9#]+/g, " ")
    .trim();
}

function trigrams(word: string): Set<string> {
  const padded = `  ${word} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

export function similarity(a: string, b: string): number {
  const ga = trigrams(a);
  const gb = trigrams(b);
  let shared = 0;
  ga.forEach((g) => gb.has(g) && shared++);
  return shared / (ga.size + gb.size - shared);
}

/** Punteggio 0..1: ogni parola della query deve trovare una corrispondenza nel documento. */
export function fuzzyScore(query: string, document: string): number {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return 1;
  const doc = normalize(document);
  const words = doc.split(" ");
  let total = 0;
  for (const term of terms) {
    let best = 0;
    if (doc.includes(term)) best = 1;
    else {
      for (const word of words) {
        best = Math.max(best, word.startsWith(term) ? 0.9 : similarity(term, word));
        if (best >= 0.9) break;
      }
    }
    if (best < 0.3) return 0;
    total += best;
  }
  return total / terms.length;
}
