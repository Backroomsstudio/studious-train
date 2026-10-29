/**
 * Preset Backrooms: le catene voce che usiamo in studio, per genere e per ruolo
 * (Main, Doppie, Sporche), firmate da Astral, Freya e Plugghe.
 * Qui vivono anche le specifiche delle manopole e la loro formattazione in italiano.
 */
import { DEMO_PRODUCERS } from "../demo-data";
import type { TuneMode } from "./autotune";

export type VocalRole = "main" | "doppie" | "sporche";
export type PresetGenre = "trap" | "drill" | "rnb" | "pop" | "afro" | "synthwave";
export type DelayTime = "1/4" | "1/8" | "1/8d" | "1/16";
export type ModId = "deess" | "eq" | "comp" | "sat" | "rev" | "dly";

export interface VoxFx {
  deess: { on: boolean; freq: number; amt: number };
  eq: { on: boolean; hp: number; low: number; mid: number; pres: number; air: number };
  comp: { on: boolean; thr: number; ratio: number; att: number; rel: number; makeup: number };
  sat: { on: boolean; drive: number; mix: number };
  rev: { on: boolean; send: number; size: number; pre: number };
  dly: { on: boolean; send: number; time: DelayTime; fb: number; pp: boolean };
}

export interface VocalChainPreset {
  name: string;
  by: string;
  desc: string;
  tune: TuneMode;
  amount: number;
  pan: number;
  fx: VoxFx;
}

export const ROLES: VocalRole[] = ["main", "doppie", "sporche"];
export const ROLE_NAME: Record<VocalRole, string> = { main: "Main", doppie: "Doppie", sporche: "Sporche" };

/** I 6 generi dei preset, nell'ordine in cui li mostriamo. */
export const PRESET_GENRES: Array<{ slug: PresetGenre; name: string }> = [
  { slug: "trap", name: "Trap" },
  { slug: "drill", name: "Drill" },
  { slug: "rnb", name: "R&B" },
  { slug: "pop", name: "Pop" },
  { slug: "afro", name: "Afro" },
  { slug: "synthwave", name: "Synthwave" },
];

type Tuple5 = [number, number, number, number, number];

/** Costruttore compatto (stesso ordine dei valori del prototipo). */
function mkCh(
  name: string,
  by: string,
  desc: string,
  tune: TuneMode,
  amount: number,
  eq: Tuple5,
  comp: Tuple5,
  sat: [number, number],
  ds: [number, number],
  rev: [number, number, number],
  dly: [number, DelayTime, number, number],
  pan: number,
): VocalChainPreset {
  return {
    name,
    by,
    desc,
    tune,
    amount,
    pan,
    fx: {
      deess: { on: ds[1] > 0, freq: ds[0], amt: ds[1] },
      eq: { on: true, hp: eq[0], low: eq[1], mid: eq[2], pres: eq[3], air: eq[4] },
      comp: { on: true, thr: comp[0], ratio: comp[1], att: comp[2], rel: comp[3], makeup: comp[4] },
      sat: { on: sat[0] > 0, drive: sat[0], mix: sat[1] },
      rev: { on: rev[0] > 0, send: rev[0], size: rev[1], pre: rev[2] },
      dly: { on: dly[0] > 0, send: dly[0], time: dly[1], fb: dly[2], pp: !!dly[3] },
    },
  };
}

export const BK: Record<PresetGenre, Record<VocalRole, VocalChainPreset>> = {
  trap: {
    main: mkCh("Level 0 · Main", "Astral", "Voce davanti, autotune trap e coda di eco", "trap", 1, [100, -1, -1.5, 3.5, 3], [-24, 4, 3, 120, 3], [0.35, 0.4], [6500, 0.55], [0.2, 1.8, 25], [0.18, "1/4", 0.32, 0], 0),
    doppie: mkCh("Level 0 · Doppie", "Astral", "Doppie larghe e robotiche, sotto la main", "robot", 1, [160, -3, -1, 2, 4], [-26, 6, 2, 90, 2], [0.2, 0.3], [6800, 0.7], [0.3, 2.2, 30], [0.12, "1/8", 0.25, 0], -0.55),
    sporche: mkCh("No-Clip · Sporche", "Plugghe", "Ad-lib al telefono, saturi, delay che rimbalza", "robot", 1, [420, -6, 3, 1, -4], [-30, 8, 1, 70, 3], [0.75, 0.8], [6000, 0.3], [0.15, 1.4, 10], [0.36, "1/8d", 0.45, 1], 0.45),
  },
  drill: {
    main: mkCh("Corridoio · Main", "Plugghe", "Secca e cattiva, autotune leggero, niente code", "soft", 0.4, [110, -2, 0, 4, 2], [-20, 5, 2, 90, 4], [0.45, 0.5], [6200, 0.5], [0.08, 1.2, 10], [0.08, "1/16", 0.2, 0], 0),
    doppie: mkCh("Corridoio · Doppie", "Plugghe", "Doppie strette e compresse che spingono le barre", "off", 0, [160, -3, 0, 3, 2.5], [-24, 6, 2, 80, 3], [0.35, 0.4], [6400, 0.6], [0.1, 1, 8], [0, "1/16", 0.15, 0], -0.45),
    sporche: mkCh("Ultimo Piano · Sporche", "Plugghe", "Ad-lib scuri e distorti, eco in ping-pong", "soft", 0.5, [300, -4, 2.5, 1, -2], [-28, 7, 1, 60, 3], [0.65, 0.7], [6000, 0.3], [0.12, 1.6, 15], [0.3, "1/8", 0.42, 1], 0.4),
  },
  rnb: {
    main: mkCh("Ronzio · Main", "Freya", "Calda e ariosa, autotune naturale, riverbero morbido", "soft", 0.5, [80, 1, -1, 2, 4.5], [-22, 3, 8, 180, 3], [0.15, 0.3], [6800, 0.6], [0.35, 2.8, 35], [0.2, "1/4", 0.38, 0], 0),
    doppie: mkCh("Ronzio · Cori", "Freya", "Cori soffici e larghi, tanta aria", "soft", 0.7, [140, -2, -1, 1.5, 5], [-24, 4, 10, 200, 2], [0.1, 0.25], [7000, 0.65], [0.45, 3.2, 40], [0.15, "1/4", 0.3, 0], -0.6),
    sporche: mkCh("Mezzanotte · Sporche", "Freya", "Sussurri e ad-lib lontani, eco in ping-pong", "soft", 0.6, [250, -3, 0, 1, 6], [-26, 4, 5, 150, 2], [0.1, 0.2], [6500, 0.5], [0.5, 3.5, 50], [0.3, "1/8d", 0.4, 1], 0.5),
  },
  pop: {
    main: mkCh("Pool Rooms · Main", "Freya", "Brillante e pulita, pronta per la radio", "soft", 0.6, [90, 0, -1, 3, 5], [-20, 3.5, 6, 150, 4], [0.2, 0.3], [6800, 0.65], [0.25, 2, 20], [0.12, "1/8", 0.28, 0], 0),
    doppie: mkCh("Pool Rooms · Doppie", "Freya", "Doppie larghe e luminose", "soft", 0.7, [150, -2, -1, 2, 5.5], [-22, 4, 6, 140, 3], [0.15, 0.25], [7000, 0.7], [0.3, 2.2, 25], [0.1, "1/8", 0.22, 0], -0.55),
    sporche: mkCh("Vetro · Chops", "Freya", "Vocal chop robotici con eco a sedicesimi", "robot", 1, [300, -4, 2, 2, 2], [-26, 6, 2, 80, 3], [0.4, 0.5], [6500, 0.4], [0.2, 1.6, 10], [0.3, "1/16", 0.3, 1], 0.4),
  },
  afro: {
    main: mkCh("Fuori Orario · Main", "Freya & Astral", "Morbida ma presente, autotune melodico", "trap", 0.8, [90, 0, -1, 3, 3.5], [-22, 4, 5, 130, 3], [0.25, 0.35], [6600, 0.55], [0.22, 1.6, 20], [0.2, "1/8d", 0.35, 0], 0),
    doppie: mkCh("Fuori Orario · Doppie", "Freya & Astral", "Doppie calde che ballano ai lati", "trap", 0.8, [150, -2, -1, 2, 4], [-24, 5, 4, 120, 2], [0.2, 0.3], [6800, 0.6], [0.28, 1.8, 25], [0.15, "1/8d", 0.3, 0], -0.5),
    sporche: mkCh("Vetro · Sporche", "Freya", "Ad-lib percussivi e saturi", "robot", 1, [350, -5, 3, 1, -1], [-28, 7, 1, 70, 3], [0.6, 0.7], [6200, 0.35], [0.15, 1.2, 10], [0.34, "1/8", 0.4, 1], 0.45),
  },
  synthwave: {
    main: mkCh("Luce Fluorescente · Main", "Astral", "Anni '80: riverbero enorme e delay lungo", "soft", 0.5, [100, -1, -1, 2.5, 4], [-20, 3, 10, 200, 3], [0.3, 0.35], [6800, 0.55], [0.4, 3.5, 40], [0.28, "1/4", 0.45, 0], 0),
    doppie: mkCh("Segnale · Doppie", "Astral", "Doppie lontane, tutte nel riverbero", "soft", 0.6, [160, -3, -1, 2, 4.5], [-24, 4, 8, 200, 2], [0.2, 0.3], [7000, 0.6], [0.55, 4.2, 50], [0.2, "1/4", 0.4, 0], -0.6),
    sporche: mkCh("Statico · Sporche", "Plugghe", "Radio rotta e delay infinito", "robot", 1, [500, -6, 3, 0, -5], [-30, 8, 1, 60, 3], [0.8, 0.85], [6000, 0.3], [0.2, 2, 15], [0.42, "1/8d", 0.55, 1], 0.5),
  },
};

export const cloneFx = (fx: VoxFx): VoxFx => JSON.parse(JSON.stringify(fx)) as VoxFx;

/** Sottogeneri e sinonimi del catalogo → uno dei 6 generi dei preset. */
const GENRE_ALIASES: Record<string, PresetGenre> = {
  plugg: "trap",
  rage: "trap",
  "hip-hop": "trap",
  hiphop: "trap",
  rap: "trap",
  "uk-drill": "drill",
  "ny-drill": "drill",
  "r-b": "rnb",
  "r-and-b": "rnb",
  soul: "rnb",
  afrobeat: "afro",
  afrobeats: "afro",
  afroswing: "afro",
  amapiano: "afro",
  dancehall: "afro",
  reggaeton: "afro",
  retrowave: "synthwave",
  "80s": "synthwave",
  electronic: "synthwave",
};

const isPresetGenre = (slug: string): slug is PresetGenre => PRESET_GENRES.some((g) => g.slug === slug);

/** Genere dei preset per un beat: si guarda il genere principale (`parent`), poi i sinonimi. Altrimenti trap. */
export function presetGenreOf(genres: ReadonlyArray<{ slug: string; parent?: string | null }>): PresetGenre {
  for (const g of genres) {
    for (const slug of [g.parent, g.slug]) {
      if (!slug) continue;
      if (isPresetGenre(slug)) return slug;
      if (GENRE_ALIASES[slug]) return GENRE_ALIASES[slug];
    }
  }
  return "trap";
}

/** Colore della firma "by …": il tono del produttore (nelle collaborazioni quello del primo). */
export function signatureColor(by: string): string {
  const first = by.split("&")[0].trim();
  return DEMO_PRODUCERS.find((p) => p.name === first)?.accentColor ?? "#8e8e95";
}

export const DELAY_TIMES: DelayTime[] = ["1/4", "1/8", "1/8d", "1/16"];
/** Durata in movimenti (1 = un quarto). */
export const DELAY_BEATS: Record<DelayTime, number> = { "1/4": 1, "1/8": 0.5, "1/8d": 0.75, "1/16": 0.25 };
export const DELAY_LABEL: Record<DelayTime, string> = { "1/4": "1/4", "1/8": "1/8", "1/8d": "1/8 puntato", "1/16": "1/16" };

const TUNE_LABEL: Record<Exclude<TuneMode, "off">, string> = { soft: "naturale", trap: "trap", robot: "robot" };

/** Pillole di riepilogo di una catena ("Autotune trap", "Riverbero 1,8 s" …). */
export function chainSummary(c: Pick<VocalChainPreset, "tune" | "fx">): string[] {
  const f = c.fx;
  const out = [c.tune === "off" ? "Senza autotune" : `Autotune ${TUNE_LABEL[c.tune]}`];
  if (f.sat.on) out.push(`Saturazione ${Math.round(f.sat.drive * 100)}%`);
  if (f.rev.on) out.push(`Riverbero ${f.rev.size.toFixed(1).replace(".", ",")} s`);
  if (f.dly.on) out.push(`Delay ${DELAY_LABEL[f.dly.time]}${f.dly.pp ? " ping-pong" : ""}`);
  return out;
}

export const MODULES: Array<{ id: ModId; label: string; title: string; info: string }> = [
  { id: "deess", label: "De-esser", title: "De-esser", info: "Attenua le “s” e le “z” che fischiano" },
  { id: "eq", label: "EQ", title: "Equalizzatore", info: "Toglie il rimbombo, aggiunge presenza e aria" },
  { id: "comp", label: "Comp", title: "Compressore", info: "Tiene la voce sempre davanti, alla stessa altezza" },
  { id: "sat", label: "Saturazione", title: "Saturazione", info: "Calore e grinta, come un nastro spinto" },
  { id: "rev", label: "Riverbero", title: "Riverbero", info: "Lo spazio intorno alla voce" },
  { id: "dly", label: "Delay", title: "Delay", info: "Le ripetizioni a tempo col BPM del beat" },
];

export type KnobUnit = "Hz" | "dB" | "ms" | "%" | "s" | ":1";

export interface KnobSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: KnobUnit;
}

const k = (key: string, label: string, min: number, max: number, step: number, unit: KnobUnit): KnobSpec => ({ key, label, min, max, step, unit });

export const KNOBS: Record<ModId, KnobSpec[]> = {
  deess: [k("freq", "Frequenza", 4000, 10000, 100, "Hz"), k("amt", "Quantità", 0, 1, 0.01, "%")],
  eq: [
    k("hp", "Taglio basso", 20, 600, 5, "Hz"),
    k("low", "Corpo (200 Hz)", -8, 8, 0.5, "dB"),
    k("mid", "Medi (1,2 kHz)", -8, 8, 0.5, "dB"),
    k("pres", "Presenza (4 kHz)", -8, 8, 0.5, "dB"),
    k("air", "Aria (10 kHz)", -8, 8, 0.5, "dB"),
  ],
  comp: [
    k("thr", "Soglia", -50, 0, 1, "dB"),
    k("ratio", "Rapporto", 1, 20, 0.5, ":1"),
    k("att", "Attacco", 1, 50, 1, "ms"),
    k("rel", "Rilascio", 30, 500, 10, "ms"),
    k("makeup", "Guadagno", 0, 12, 0.5, "dB"),
  ],
  sat: [k("drive", "Drive", 0, 1, 0.01, "%"), k("mix", "Mix", 0, 1, 0.01, "%")],
  rev: [k("send", "Mandata", 0, 1, 0.01, "%"), k("size", "Durata", 0.5, 5, 0.1, "s"), k("pre", "Pre-delay", 0, 100, 1, "ms")],
  dly: [k("send", "Mandata", 0, 1, 0.01, "%"), k("fb", "Ripetizioni", 0, 0.85, 0.01, "%")],
};

const comma = (v: number, digits?: number) => (digits === undefined ? String(Math.round(v * 100) / 100) : v.toFixed(digits)).replace(".", ",");

/** Valore di una manopola con la sua unità, alla italiana (virgola decimale). */
export function formatKnob(v: number, unit: KnobUnit): string {
  switch (unit) {
    case "%":
      return `${Math.round(v * 100)}%`;
    case "Hz":
      return v >= 1000 ? `${comma(v / 1000, 1)} kHz` : `${Math.round(v)} Hz`;
    case "s":
      return `${comma(v, 1)} s`;
    case ":1":
      return `${comma(v)}:1`;
    case "dB":
      return `${v > 0 ? "+" : ""}${comma(v)} dB`;
    case "ms":
      return `${Math.round(v)} ms`;
  }
}
