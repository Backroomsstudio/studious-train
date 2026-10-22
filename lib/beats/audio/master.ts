/**
 * Parti "pure" del Master A/B (nessuna API del browser, testabili in Node): preset della catena,
 * misure di volume e picco, guadagno di spinta e curva di saturazione.
 * La catena vera (filtri, compressori, limiter) gira in un OfflineAudioContext nel browser.
 */

export type MasterPresetId = "trap" | "pop" | "club";

export interface MasterPreset {
  name: string;
  /** Low shelf: guadagno (dB) e frequenza (Hz). */
  low: number;
  lowF: number;
  /** Presenza a 3 kHz (dB). */
  pres: number;
  /** "Aria" con high shelf a 11 kHz (dB). */
  air: number;
  /** Quanto spinge la saturazione tanh. */
  drive: number;
  /** Soglia del compressore "colla" (dB). */
  glue: number;
}

export const MASTER_PRESETS: Record<MasterPresetId, MasterPreset> = {
  trap: { name: "Trap scuro", low: 3.5, lowF: 85, pres: 1, air: 2, drive: 1.7, glue: -20 },
  pop: { name: "Pop brillante", low: 1.5, lowF: 110, pres: 2.5, air: 4, drive: 1.3, glue: -18 },
  club: { name: "Club forte", low: 4.5, lowF: 65, pres: 1.5, air: 2.5, drive: 2.3, glue: -22 },
};

export const MASTER_PRESET_ORDER: MasterPresetId[] = ["trap", "pop", "club"];

export function isMasterPreset(value: unknown): value is MasterPresetId {
  return typeof value === "string" && value in MASTER_PRESETS;
}

/** Volume medio di riferimento a cui la catena prova a portare il mix (dBFS RMS). */
export const MASTER_TARGET_RMS = -12;

export interface LevelStats {
  /** Volume medio (RMS) in dBFS. */
  rms: number;
  /** Picco in dBFS. */
  peak: number;
}

const SILENCE = 1e-9;

/** RMS e picco su tutti i canali; `step` > 1 salta campioni per andare più veloce sui file lunghi. */
export function levelStats(channels: Float32Array[], step = 1): LevelStats {
  let sum = 0;
  let count = 0;
  let peak = 0;
  for (const data of channels) {
    for (let i = 0; i < data.length; i += step) {
      const s = data[i];
      sum += s * s;
      count++;
      const a = Math.abs(s);
      if (a > peak) peak = a;
    }
  }
  return { rms: 10 * Math.log10(sum / count || SILENCE), peak: 20 * Math.log10(peak || SILENCE) };
}

/** Guadagno lineare prima della saturazione: porta il mix verso il target, tra 1× e 6×. */
export function pushGain(inputRmsDb: number, target = MASTER_TARGET_RMS): number {
  return Math.max(1, Math.min(6, 10 ** ((target - inputRmsDb) / 20)));
}

/** Curva tanh normalizzata (passa per -1, 0, 1) per il WaveShaper. */
export function saturationCurve(drive: number, size = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  const norm = Math.tanh(drive);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

/** "Stesso volume": guadagno lineare che riporta il "dopo" al volume medio del "prima". */
export function loudnessMatchGain(before: LevelStats, after: LevelStats): number {
  return 10 ** ((before.rms - after.rms) / 20);
}

/** Picchi (0..1) a blocchi per disegnare la forma d'onda prima/dopo. */
export function peaksOf(data: Float32Array, count = 160): number[] {
  const size = Math.max(1, Math.floor(data.length / count));
  const peaks: number[] = [];
  for (let b = 0; b < count; b++) {
    let max = 0;
    const end = Math.min(data.length, (b + 1) * size);
    for (let i = b * size; i < end; i++) {
      const a = Math.abs(data[i]);
      if (a > max) max = a;
    }
    peaks.push(Math.min(1, max));
  }
  return peaks;
}

/** dB con la virgola italiana: -14,2 · con `sign` anche il + (+3,4). */
export function formatDb(value: number, sign = false): string {
  const rounded = Math.round(value * 10) / 10 || 0;
  const text = rounded.toFixed(1).replace(".", ",");
  return sign && rounded > 0 ? `+${text}` : text;
}
