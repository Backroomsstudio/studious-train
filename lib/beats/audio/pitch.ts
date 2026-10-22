/**
 * Rilevamento dell'intonazione (YIN semplificato) e aggancio alla scala del beat.
 * Niente API del browser: gira uguale nel Web Worker dello studio e nei test in Node.
 */
import type { KeyMode, MusicalKey } from "../music";

/** Gradi della scala maggiore e minore naturale (semitoni dalla tonica). */
export const SCALE: Record<KeyMode, readonly number[]> = {
  MAJOR: [0, 2, 4, 5, 7, 9, 11],
  MINOR: [0, 2, 3, 5, 7, 8, 10],
};

const NOTE_IT = ["Do", "Do#", "Re", "Mib", "Mi", "Fa", "Fa#", "Sol", "Lab", "La", "Sib", "Si"] as const;

/** Pitch class (0-11) della scala di una tonalità. */
export function scalePitchClasses({ root, mode }: MusicalKey): number[] {
  return SCALE[mode].map((v) => (v + root) % 12);
}

/** "La minore", "Do maggiore": come la spieghiamo agli artisti. */
export function scaleLabel({ root, mode }: MusicalKey): string {
  return `${NOTE_IT[root]} ${mode === "MINOR" ? "minore" : "maggiore"}`;
}

export const midiOf = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export const hzOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export interface PitchTrack {
  /** Frequenza fondamentale per frame (0 = silenzio o suono non intonato). */
  f0: Float32Array;
  /** Campioni (alla frequenza originale) tra un frame e il successivo. */
  hop: number;
}

/**
 * YIN su segnale sottocampionato a ~11 kHz (basta per la voce: 70-900 Hz).
 * Finestra 512, passo 128, soglia 0,15 con ripiego sul minimo assoluto se < 0,3.
 */
export function detectPitch(x: Float32Array, sr: number): PitchTrack {
  const D = Math.max(1, Math.round(sr / 11025));
  const fs = sr / D;
  const n = Math.floor(x.length / D);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let a = 0;
    for (let k = 0; k < D; k++) a += x[i * D + k];
    y[i] = a / D;
  }
  const W = 512;
  const H = 128;
  const tmin = Math.floor(fs / 900);
  const tmax = Math.ceil(fs / 70);
  const frames = Math.max(0, Math.floor((n - W - tmax) / H));
  const f0 = new Float32Array(frames);
  const d = new Float32Array(tmax + 2);
  for (let f = 0; f < frames; f++) {
    const o = f * H;
    let e = 0;
    for (let i = 0; i < W; i++) e += y[o + i] * y[o + i];
    if (e / W < 2e-5) continue;
    // Differenza cumulativa normalizzata
    d[0] = 1;
    let run = 0;
    for (let t = 1; t <= tmax + 1; t++) {
      let q = 0;
      for (let i = 0; i < W; i++) {
        const v = y[o + i] - y[o + i + t];
        q += v * v;
      }
      run += q;
      d[t] = run ? (q * t) / run : 1;
    }
    let tau = -1;
    for (let t = tmin; t <= tmax; t++) {
      if (d[t] < 0.15 && d[t] <= d[t + 1]) {
        tau = t;
        break;
      }
    }
    if (tau < 0) {
      let mn = 1;
      let mt = -1;
      for (let t = tmin; t <= tmax; t++) {
        if (d[t] < mn) {
          mn = d[t];
          mt = t;
        }
      }
      if (mn < 0.3) tau = mt;
    }
    if (tau < 0) continue;
    // Interpolazione parabolica intorno al minimo
    const a = d[tau - 1];
    const b = d[tau];
    const c = d[tau + 1];
    const den = a - 2 * b + c;
    const adj = den ? (a - c) / (2 * den) : 0;
    f0[f] = fs / (tau + adj);
  }
  return { f0, hop: H * D };
}

/** La nota della scala più vicina a una nota MIDI (anche frazionaria). */
export function snapMidi(m: number, root: number, mode: KeyMode): number {
  const pcs = SCALE[mode].map((v) => (v + root) % 12);
  let best = Math.round(m);
  let bd = 99;
  for (let k = Math.floor(m) - 2; k <= Math.ceil(m) + 2; k++) {
    if (pcs.includes(((k % 12) + 12) % 12) && Math.abs(k - m) < bd) {
      bd = Math.abs(k - m);
      best = k;
    }
  }
  return best;
}

/** Forma d'onda compatta (0..1) per le corsie della timeline. */
export function peaksOf(d: Float32Array, n = 120): number[] {
  const out: number[] = [];
  const step = Math.max(1, Math.floor(d.length / n));
  let mx = 0;
  for (let i = 0; i < n; i++) {
    let p = 0;
    const end = Math.min(d.length, (i + 1) * step);
    for (let k = i * step; k < end; k += 4) p = Math.max(p, Math.abs(d[k]));
    out.push(p);
    mx = Math.max(mx, p);
  }
  return out.map((v) => Math.max(0.04, v / (mx || 1)));
}
