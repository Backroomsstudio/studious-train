/**
 * Autotune offline: rileva l'intonazione, la porta sulla nota più vicina della scala del beat
 * e ricampiona la voce con un pitch shifter a doppia linea di ritardo (due letture sfasate
 * di mezzo ciclo con dissolvenza sin²). "Robot" aggancia subito, "Trap" a metà, "Naturale" piano.
 */
import type { MusicalKey } from "../music";
import { detectPitch, midiOf, snapMidi } from "./pitch";

export type TuneMode = "off" | "soft" | "trap" | "robot";

export const TUNE_MODES: Array<{ id: TuneMode; label: string }> = [
  { id: "off", label: "Off" },
  { id: "soft", label: "Naturale" },
  { id: "trap", label: "Trap" },
  { id: "robot", label: "Robot" },
];

/** Velocità di aggancio per frame (1 = istantaneo). */
export const TUNE_SPEED: Record<Exclude<TuneMode, "off">, number> = { robot: 1, trap: 0.5, soft: 0.12 };

/** Quantità predefinita quando l'artista sceglie la modalità a mano. */
export const defaultAmount = (mode: TuneMode) => (mode === "off" ? 0 : mode === "soft" ? 0.6 : 1);

/** Un punto del grafico: [frame, nota cantata, nota corretta] (null = silenzio). */
export type PitchPoint = [frame: number, sung: number | null, target: number | null];

export interface AutotuneResult {
  data: Float32Array;
  curve: PitchPoint[];
  hopSec: number;
}

export function autotune(x: Float32Array, sr: number, key: MusicalKey, mode: Exclude<TuneMode, "off">, amount: number): AutotuneResult {
  const { f0, hop } = detectPitch(x, sr);
  const alpha = TUNE_SPEED[mode] ?? 0.5;
  // Rapporto di trasposizione per frame, levigato
  const r = new Float32Array(f0.length + 1).fill(1);
  const curve: PitchPoint[] = [];
  let cur = 1;
  for (let f = 0; f < f0.length; f++) {
    if (f0[f] > 60 && f0[f] < 1100) {
      const m = midiOf(f0[f]);
      const t = snapMidi(m, key.root, key.mode);
      const target = 1 + (2 ** ((t - m) / 12) - 1) * amount;
      cur += (target - cur) * alpha;
      curve.push([f, m, t]);
    } else {
      cur += (1 - cur) * 0.2;
      curve.push([f, null, null]);
    }
    r[f] = cur;
  }
  r[f0.length] = cur;

  const out = new Float32Array(x.length);
  const W = Math.round(sr * 0.03);
  let ph = 0;
  const rd = (p: number) => {
    if (p < 0) return 0;
    const i = Math.floor(p);
    const fr = p - i;
    return x[i] * (1 - fr) + (x[i + 1] ?? 0) * fr;
  };
  for (let n = 0; n < x.length; n++) {
    const fi = n / hop;
    const i0 = Math.max(0, Math.min(r.length - 2, Math.floor(fi)));
    const ratio = r[i0] + (r[i0 + 1] - r[i0]) * Math.min(1, fi - i0);
    ph += (1 - ratio) / W;
    ph -= Math.floor(ph);
    const p2 = (ph + 0.5) % 1;
    const g1 = Math.sin(Math.PI * ph) ** 2;
    const g2 = Math.sin(Math.PI * p2) ** 2;
    out[n] = g1 * rd(n - ph * W) + g2 * rd(n - p2 * W);
  }
  return { data: out, curve, hopSec: hop / sr };
}
