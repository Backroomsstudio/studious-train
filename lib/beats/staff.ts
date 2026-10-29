/**
 * Area Gestione dello staff: contratto condiviso tra browser e server (caricamenti, beat, kit).
 * I file vanno dal browser al bucket con un URL firmato; il server registra solo le chiavi,
 * dopo aver controllato che l'oggetto esista davvero.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Caricamenti                                                         */
/* ------------------------------------------------------------------ */

export type FileFormat = "mp3" | "wav" | "zip";

export const CONTENT_TYPES: Record<FileFormat, string> = { mp3: "audio/mpeg", wav: "audio/wav", zip: "application/zip" };

const MB = 1024 * 1024;

/**
 * Ogni "posto" del modulo accetta un formato, con un limite di peso. Per i beat si caricano solo
 * MP3 e WAV: gli stems li manda lo staff in chat a chi compra una licenza che li include.
 */
export const UPLOAD_SLOTS = {
  preview: { label: "Anteprima con tag", format: "mp3", maxBytes: 25 * MB },
  mp3: { label: "Master MP3", format: "mp3", maxBytes: 50 * MB },
  wav: { label: "Master WAV", format: "wav", maxBytes: 400 * MB },
  "product-zip": { label: "Archivio del kit (ZIP)", format: "zip", maxBytes: 3000 * MB },
  "product-preview": { label: "Demo d'ascolto", format: "mp3", maxBytes: 25 * MB },
} as const satisfies Record<string, { label: string; format: FileFormat; maxBytes: number }>;

export type UploadSlot = keyof typeof UPLOAD_SLOTS;

export const isUploadSlot = (value: unknown): value is UploadSlot => typeof value === "string" && value in UPLOAD_SLOTS;

/** Formato dal nome del file (i browser non sono d'accordo sul tipo MIME di WAV e ZIP). */
export function formatOf(filename: string): FileFormat | null {
  const ext = filename.toLowerCase().split(".").pop();
  return ext === "mp3" || ext === "wav" || ext === "zip" ? ext : null;
}

/** Bozza di caricamento: un UUID scelto dal browser, una cartella per beat o kit. */
export const DRAFT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Chiave dell'oggetto: `beats/<bozza>/preview.mp3`, `products/<bozza>/kit.zip`. */
export function uploadKey(draftId: string, slot: UploadSlot): string {
  const format = UPLOAD_SLOTS[slot].format;
  if (slot === "product-zip") return `products/${draftId}/kit.zip`;
  if (slot === "product-preview") return `products/${draftId}/preview.mp3`;
  return `beats/${draftId}/${slot}.${format}`;
}

export const uploadRequestSchema = z.object({
  draftId: z.string().regex(DRAFT_ID),
  slot: z.string().refine(isUploadSlot),
  filename: z.string().min(1).max(200),
  size: z.number().int().positive(),
});

/* ------------------------------------------------------------------ */
/* Beat                                                                */
/* ------------------------------------------------------------------ */

const objectKey = (prefix: "beats/" | "products/") =>
  z
    .string()
    .max(200)
    .refine((k) => k === "" || (k.startsWith(prefix) && !k.includes("..")), "Chiave del file non valida.");

export const beatInputSchema = z
  .object({
    title: z.string().trim().min(1, "Serve un titolo.").max(80),
    description: z.string().trim().max(2000).default(""),
    bpm: z.number().int().min(40, "BPM tra 40 e 250.").max(250, "BPM tra 40 e 250."),
    keyRoot: z.number().int().min(0).max(11),
    keyMode: z.enum(["MAJOR", "MINOR"]),
    durationSec: z.number().int().min(0).max(1800),
    peaks: z.array(z.number().min(0).max(1)).max(400),
    genres: z.array(z.string().max(40)).max(4, "Al massimo 4 generi."),
    typeTags: z.array(z.string().trim().min(1).max(40)).max(6, "Al massimo 6 type beat."),
    moods: z.array(z.string().trim().min(1).max(24)).max(6, "Al massimo 6 mood."),
    producers: z
      .array(z.object({ slug: z.string().max(40), role: z.enum(["MAIN", "CO_PRODUCER"]), splitPct: z.number().int().min(0).max(100) }))
      .min(1, "Scegli almeno un produttore.")
      .max(4),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    releasedAt: z.iso.datetime({ offset: true }),
    exclusiveAvailable: z.boolean(),
    files: z.object({
      preview: objectKey("beats/"),
      mp3: objectKey("beats/"),
      wav: objectKey("beats/"),
      stems: objectKey("beats/").nullable(),
      stemPreviewPrefix: objectKey("beats/").nullable(),
    }),
  })
  .refine((b) => b.producers.reduce((sum, p) => sum + p.splitPct, 0) === 100, {
    message: "Le quote dei produttori devono fare 100.",
    path: ["producers"],
  })
  .refine((b) => new Set(b.producers.map((p) => p.slug)).size === b.producers.length, {
    message: "Ogni produttore una volta sola.",
    path: ["producers"],
  })
  .refine((b) => b.status !== "PUBLISHED" || (b.files.preview && b.files.mp3 && b.files.wav && b.peaks.length >= 16), {
    message: "Per pubblicare servono anteprima, master MP3 e master WAV.",
    path: ["files"],
  });

export type BeatInput = z.infer<typeof beatInputSchema>;

/** Riga dell'elenco beat in Gestione (tutti gli stati, con le chiavi dei file). */
export interface StaffBeat {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  bpm: number;
  keyRoot: number;
  keyMode: "MAJOR" | "MINOR";
  durationSec: number;
  peaks: number[];
  genres: string[];
  typeTags: string[];
  moods: string[];
  producers: Array<{ slug: string; name: string; role: "MAIN" | "CO_PRODUCER"; splitPct: number; accentColor: string | null }>;
  releasedAt: string;
  exclusiveAvailable: boolean;
  files: BeatInput["files"];
  playCount: number;
  licenseCount: number;
  updatedAt: string;
}

/** Stato visibile al pubblico: una bozza, un beat già fuori o un'uscita programmata. */
export function beatVisibility(beat: Pick<StaffBeat, "status" | "releasedAt">, now = new Date()): "draft" | "live" | "scheduled" | "archived" {
  if (beat.status === "DRAFT") return "draft";
  if (beat.status === "ARCHIVED") return "archived";
  return new Date(beat.releasedAt).getTime() > now.getTime() ? "scheduled" : "live";
}

/* ------------------------------------------------------------------ */
/* Kit e preset                                                        */
/* ------------------------------------------------------------------ */

export const productInputSchema = z
  .object({
    kind: z.enum(["LOOP_KIT", "DRUM_KIT", "SAMPLE_PACK", "VOCAL_PRESET"]),
    title: z.string().trim().min(1, "Serve un titolo.").max(80),
    description: z.string().trim().min(1, "Scrivi due righe di descrizione.").max(600),
    contents: z.array(z.string().trim().min(1).max(60)).max(8, "Al massimo 8 righe di contenuto."),
    producerSlug: z.string().max(40).nullable(),
    priceCents: z.number().int().min(0).max(100_000),
    credits: z.number().int().min(0).max(1000),
    coverColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    published: z.boolean(),
    files: z.object({ zip: objectKey("products/"), preview: objectKey("products/").nullable() }),
  })
  .refine((p) => !p.published || p.files.zip, { message: "Per pubblicare serve l'archivio ZIP.", path: ["files"] })
  .refine((p) => !p.published || p.priceCents > 0 || p.credits > 0, { message: "Metti un prezzo in euro o in crediti.", path: ["priceCents"] });

export type ProductInput = z.infer<typeof productInputSchema>;

export interface StaffProduct {
  id: string;
  slug: string;
  kind: ProductInput["kind"];
  title: string;
  description: string;
  contents: string[];
  producerSlug: string | null;
  priceCents: number;
  credits: number;
  coverColor: string;
  published: boolean;
  files: ProductInput["files"];
  purchaseCount: number;
}

/* ------------------------------------------------------------------ */
/* Profilo producer                                                    */
/* ------------------------------------------------------------------ */

export const producerInputSchema = z.object({
  name: z.string().trim().min(2).max(32),
  bio: z.string().trim().max(400),
  instagram: z
    .string()
    .trim()
    .max(30)
    .regex(/^[a-z0-9._]*$/i, "Solo il nome utente di Instagram, senza @."),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export type ProducerInput = z.infer<typeof producerInputSchema>;

/** Licenza con gli stems da mandare in chat (o già mandati). */
export interface StemRequest {
  licenseId: string;
  code: string;
  licenseName: string;
  beatTitle: string;
  buyer: { name: string; email: string | null };
  createdAt: string;
  sentAt: string | null;
}

export interface StaffProducer extends ProducerInput {
  slug: string;
  linked: boolean;
}

/* ------------------------------------------------------------------ */
/* Utilità                                                             */
/* ------------------------------------------------------------------ */

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "beat"
  );
}

/** Quote uguali tra i produttori; l'arrotondamento va al primo, così il totale fa sempre 100. */
export function evenSplits(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  return Array.from({ length: count }, (_, i) => (i === 0 ? 100 - base * (count - 1) : base));
}

/** BPM e tonalità dal nome del file, se ci sono ("Level 0 140bpm Cmin.wav"). */
export function guessFromFilename(name: string): { bpm?: number; keyRoot?: number; keyMode?: "MAJOR" | "MINOR" } {
  const base = name.replace(/\.[a-z0-9]+$/i, "");
  const bpm = /(?:^|[^0-9])(\d{2,3})\s?bpm/i.exec(base)?.[1];
  const key = /(?:^|[\s_\-(])([A-G])([#b]?)\s?(maj|major|min|minor|m)?(?=$|[\s_\-)])/.exec(base);
  const result: { bpm?: number; keyRoot?: number; keyMode?: "MAJOR" | "MINOR" } = {};
  if (bpm && Number(bpm) >= 40 && Number(bpm) <= 250) result.bpm = Number(bpm);
  if (key && key[3]) {
    const roots: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const root = (roots[key[1]] + (key[2] === "#" ? 1 : key[2] === "b" ? -1 : 0) + 12) % 12;
    result.keyRoot = root;
    result.keyMode = key[3].toLowerCase().startsWith("maj") ? "MAJOR" : "MINOR";
  }
  return result;
}

export const contentTypeFor = (slot: UploadSlot) => CONTENT_TYPES[UPLOAD_SLOTS[slot].format];
