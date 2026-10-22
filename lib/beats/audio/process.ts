/**
 * Passaggio offline di una take: autotune (se attivo) e poi de-esser (se attivo).
 * Funzione pura usata dal Web Worker dello studio (e, se il worker non parte, a pezzi sul main thread).
 */
import type { MusicalKey } from "../music";
import { autotune, type PitchPoint, type TuneMode } from "./autotune";
import { deess } from "./deess";

export interface ProcessInput {
  data: Float32Array;
  sr: number;
  key: MusicalKey;
  tune: TuneMode;
  amount: number;
  deess: { on: boolean; freq: number; amt: number };
}

export interface ProcessOutput {
  /** Voce intonata (null se l'autotune è spento). */
  tuned: Float32Array | null;
  /** Voce dopo il de-esser (null se il de-esser è spento). */
  proc: Float32Array | null;
  curve: PitchPoint[] | null;
  hopSec: number;
}

export function processVoice({ data, sr, key, tune, amount, deess: ds }: ProcessInput): ProcessOutput {
  let tuned: Float32Array | null = null;
  let curve: PitchPoint[] | null = null;
  let hopSec = 0;
  if (tune !== "off") {
    const r = autotune(data, sr, key, tune, amount);
    tuned = r.data;
    curve = r.curve;
    hopSec = r.hopSec;
  }
  const proc = ds.on && ds.amt > 0 ? deess(tuned ?? data, sr, ds.freq, ds.amt) : null;
  return { tuned, proc, curve, hopSec };
}
