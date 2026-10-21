/**
 * Filtri del catalogo: schema unico per URL (?q=…&producers=…), API e repository.
 * Lo stato dei filtri vive nell'URL, così una ricerca si può condividere e il tasto
 * "indietro" del browser funziona come ci si aspetta.
 */
import { z } from "zod";
import { parseKeyId } from "./music";

export const BPM_RANGE = { min: 60, max: 200 } as const;
export const PAGE_SIZE = 20;

export const SORTS = ["relevance", "new", "popular", "bpm_asc", "bpm_desc"] as const;
export type SortOrder = (typeof SORTS)[number];

const list = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[a-z0-9-]{1,48}$/.test(s))
      .slice(0, 20),
  );

const bpm = z.coerce.number().int().min(BPM_RANGE.min).max(BPM_RANGE.max).optional().catch(undefined);

export const filtersSchema = z
  .object({
    q: z.string().trim().max(80).optional().catch(undefined),
    producers: list,
    collab: z.enum(["only", "exclude"]).optional().catch(undefined),
    bpmMin: bpm,
    bpmMax: bpm,
    key: z
      .string()
      .optional()
      .transform((v) => (v && parseKeyId(v) ? v : undefined)),
    compatible: z
      .string()
      .optional()
      .transform((v) => v === "1"),
    genres: list,
    types: list,
    sort: z.enum(SORTS).optional().catch(undefined),
    page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
  })
  .transform((f) => {
    const [lo, hi] = [f.bpmMin ?? BPM_RANGE.min, f.bpmMax ?? BPM_RANGE.max].sort((a, b) => a - b);
    return {
      q: f.q || undefined,
      producers: f.producers,
      collab: f.collab,
      bpmMin: lo,
      bpmMax: hi,
      key: f.key,
      compatible: Boolean(f.key) && f.compatible,
      genres: f.genres,
      types: f.types,
      sort: f.sort ?? (f.q ? "relevance" : "new"),
      page: f.page ?? 1,
    };
  });

export type BeatFilters = z.output<typeof filtersSchema>;

export const DEFAULT_FILTERS: BeatFilters = filtersSchema.parse({});

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

export function parseFilters(params: RawParams): BeatFilters {
  const raw: Record<string, string> = {};
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => (raw[key] = value));
  } else {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") raw[key] = value;
      else if (Array.isArray(value) && value[0]) raw[key] = value[0];
    }
  }
  return filtersSchema.parse(raw);
}

/** Serializza solo ciò che differisce dai valori predefiniti (URL corti e stabili). */
export function filtersToParams(f: BeatFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.producers.length) p.set("producers", f.producers.join(","));
  if (f.collab) p.set("collab", f.collab);
  if (f.bpmMin !== BPM_RANGE.min) p.set("bpmMin", String(f.bpmMin));
  if (f.bpmMax !== BPM_RANGE.max) p.set("bpmMax", String(f.bpmMax));
  if (f.key) p.set("key", f.key);
  if (f.key && f.compatible) p.set("compatible", "1");
  if (f.genres.length) p.set("genres", f.genres.join(","));
  if (f.types.length) p.set("types", f.types.join(","));
  if (f.sort !== (f.q ? "relevance" : "new")) p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

export function activeFilterCount(f: BeatFilters): number {
  return (
    f.producers.length +
    f.genres.length +
    f.types.length +
    (f.collab ? 1 : 0) +
    (f.key ? 1 : 0) +
    (f.bpmMin !== BPM_RANGE.min || f.bpmMax !== BPM_RANGE.max ? 1 : 0)
  );
}
