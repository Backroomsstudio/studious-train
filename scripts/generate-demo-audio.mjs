#!/usr/bin/env node
/**
 * Genera le demo audio "Prima / Dopo" usate dal player del portfolio.
 *
 * Per ogni genere sintetizza gli stem (batteria, basso, musica, voce), poi crea:
 *  - <genere>-raw.wav    → bilanciamento sbagliato, suono spento, rumore di fondo e ronzio, livello basso
 *  - <genere>-master.wav → bilanciamento corretto, EQ, compressione, saturazione, riverbero, loudness piena
 *
 * Sono placeholder dimostrativi: vanno sostituiti con spezzoni reali dei lavori dello studio.
 * Uso: npm run audio:demo
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 22050;
const DURATION = 10;
const N = SR * DURATION;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");

/* ----------------------------- utilità ----------------------------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const buf = () => new Float32Array(N);
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function biquad(type, freq, q = 0.707, gainDb = 0) {
  const w0 = (2 * Math.PI * freq) / SR;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case "lowpass":
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
      break;
    case "highpass":
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
      break;
    case "bandpass":
      b0 = alpha; b1 = 0; b2 = -alpha;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
      break;
    case "peak":
      b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A;
      break;
    case "highshelf": {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cos + s);
      b1 = -2 * A * (A - 1 + (A + 1) * cos);
      b2 = A * (A + 1 + (A - 1) * cos - s);
      a0 = A + 1 - (A - 1) * cos + s;
      a1 = 2 * (A - 1 - (A + 1) * cos);
      a2 = A + 1 - (A - 1) * cos - s;
      break;
    }
    case "lowshelf": {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 - (A - 1) * cos + s);
      b1 = 2 * A * (A - 1 - (A + 1) * cos);
      b2 = A * (A + 1 - (A - 1) * cos - s);
      a0 = A + 1 + (A - 1) * cos + s;
      a1 = -2 * (A - 1 + (A + 1) * cos);
      a2 = A + 1 + (A - 1) * cos - s;
      break;
    }
    default:
      throw new Error(`Filtro sconosciuto: ${type}`);
  }
  const c = [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

function applyFilter(input, ...filters) {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let s = input[i];
    for (const f of filters) s = f(s);
    out[i] = s;
  }
  return out;
}

function add(target, source, gain = 1) {
  for (let i = 0; i < target.length; i++) target[i] += source[i] * gain;
  return target;
}

function peakNormalize(input, peak) {
  let max = 0;
  for (const s of input) max = Math.max(max, Math.abs(s));
  if (max === 0) return input;
  const g = peak / max;
  for (let i = 0; i < input.length; i++) input[i] *= g;
  return input;
}

/* --------------------------- strumenti ----------------------------- */

function kick(out, t0, { f0 = 150, f1 = 45, decay = 0.35, amp = 0.9 } = {}) {
  const start = Math.floor(t0 * SR);
  const len = Math.floor(decay * 2.5 * SR);
  let phase = 0;
  for (let i = 0; i < len && start + i < N; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t * 28);
    phase += (2 * Math.PI * f) / SR;
    const env = Math.exp(-t / decay);
    const click = i < 40 ? (1 - i / 40) * 0.4 : 0;
    out[start + i] += (Math.sin(phase) * env + click) * amp;
  }
}

function sub808(out, t0, freq, dur, amp = 0.8) {
  const start = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  let phase = 0;
  for (let i = 0; i < len && start + i < N; i++) {
    const t = i / SR;
    const f = freq * (1 + 0.9 * Math.exp(-t * 40));
    phase += (2 * Math.PI * f) / SR;
    const env = Math.min(1, t * 200) * Math.exp(-t / (dur * 0.7));
    out[start + i] += Math.tanh(Math.sin(phase) * 2.2) * env * amp;
  }
}

function noiseHit(out, t0, rand, { decay = 0.05, amp = 0.3, hp = 6000, bp = 0, tone = 0, toneDecay = 0.08 } = {}) {
  const start = Math.floor(t0 * SR);
  const len = Math.floor(decay * 6 * SR);
  const f = bp ? biquad("bandpass", bp, 0.8) : biquad("highpass", hp, 0.7);
  let phase = 0;
  for (let i = 0; i < len && start + i < N; i++) {
    const t = i / SR;
    let s = f(rand() * 2 - 1) * Math.exp(-t / decay);
    if (tone) {
      phase += (2 * Math.PI * tone) / SR;
      s += Math.sin(phase) * Math.exp(-t / toneDecay) * 0.6;
    }
    out[start + i] += s * amp;
  }
}

function clap(out, t0, rand, amp = 0.35) {
  for (const d of [0, 0.011, 0.022]) noiseHit(out, t0 + d, rand, { decay: d === 0.022 ? 0.09 : 0.01, amp, bp: 1500 });
}

function synthVoice(out, t0, freq, dur, { type = "saw", amp = 0.15, attack = 0.01, release = 0.2, detune = 0.006, cutoff = 3000 } = {}) {
  const start = Math.floor(t0 * SR);
  const len = Math.floor((dur + release) * SR);
  const lp = biquad("lowpass", cutoff, 0.9);
  const phases = [0, 0.33, 0.66];
  const ratios = [1, 1 + detune, 1 - detune];
  for (let i = 0; i < len && start + i < N; i++) {
    const t = i / SR;
    let s = 0;
    for (let v = 0; v < 3; v++) {
      phases[v] = (phases[v] + (freq * ratios[v]) / SR) % 1;
      const p = phases[v];
      s += type === "saw" ? 2 * p - 1 : type === "square" ? (p < 0.5 ? 1 : -1) : Math.sin(2 * Math.PI * p);
    }
    const env = t < attack ? t / attack : t < dur ? 1 : Math.max(0, 1 - (t - dur) / release);
    out[start + i] += lp(s / 3) * env * amp;
  }
}

function bell(out, t0, freq, dur, amp = 0.12) {
  const start = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  for (let i = 0; i < len && start + i < N; i++) {
    const t = i / SR;
    const mod = Math.sin(2 * Math.PI * freq * 3.5 * t) * 2.2 * Math.exp(-t * 6);
    out[start + i] += Math.sin(2 * Math.PI * freq * t + mod) * Math.exp(-t * 3.2) * amp;
  }
}

function pluck(out, t0, freq, rand, { dur = 2.5, amp = 0.35, damping = 0.996, bright = 0.5 } = {}) {
  const start = Math.floor(t0 * SR);
  const period = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = rand() * 2 - 1;
  let idx = 0;
  let last = 0;
  const len = Math.floor(dur * SR);
  for (let i = 0; i < len && start + i < N; i++) {
    const cur = line[idx];
    const next = line[(idx + 1) % period];
    const avg = (cur * (1 - bright * 0.5) + next * (1 + bright * 0.5)) * 0.5 * damping;
    line[idx] = avg;
    idx = (idx + 1) % period;
    const s = cur * 0.7 + last * 0.3;
    last = cur;
    out[start + i] += s * amp;
  }
}

function powerChord(out, t0, root, dur, amp = 0.22) {
  const tmp = new Float32Array(Math.floor((dur + 0.05) * SR));
  for (const [ratio, g] of [[1, 1], [1.4983, 0.8], [2, 0.6]]) {
    let p = 0;
    let p2 = 0.5;
    for (let i = 0; i < tmp.length; i++) {
      p = (p + (root * ratio) / SR) % 1;
      p2 = (p2 + (root * ratio * 1.004) / SR) % 1;
      tmp[i] += ((2 * p - 1) + (2 * p2 - 1)) * 0.5 * g;
    }
  }
  const lp = biquad("lowpass", 2800, 0.8);
  const mid = biquad("peak", 800, 1, 5);
  const start = Math.floor(t0 * SR);
  for (let i = 0; i < tmp.length && start + i < N; i++) {
    const t = i / SR;
    const env = Math.min(1, t * 400) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.05)) * (0.75 + 0.25 * Math.exp(-t * 8));
    out[start + i] += lp(mid(Math.tanh(tmp[i] * 6))) * env * amp;
  }
}

const VOWELS = {
  a: [800, 1200, 2800],
  e: [480, 1850, 2600],
  i: [300, 2300, 3000],
  o: [500, 850, 2700],
  u: [330, 750, 2500],
};

function formantSpeech(out, t0, text, rand, { f0 = 118, amp = 0.5, syll = 0.17 } = {}) {
  const syllables = text.split(/[\s-]+/).filter(Boolean);
  let t = t0;
  let glottal = 0;
  syllables.forEach((word, wi) => {
    const vowel = [...word].reverse().find((c) => VOWELS[c]) ?? "a";
    const [F1, F2, F3] = VOWELS[vowel];
    const filters = [biquad("bandpass", F1, 5), biquad("bandpass", F2, 7), biquad("bandpass", F3, 9)];
    const gains = [1, 0.6, 0.25];
    const len = Math.floor(syll * SR);
    const start = Math.floor(t * SR);
    const hasConsonant = !VOWELS[word[0]];
    const sentencePos = wi / syllables.length;
    for (let i = 0; i < len && start + i < N; i++) {
      const ts = i / SR;
      const pitch = f0 * (1.12 - 0.22 * sentencePos + 0.05 * Math.sin(ts * 18));
      glottal = (glottal + pitch / SR) % 1;
      const source = (1 - glottal) * 2 - 1 + (rand() * 2 - 1) * 0.05;
      let s = 0;
      for (let k = 0; k < 3; k++) s += filters[k](source) * gains[k];
      const env = Math.sin(Math.PI * Math.min(1, ts / syll)) ** 0.6;
      let cons = 0;
      if (hasConsonant && ts < 0.035) cons = (rand() * 2 - 1) * (1 - ts / 0.035) * 0.25;
      out[start + i] += (s * env + cons) * amp;
    }
    t += syll * (word.length > 3 ? 1.25 : 1);
    if (/[.,]$/.test(word)) t += 0.35;
  });
}

function reverb(input, { mix = 0.25, size = 1, damp = 0.4 } = {}) {
  const combs = [1116, 1188, 1277, 1356].map((d) => ({
    buf: new Float32Array(Math.floor(((d * size) / 44100) * SR)),
    idx: 0,
    store: 0,
  }));
  const allpasses = [556, 441].map((d) => ({ buf: new Float32Array(Math.floor((d / 44100) * SR)), idx: 0 }));
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.idx];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.idx] = input[i] * 0.2 + c.store * 0.82;
      c.idx = (c.idx + 1) % c.buf.length;
      s += y;
    }
    for (const a of allpasses) {
      const y = a.buf[a.idx];
      a.buf[a.idx] = s + y * 0.5;
      a.idx = (a.idx + 1) % a.buf.length;
      s = y - s * 0.5;
    }
    out[i] = input[i] * (1 - mix) + s * mix;
  }
  return out;
}

/* --------------------------- arrangiamenti -------------------------- */

function trap(rand) {
  const drums = buf(), bass = buf(), music = buf();
  const beat = 60 / 140;
  const step = beat / 4;
  const bars = Math.ceil(DURATION / (beat * 4));
  const bassNotes = [midi(33), midi(33), midi(29), midi(31)];
  const melody = [69, 72, 76, 74, 72, 69, 67, 64];
  for (let bar = 0; bar < bars; bar++) {
    const b0 = bar * beat * 4;
    for (const s of [0, 7, 10]) {
      kick(drums, b0 + s * step, { f0: 140, f1: 50, decay: 0.12, amp: 0.7 });
      sub808(bass, b0 + s * step, bassNotes[bar % 4], s === 0 ? step * 7 : step * 3);
    }
    clap(drums, b0 + 8 * step, rand, 0.45);
    noiseHit(drums, b0 + 8 * step, rand, { decay: 0.12, amp: 0.25, hp: 2500, tone: 190 });
    for (let s = 0; s < 16; s += 2) noiseHit(drums, b0 + s * step, rand, { decay: 0.018, amp: 0.18 });
    if (bar % 2 === 1) for (let r = 0; r < 6; r++) noiseHit(drums, b0 + 12 * step + (r * step * 2) / 3, rand, { decay: 0.012, amp: 0.14 });
    melody.forEach((m, i) => bell(music, b0 + i * beat * 0.5, midi(m), 0.9, 0.09));
  }
  return { drums, bass, music };
}

function pop(rand) {
  const drums = buf(), bass = buf(), music = buf();
  const beat = 60 / 120;
  const chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
  const bars = Math.ceil(DURATION / (beat * 4));
  for (let bar = 0; bar < bars; bar++) {
    const b0 = bar * beat * 4;
    const chord = chords[bar % 4];
    for (let b = 0; b < 4; b++) {
      kick(drums, b0 + b * beat, { f0: 160, f1: 52, decay: 0.16, amp: 0.8 });
      if (b % 2 === 1) clap(drums, b0 + b * beat, rand, 0.4);
      noiseHit(drums, b0 + b * beat + beat / 2, rand, { decay: 0.03, amp: 0.15 });
    }
    for (const n of chord) synthVoice(music, b0, midi(n), beat * 4 - 0.05, { amp: 0.07, attack: 0.25, release: 0.4, cutoff: 2400 });
    for (let e = 0; e < 8; e++) synthVoice(bass, b0 + e * (beat / 2), midi(chord[0] - 24), beat / 2 - 0.04, { type: "square", amp: 0.16, cutoff: 500, release: 0.03 });
    for (let a = 0; a < 8; a++) pluck(music, b0 + a * (beat / 2), midi(chord[a % 3] + 12), rand, { dur: 0.6, amp: 0.12, damping: 0.99 });
  }
  return { drums, bass, music };
}

function rock(rand) {
  const drums = buf(), bass = buf(), music = buf();
  const beat = 60 / 110;
  const roots = [40, 43, 45, 36];
  const bars = Math.ceil(DURATION / (beat * 4));
  for (let bar = 0; bar < bars; bar++) {
    const b0 = bar * beat * 4;
    kick(drums, b0, { f0: 120, f1: 55, decay: 0.14, amp: 0.85 });
    kick(drums, b0 + 2 * beat, { f0: 120, f1: 55, decay: 0.14, amp: 0.85 });
    kick(drums, b0 + 2.5 * beat, { f0: 120, f1: 55, decay: 0.14, amp: 0.7 });
    for (const b of [1, 3]) noiseHit(drums, b0 + b * beat, rand, { decay: 0.14, amp: 0.45, hp: 1800, tone: 200, toneDecay: 0.06 });
    for (let e = 0; e < 8; e++) noiseHit(drums, b0 + e * (beat / 2), rand, { decay: e === 0 && bar % 2 === 0 ? 0.5 : 0.04, amp: e === 0 && bar % 2 === 0 ? 0.2 : 0.13, hp: 5000 });
    const root = midi(roots[bar % 4]);
    for (let e = 0; e < 8; e++) {
      powerChord(music, b0 + e * (beat / 2), root, beat / 2 - 0.03, 0.2);
      synthVoice(bass, b0 + e * (beat / 2), root / 2, beat / 2 - 0.03, { amp: 0.2, cutoff: 700, release: 0.02 });
    }
  }
  return { drums, bass, music };
}

function acoustic(rand) {
  const drums = buf(), bass = buf(), music = buf();
  const chords = [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [41, 53, 57, 60, 65], [48, 55, 60, 64, 67]];
  const barLen = 2.5;
  const bars = Math.ceil(DURATION / barLen);
  for (let bar = 0; bar < bars; bar++) {
    const b0 = bar * barLen;
    const chord = chords[bar % 4];
    pluck(bass, b0, midi(chord[0]), rand, { dur: 3, amp: 0.4, damping: 0.998, bright: 0.2 });
    const pattern = [1, 2, 3, 4, 3, 2, 3, 4];
    pattern.forEach((p, i) => {
      const humanize = (rand() - 0.5) * 0.02;
      pluck(music, b0 + i * (barLen / 8) + humanize, midi(chord[p]), rand, { dur: 2.2, amp: 0.3, damping: 0.997, bright: 0.6 });
    });
  }
  return { drums, bass, music };
}

function voice(rand) {
  const drums = buf(), bass = buf(), music = buf(), vox = buf();
  formantSpeech(
    vox,
    0.4,
    "ben-ve-nu-ti a vi-cen-za, do-ve il suo-no pren-de vi-ta. pre-no-ta o-ra la tu-a ses-sio-ne, in stu-dio.",
    rand,
  );
  const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  chords.forEach((c, i) => c.forEach((n) => synthVoice(music, i * 2.5, midi(n), 2.4, { type: "sine", amp: 0.06, attack: 0.6, release: 0.8 })));
  return { drums, bass, music, vox };
}

/* ---------------------------- processing --------------------------- */

function rawVersion(stems, rand, opts) {
  const mix = buf();
  add(mix, stems.drums, opts.raw.drums);
  add(mix, stems.bass, opts.raw.bass);
  add(mix, stems.music, opts.raw.music);
  if (stems.vox) add(mix, stems.vox, opts.raw.vox ?? 1);
  let out = applyFilter(mix, biquad("lowpass", opts.raw.cutoff ?? 3200, 0.7), biquad("peak", 350, 1, 4));
  if (opts.raw.room) out = reverb(out, { mix: opts.raw.room, size: 0.6, damp: 0.2 });
  peakNormalize(out, 0.32);
  let hum = 0;
  for (let i = 0; i < N; i++) {
    hum += (2 * Math.PI * 50) / SR;
    out[i] += (rand() * 2 - 1) * (opts.raw.hiss ?? 0.006) + (Math.sin(hum) + 0.5 * Math.sin(hum * 2)) * (opts.raw.hum ?? 0.004);
  }
  return out;
}

function masterVersion(stems, opts) {
  const mix = buf();
  add(mix, stems.drums, opts.master.drums);
  add(mix, stems.bass, opts.master.bass);
  add(mix, stems.music, opts.master.music);
  if (stems.vox) {
    const vox = applyFilter(stems.vox, biquad("highpass", 90, 0.7), biquad("peak", 3500, 1, 4), biquad("peak", 250, 1, -3));
    add(mix, vox, opts.master.vox ?? 1);
  }
  let out = applyFilter(
    mix,
    biquad("highpass", 28, 0.7),
    biquad("lowshelf", 90, 0.7, opts.master.lowShelf ?? 2),
    biquad("peak", 300, 0.9, -2),
    biquad("highshelf", 8000, 0.7, opts.master.air ?? 4),
  );
  if (opts.master.reverb) out = reverb(out, { mix: opts.master.reverb, size: 1.1, damp: 0.35 });
  peakNormalize(out, 0.7);

  // Compressore RMS + soft clip (glue + loudness)
  let env = 0;
  const attack = Math.exp(-1 / (0.005 * SR));
  const release = Math.exp(-1 / (0.12 * SR));
  const threshold = 0.25;
  const ratio = opts.master.ratio ?? 3.5;
  for (let i = 0; i < N; i++) {
    const x = Math.abs(out[i]);
    env = x > env ? attack * env + (1 - attack) * x : release * env + (1 - release) * x;
    const gain = env > threshold ? Math.pow(env / threshold, 1 / ratio - 1) : 1;
    out[i] *= gain;
  }
  peakNormalize(out, 1);
  const drive = opts.master.drive ?? 1.8;
  for (let i = 0; i < N; i++) out[i] = Math.tanh(out[i] * drive) / Math.tanh(drive);
  return peakNormalize(out, 0.95);
}

function fades(data) {
  const fadeIn = Math.floor(0.01 * SR);
  const fadeOut = Math.floor(0.6 * SR);
  for (let i = 0; i < fadeIn; i++) data[i] *= i / fadeIn;
  for (let i = 0; i < fadeOut; i++) data[N - 1 - i] *= i / fadeOut;
  return data;
}

function writeWav(path, data) {
  const bytes = 44 + data.length * 2;
  const b = Buffer.alloc(bytes);
  b.write("RIFF", 0);
  b.writeUInt32LE(bytes - 8, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    b.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(path, b);
}

const GENRES = {
  trap: { fn: trap, raw: { drums: 1.4, bass: 0.35, music: 1.2 }, master: { drums: 1, bass: 1, music: 0.8, lowShelf: 3 } },
  pop: { fn: pop, raw: { drums: 0.5, bass: 1.4, music: 1.3 }, master: { drums: 1, bass: 0.9, music: 1, air: 5 } },
  rock: { fn: rock, raw: { drums: 0.6, bass: 0.5, music: 1.5, room: 0.35 }, master: { drums: 1.1, bass: 1, music: 0.9, drive: 2.2 } },
  acoustic: { fn: acoustic, raw: { drums: 0, bass: 1.3, music: 0.8, cutoff: 2500 }, master: { drums: 0, bass: 0.8, music: 1, reverb: 0.32, ratio: 2, drive: 1.1 } },
  voice: {
    fn: voice,
    raw: { drums: 0, bass: 0, music: 0, vox: 1, room: 0.45, hiss: 0.012, hum: 0.008, cutoff: 5000 },
    master: { drums: 0, bass: 0, music: 0.5, vox: 1.2, ratio: 4, drive: 1.3, lowShelf: 0 },
  },
};

mkdirSync(OUT_DIR, { recursive: true });
let seed = 1337;
for (const [name, cfg] of Object.entries(GENRES)) {
  const stems = cfg.fn(mulberry32(seed++));
  writeWav(join(OUT_DIR, `${name}-raw.wav`), fades(rawVersion(stems, mulberry32(seed++), cfg)));
  writeWav(join(OUT_DIR, `${name}-master.wav`), fades(masterVersion(stems, cfg)));
  console.log(`✓ ${name}: raw + master`);
}
console.log(`Demo audio generate in ${OUT_DIR}`);
