/**
 * Catalogo dimostrativo: alimenta la modalità demo e `prisma/seed.ts`.
 * I nomi dei produttori vengono dal mockup; titoli, tag e numeri sono segnaposto da
 * sostituire con il catalogo reale prima del lancio.
 */
import type { KeyMode } from "./music";
import type { ProductKind } from "./offers";

export interface DemoProducer {
  slug: string;
  name: string;
  isResident: boolean;
  accentColor: string;
  bio: string;
}

export interface DemoGenre {
  slug: string;
  name: string;
  parent: string | null;
}

export interface DemoBeat {
  id: string;
  slug: string;
  title: string;
  bpm: number;
  keyRoot: number;
  keyMode: KeyMode;
  durationSec: number;
  producers: Array<{ slug: string; role: "MAIN" | "CO_PRODUCER"; splitPct: number }>;
  genres: string[];
  typeTags: string[];
  moods: string[];
  hasStems: boolean;
  daysAgo: number;
  plays: number;
  peaks: number[];
}

export const DEMO_PRODUCERS: DemoProducer[] = [
  { slug: "astral", name: "Astral", isResident: true, accentColor: "#121214", bio: "Trap melodica e atmosfere spaziali." },
  { slug: "freya", name: "Freya", isResident: true, accentColor: "#e0306c", bio: "R&B, pop e mix & master in studio." },
  { slug: "plugghe", name: "Plugghe", isResident: true, accentColor: "#8e8e95", bio: "Plugg, rage e 808 che spingono." },
];

export const DEMO_GENRES: DemoGenre[] = [
  { slug: "trap", name: "Trap", parent: null },
  { slug: "plugg", name: "Plugg", parent: "trap" },
  { slug: "rage", name: "Rage", parent: "trap" },
  { slug: "drill", name: "Drill", parent: null },
  { slug: "uk-drill", name: "UK Drill", parent: "drill" },
  { slug: "ny-drill", name: "NY Drill", parent: "drill" },
  { slug: "rnb", name: "R&B", parent: null },
  { slug: "pop", name: "Pop", parent: null },
  { slug: "synthwave", name: "Synthwave", parent: null },
  { slug: "afro", name: "Afro", parent: null },
];

export const DEMO_TYPE_TAGS = [
  { slug: "travis-scott", name: "Travis Scott" },
  { slug: "drake", name: "Drake" },
  { slug: "metro-boomin", name: "Metro Boomin" },
  { slug: "the-weeknd", name: "The Weeknd" },
  { slug: "playboi-carti", name: "Playboi Carti" },
  { slug: "central-cee", name: "Central Cee" },
  { slug: "sfera-ebbasta", name: "Sfera Ebbasta" },
  { slug: "lazza", name: "Lazza" },
  { slug: "anna", name: "Anna" },
  { slug: "tedua", name: "Tedua" },
];

/** PRNG deterministico (mulberry32): stesso catalogo a ogni avvio. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Forma d'onda plausibile: intro, strofe, ritornelli più densi, outro. */
export function demoPeaks(seed: number, count = 160): number[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const section = t < 0.08 ? 0.35 : t > 0.92 ? 0.3 : Math.floor(t * 8) % 3 === 2 ? 0.95 : 0.7;
    const beat = i % 4 === 0 ? 1 : 0.78;
    return Math.round(Math.min(1, Math.max(0.06, section * beat * (0.72 + rand() * 0.28))) * 100) / 100;
  });
}

type Row = [
  title: string,
  bpm: number,
  key: string,
  producers: string,
  genres: string,
  types: string,
  moods: string,
  daysAgo: number,
];

// key: tonica + "M"/"m" · produttori: "astral" oppure "astral+freya" (collaborazione)
const ROWS: Row[] = [
  ["Level 0", 142, "9m", "astral", "trap", "travis-scott,metro-boomin", "buio,ipnotico", 1],
  ["Ronzio", 128, "4m", "freya", "rnb", "the-weeknd,drake", "notturno,sensuale", 0],
  ["Moquette", 96, "7M", "freya+astral", "rnb,pop", "drake", "caldo,nostalgico", 3],
  ["Neon Giallo", 150, "2m", "plugghe", "plugg", "playboi-carti", "euforico", 2],
  ["Corridoio", 140, "6m", "plugghe+astral", "uk-drill", "central-cee", "teso,scuro", 4],
  ["Luce Fluorescente", 118, "11m", "astral", "synthwave", "the-weeknd", "retro,malinconico", 5],
  ["Pool Rooms", 104, "0M", "freya", "pop", "anna", "estivo,leggero", 6],
  ["No-Clip", 160, "1m", "plugghe", "rage", "playboi-carti,travis-scott", "aggressivo", 7],
  ["Level 37", 138, "8m", "astral", "trap", "sfera-ebbasta", "epico", 8],
  ["Stanza Vuota", 82, "5m", "freya", "rnb", "drake,the-weeknd", "intimo,triste", 9],
  ["Ultimo Piano", 144, "10m", "astral+plugghe", "ny-drill", "central-cee", "minaccioso", 10],
  ["Vetro", 122, "3M", "freya", "pop,afro", "anna", "solare", 12],
  ["Cromo", 146, "9m", "plugghe", "trap", "metro-boomin", "freddo,metallico", 13],
  ["Fuori Orario", 100, "2M", "freya+astral", "afro", "drake", "ballabile", 15],
  ["Polvere", 72, "7m", "astral", "trap", "lazza", "cinematico", 16],
  ["Vicenza Nord", 136, "4m", "plugghe", "drill", "tedua", "crudo", 18],
  ["Mezzanotte", 90, "8M", "freya", "rnb", "the-weeknd", "notturno", 20],
  ["Statico", 155, "11m", "plugghe+freya", "rage,synthwave", "playboi-carti", "glitch,energico", 22],
  ["Eco", 130, "0m", "astral", "plugg", "sfera-ebbasta,lazza", "sognante", 25],
  ["Segnale", 112, "6M", "freya", "synthwave,pop", "the-weeknd", "anni 80", 28],
];

export const DEMO_BEATS: DemoBeat[] = ROWS.map(([title, bpm, key, producers, genres, types, moods, daysAgo], i) => {
  const rand = seededRandom(1000 + i);
  const crew = producers.split("+");
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    id: `demo-${slug}`,
    slug,
    title,
    bpm,
    keyRoot: Number(key.slice(0, -1)),
    keyMode: key.endsWith("M") ? "MAJOR" : "MINOR",
    durationSec: 130 + Math.floor(rand() * 70),
    producers: crew.map((slug, j) => ({
      slug,
      role: j === 0 ? "MAIN" : "CO_PRODUCER",
      splitPct: Math.floor(100 / crew.length),
    })),
    genres: genres.split(","),
    typeTags: types.split(","),
    moods: moods.split(","),
    hasStems: i % 4 !== 3,
    daysAgo,
    plays: Math.floor(200 + rand() * 4800),
    peaks: demoPeaks(2000 + i),
  };
});

/** Beat del giorno della demo: sconto del 30% che si rinnova ogni giorno a mezzanotte. */
export const DEMO_DEAL = { beatSlug: "ronzio", discountPct: 30 };

export function searchDocumentFor(beat: DemoBeat): string {
  const producerNames = beat.producers.map((p) => DEMO_PRODUCERS.find((d) => d.slug === p.slug)?.name ?? p.slug);
  const genreNames = beat.genres.map((g) => DEMO_GENRES.find((d) => d.slug === g)?.name ?? g);
  const typeNames = beat.typeTags.map((t) => `${DEMO_TYPE_TAGS.find((d) => d.slug === t)?.name ?? t} type beat`);
  return [beat.title, ...producerNames, ...genreNames, ...typeNames, ...beat.moods].join(" ").toLowerCase();
}

export interface DemoProduct {
  slug: string;
  kind: ProductKind;
  title: string;
  description: string;
  contents: string[];
  producer: string;
  priceCents: number;
  credits: number;
  coverColor: string;
}

/** Drum kit, sample pack e preset dello studio (prezzi da lib/beats/offers.ts). */
export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    slug: "backrooms-drum-kit-vol-1",
    kind: "DRUM_KIT",
    title: "Backrooms Drum Kit Vol. 1",
    description: "I suoni con cui sono nati Level 0 e Cromo: kick, snare e 808 già accordati.",
    contents: ["42 one-shot", "12 loop di hi-hat", "8 808 accordati", "Licenza royalty-free"],
    producer: "astral",
    priceCents: 2490,
    credits: 8,
    coverColor: "#121214",
  },
  {
    slug: "plugghe-808-arsenal",
    kind: "DRUM_KIT",
    title: "Plugghe 808 Arsenal",
    description: "808 distorti, clap e percussioni rage: il kit dietro No-Clip e Neon Giallo.",
    contents: ["24 808", "30 percussioni", "10 FX", "Licenza royalty-free"],
    producer: "plugghe",
    priceCents: 2490,
    credits: 8,
    coverColor: "#8e8e95",
  },
  {
    slug: "fluorescent-melodies",
    kind: "SAMPLE_PACK",
    title: "Fluorescent Melodies",
    description: "Melodie e texture notturne in WAV, con BPM e tonalità nel nome del file.",
    contents: ["25 loop melodici", "Stems di ogni loop", "Tonalità e BPM nel nome", "Licenza royalty-free"],
    producer: "astral",
    priceCents: 2990,
    credits: 10,
    coverColor: "#2e2e33",
  },
  {
    slug: "freya-rnb-sessions",
    kind: "SAMPLE_PACK",
    title: "Freya R&B Sessions",
    description: "Chitarre, rhodes e cori registrati nello Studio Lounge.",
    contents: ["30 loop", "8 cori", "Rhodes e chitarre vere", "Licenza royalty-free"],
    producer: "freya",
    priceCents: 2990,
    credits: 10,
    coverColor: "#66666d",
  },
  {
    slug: "voce-chrome",
    kind: "VOCAL_PRESET",
    title: "Voce Chrome",
    description: "Le catene voce che usiamo in studio, pronte da aprire nella tua DAW.",
    contents: ["6 catene: rap, melodico, ad-lib", "FL Studio, Logic, Ableton", "Solo plugin stock", "Video guida"],
    producer: "freya",
    priceCents: 1990,
    credits: 6,
    coverColor: "#e0306c",
  },
  {
    slug: "autotune-notturno",
    kind: "VOCAL_PRESET",
    title: "Autotune Notturno",
    description: "Il suono melodico trap delle nostre uscite, dal tuning al riverbero.",
    contents: ["4 catene tuning", "Delay e riverberi a tempo", "FL Studio e Logic", "Video guida"],
    producer: "plugghe",
    priceCents: 1990,
    credits: 6,
    coverColor: "#c9c9ce",
  },
];
