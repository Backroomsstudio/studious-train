/**
 * Modello dello studio in app: le tre tracce (Main, Doppie, Sporche), come si applica un preset
 * Backrooms, cosa si salva di un progetto e il testo del LEGGIMI dell'export.
 * Tutto puro e serializzabile: lo stato audio "derivato" (voce intonata, de-esser, grafico)
 * si ricalcola sempre dalla take grezza e non finisce mai nell'archivio locale.
 */
import { camelotCode, keyName } from "../music";
import type { BeatSummary } from "../types";
import type { PitchPoint, TuneMode } from "./autotune";
import { BK, cloneFx, type ModId, type PresetGenre, type VocalRole, type VoxFx } from "./vocal-presets";

export type TrackId = "lead" | "dbl" | "adlib";

export interface ChainRef {
  genre: PresetGenre;
  role: VocalRole;
  name: string;
  by: string;
}

/** Impostazioni di una traccia (salvate nel progetto). */
export interface TrackSettings {
  id: TrackId;
  name: string;
  role: VocalRole;
  color: string;
  vol: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  tune: TuneMode;
  amount: number;
  fx: VoxFx;
  /** Preset Backrooms in uso (null = catena personalizzata). */
  chain: ChainRef | null;
  /** Finché l'artista non tocca nulla la traccia segue il genere del beat. */
  auto: boolean;
  autoGenre: PresetGenre;
  open: ModId;
}

/** Take grezza: campioni mono, frequenza e punto d'inizio sulla timeline (s). */
export interface TakeData {
  data: Float32Array;
  sr: number;
  start: number;
  /** Offset "Sincronizza la voce" (ms) già applicato a `start`. */
  sync?: number;
}

export interface StudioTrack extends TrackSettings {
  take: TakeData | null;
  /** Derivati (mai salvati). */
  tuned: Float32Array | null;
  proc: Float32Array | null;
  curve: PitchPoint[] | null;
  busy: boolean;
}

export const TRACK_DEFS: Array<{ id: TrackId; name: string; role: VocalRole; color: string }> = [
  { id: "lead", name: "Main", role: "main", color: "#00e5ff" },
  { id: "dbl", name: "Doppie", role: "doppie", color: "#bf5af2" },
  { id: "adlib", name: "Sporche", role: "sporche", color: "#ff9f0a" },
];

/** Applica una catena Backrooms (fx, autotune, panorama) senza toccare la take. */
export function withPreset<T extends TrackSettings>(t: T, genre: PresetGenre, role: VocalRole, auto: boolean): T {
  const c = BK[genre]?.[role] ?? BK.trap[role];
  return {
    ...t,
    fx: cloneFx(c.fx),
    tune: c.tune,
    amount: c.amount,
    pan: c.pan,
    chain: { genre, role, name: c.name, by: c.by },
    auto,
    autoGenre: genre,
  };
}

export function makeTrack(def: (typeof TRACK_DEFS)[number], genre: PresetGenre): StudioTrack {
  const base: StudioTrack = {
    ...def,
    vol: 1,
    pan: 0,
    mute: false,
    solo: false,
    tune: "off",
    amount: 0,
    fx: cloneFx(BK.trap[def.role].fx),
    chain: null,
    auto: true,
    autoGenre: genre,
    open: "eq",
    take: null,
    tuned: null,
    proc: null,
    curve: null,
    busy: false,
  };
  return withPreset(base, genre, def.role, true);
}

/** Beat salvato nel progetto: basta per riaprirlo anche offline. */
export type ProjectBeat = Pick<BeatSummary, "id" | "slug" | "title" | "bpm" | "key" | "durationSec" | "coverUrl" | "peaks" | "producers" | "genres">;

export interface StoredProject {
  id: string;
  name: string;
  beat: ProjectBeat;
  createdAt: string;
  updatedAt: string;
  /** Durata della parte registrata (s), per l'elenco "Le tue demo". */
  durationSec: number;
  sync: number;
  tracks: Array<TrackSettings & { take: TakeData | null }>;
}

export function projectBeat(b: ProjectBeat): ProjectBeat {
  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    bpm: b.bpm,
    key: b.key,
    durationSec: b.durationSec,
    coverUrl: b.coverUrl,
    peaks: b.peaks,
    producers: b.producers,
    genres: b.genres,
  };
}

/** Solo take grezze + impostazioni: niente buffer derivati. */
export function toStoredTracks(tracks: StudioTrack[]): StoredProject["tracks"] {
  return tracks.map((t) => ({
    id: t.id,
    name: t.name,
    role: t.role,
    color: t.color,
    vol: t.vol,
    pan: t.pan,
    mute: t.mute,
    solo: t.solo,
    tune: t.tune,
    amount: t.amount,
    fx: cloneFx(t.fx),
    chain: t.chain,
    auto: t.auto,
    autoGenre: t.autoGenre,
    open: t.open,
    take: t.take ? { data: t.take.data, sr: t.take.sr, start: t.take.start, sync: t.take.sync ?? 0 } : null,
  }));
}

export function fromStoredTracks(stored: StoredProject["tracks"], genre: PresetGenre): StudioTrack[] {
  return TRACK_DEFS.map((def) => {
    const s = stored.find((x) => x.id === def.id);
    const base = makeTrack(def, genre);
    return s ? { ...base, ...s, fx: cloneFx(s.fx), tuned: null, proc: null, curve: null, busy: false } : base;
  });
}

export function takesDuration(tracks: Array<{ take: TakeData | null }>): number {
  return Math.max(0, ...tracks.map((t) => (t.take ? t.take.start + t.take.data.length / t.take.sr : 0)));
}

const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

export function demoName(artist: string, beatTitle: string): string {
  return clean(`${artist} - ${beatTitle} (demo)`);
}

export function voiceStemName(beatTitle: string): string {
  return clean(`Voce - ${beatTitle}`);
}

/** Testo del LEGGIMI.txt dentro lo ZIP. */
export function readmeText({
  artist,
  beat,
  date = new Date(),
}: {
  artist: string;
  beat: Pick<BeatSummary, "title" | "bpm" | "key" | "producers">;
  date?: Date;
}): string {
  const name = demoName(artist, beat.title);
  const prod = beat.producers.map((p) => p.name).join(" & ") || "Backrooms Studio";
  return [
    name,
    "",
    `Registrata nel Backrooms Beat Store il ${date.toLocaleDateString("it-IT")}.`,
    `Beat: ${beat.title} · prod. ${prod} · ${beat.bpm} BPM · ${keyName(beat.key)} (${camelotCode(beat.key)})`,
    "",
    "Nel file:",
    `- ${name}.wav: la demo completa (beat + voce)`,
    `- ${voiceStemName(beat.title)}.wav: solo la voce con effetti, da mandare a chi ti mixa`,
    "",
    "È una demo con l'anteprima del beat: per pubblicarla serve una licenza.",
    "Sblocca il beat su backrooms.studio o mandala allo studio per il mix & master:",
    "Astral, Freya e Plugghe la fanno suonare come un pezzo vero.",
    "",
  ].join("\n");
}
