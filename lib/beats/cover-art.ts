/**
 * Copertine generative: quando un beat non ha immagine ne disegniamo una, sempre la stessa.
 * Tutto è deterministico (seme = id/slug): stessa forma d'onda circolare, stessi colori, stessa
 * posizione della luce a ogni rendering, sul server e sul client.
 *
 * - Colori: luce del produttore principale + colore del genere principale.
 * - BPM: numero di anelli interni (più veloce = più anelli) e densità dei raggi.
 * - Tonalità: un punto acceso sulla ruota Camelot esterna (12 posizioni) e rotazione dei raggi;
 *   le maggiori stanno sull'anello esterno, le minori su quello interno.
 *
 * Funzione pura senza dipendenze dal DOM: testabile con Node e usabile nei Server Component.
 */
import { GENRE_COLORS } from "./genres";
import { camelotNumber, type MusicalKey } from "./music";

export interface CoverArtInput {
  id?: string;
  slug?: string;
  title: string;
  bpm?: number;
  key?: MusicalKey;
  peaks?: number[];
  producers: Array<{ accentColor: string | null }>;
  genres?: Array<{ slug: string; parent?: string | null }>;
}

/** `lite` = per le miniature: meno raggi, tratti più spessi, niente grana. */
export type CoverDetail = "lite" | "full";

/** Hash FNV-1a a 32 bit: veloce e stabile tra runtime. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generatore pseudo-casuale mulberry32 (lo stesso del prototipo). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
const safeColor = (c: string | null | undefined, fallback: string) => (c && HEX.test(c) ? c.toLowerCase() : fallback);
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** Ruota la tinta di un colore #rrggbb di `deg` gradi (spazio HSL). */
export function shiftHue(hex: string, deg: number): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + deg) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** Forma d'onda di riserva quando il beat non porta i picchi (es. schede delle aste). */
function fallbackPeaks(rand: () => number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / n;
    const section = t < 0.08 ? 0.35 : t > 0.92 ? 0.3 : Math.floor(t * 8) % 3 === 2 ? 0.95 : 0.7;
    return Math.min(1, Math.max(0.06, section * (i % 4 === 0 ? 1 : 0.78) * (0.72 + rand() * 0.28)));
  });
}

export function coverArtSVG(beat: CoverArtInput, detail: CoverDetail = "full"): string {
  const seed = hashSeed(beat.id || beat.slug || beat.title);
  const rand = rng(seed);
  const top = beat.genres?.[0];
  const genre = safeColor(GENRE_COLORS[top?.parent ?? top?.slug ?? ""], "#8e8e93");
  const prod = safeColor(beat.producers[0]?.accentColor, "#0066ff");
  const bpm = Math.min(200, Math.max(60, beat.bpm ?? 120));
  const camelot = beat.key ? camelotNumber(beat.key) : 1 + Math.floor(rand() * 12);
  const minor = beat.key ? beat.key.mode === "MINOR" : rand() > 0.5;

  // Luce: posizione dal seme, come gx/gy del prototipo.
  const gx = Math.round(rand() * 80 + 10);
  const gy = Math.round(rand() * 60 + 10);
  // Terza tinta dal seme: due beat dello stesso produttore e genere non si somigliano troppo.
  const tint = shiftHue(genre, (rand() - 0.5) * 120);
  const rot = ((camelot - 1) * 30 + (rand() - 0.5) * 24 - 90) * (Math.PI / 180);

  // Raggi: 64-96 in base al BPM sulle copertine grandi, metà sulle miniature.
  const full = detail === "full";
  const n = Math.round((full ? 64 : 36) + ((bpm - 60) / 140) * (full ? 32 : 12));
  const peaks = beat.peaks?.length ? beat.peaks : fallbackPeaks(rand, 140);
  let rays = "";
  for (let i = 0; i < n; i++) {
    const v = Math.min(1, Math.max(0.04, peaks[Math.floor((i / n) * peaks.length)] ?? 0.5));
    const a = (i / n) * Math.PI * 2 + rot;
    const r1 = 42;
    const r2 = 44 + v * (full ? 44 : 40);
    const c = Math.cos(a);
    const s = Math.sin(a);
    rays += `M${f1(100 + c * r1)} ${f1(100 + s * r1)}L${f1(100 + c * r2)} ${f1(100 + s * r2)}`;
  }

  // Anelli interni: 1 a 70 BPM, fino a 4 sopra i 150.
  const ringCount = Math.min(4, Math.max(1, Math.round((bpm - 55) / 30)));
  let rings = "";
  for (let i = 0; i < ringCount; i++) {
    rings += `<circle cx='100' cy='100' r='${f1(14 + (i * 22) / ringCount)}' fill='none' stroke='${genre}' stroke-opacity='${f1(0.18 + i * 0.08)}' stroke-width='${full ? 1 : 1.6}'/>`;
  }

  // Ruota Camelot: 12 punti, quello della tonalità acceso.
  const wheelR = minor ? 88 : 94;
  let wheel = "";
  if (full) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const on = i === camelot - 1;
      wheel += `<circle cx='${f1(100 + Math.cos(a) * wheelR)}' cy='${f1(100 + Math.sin(a) * wheelR)}' r='${on ? 3.2 : 1.2}' fill='${on ? "#fff" : genre}' fill-opacity='${on ? 1 : 0.35}'${on ? " filter='url(#b)'" : ""}/>`;
    }
  }

  const defs =
    `<radialGradient id='g' cx='${gx}%' cy='${gy}%' r='80%'><stop offset='0' stop-color='${prod}' stop-opacity='.9'/><stop offset='.5' stop-color='${genre}' stop-opacity='.38'/><stop offset='1' stop-color='#05070a' stop-opacity='0'/></radialGradient>` +
    `<radialGradient id='h' cx='${100 - gx}%' cy='${100 - gy}%' r='62%'><stop offset='0' stop-color='${tint}' stop-opacity='.5'/><stop offset='1' stop-color='${tint}' stop-opacity='0'/></radialGradient>` +
    `<linearGradient id='s' gradientUnits='userSpaceOnUse' x1='20' y1='20' x2='180' y2='180'><stop offset='0' stop-color='#fff'/><stop offset='.45' stop-color='${tint}'/><stop offset='.7' stop-color='${genre}'/><stop offset='1' stop-color='${prod}'/></linearGradient>` +
    (full
      ? `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><filter id='b' x='-2' y='-2' width='5' height='5'><feGaussianBlur stdDeviation='1.6'/><feMerge><feMergeNode/><feMergeNode in='SourceGraphic'/></feMerge></filter>`
      : "");

  return (
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs>${defs}</defs>` +
    `<rect width='200' height='200' fill='#07090d'/><rect width='200' height='200' fill='url(#g)'/><rect width='200' height='200' fill='url(#h)'/>` +
    `<circle cx='100' cy='100' r='94' fill='none' stroke='#fff' stroke-opacity='.07'/>${wheel}` +
    `<circle cx='100' cy='100' r='38' fill='#05070a' fill-opacity='.55' stroke='${genre}' stroke-opacity='.6'/>${rings}` +
    `<path d='${rays}' fill='none' stroke='url(#s)' stroke-width='${full ? 2.2 : 3.2}' stroke-linecap='round'/>` +
    (full ? `<rect width='200' height='200' filter='url(#n)' opacity='.15'/>` : "") +
    `</svg>`
  );
}

/** Data URI compatto: solo i caratteri che rompono un URL vengono codificati. */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${svg.replace(/[%#<>"{}|\\^`\n]/g, (ch) => encodeURIComponent(ch))}`;
}

const cache = new Map<string, string>();
const CACHE_LIMIT = 600;

/** Copertina pronta per `<img src>`, memoizzata per beat e livello di dettaglio. */
export function coverArtURI(beat: CoverArtInput, detail: CoverDetail = "full"): string {
  const key = `${beat.id ?? ""}|${beat.slug ?? ""}|${beat.title}|${detail}|${beat.peaks?.length ?? 0}|${beat.bpm ?? ""}|${beat.producers[0]?.accentColor ?? ""}`;
  let uri = cache.get(key);
  if (!uri) {
    uri = svgToDataUri(coverArtSVG(beat, detail));
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, uri);
  }
  return uri;
}
