/**
 * Sintetizzatore delle anteprime demo: un loop di 32 secondi al BPM e nella tonalità del beat
 * (kick, clap, hi-hat, 808 e accordi), con un tag sonoro ogni 4 battute che fa da watermark.
 * Lo stesso loop si può rendere a stems separati (batteria, 808, accordi, FX) per il mixer:
 * la loro somma è l'anteprima completa.
 * In produzione le anteprime sono MP3 a basso bitrate con il tag vocale dello studio,
 * generati all'upload e serviti da R2.
 */
import { seededRandom, type DemoBeat } from "../demo-data";
import { STEM_NAMES, type StemName } from "../stems";

const RATE = 22_050;
const SECONDS = 32;

type Voice = (out: Float32Array, start: number) => void;

const cache = new Map<string, Buffer>();
const stemCache = new Map<string, Record<StemName, Buffer>>();

function addTone(out: Float32Array, start: number, length: number, fn: (t: number, i: number) => number) {
  const end = Math.min(out.length, start + length);
  for (let i = Math.max(0, start); i < end; i++) out[i] += fn((i - start) / RATE, i);
}

const kick: Voice = (out, start) =>
  addTone(out, start, RATE * 0.4, (t) => {
    const freq = 45 + 85 * Math.exp(-t * 28);
    return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 7) * 0.9;
  });

function noiseVoice(seed: number, length: number, decay: number, gain: number, bright: boolean): Voice {
  const rand = seededRandom(seed);
  const noise = Float32Array.from({ length: Math.ceil(RATE * length) }, () => rand() * 2 - 1);
  return (out, start) => {
    let previous = 0;
    addTone(out, start, noise.length, (t, i) => {
      const n = noise[i - start];
      // Differenza tra campioni = filtro passa-alto grezzo per gli hi-hat.
      const sample = bright ? n - previous : n;
      previous = n;
      return sample * Math.exp(-t * decay) * gain;
    });
  };
}

function tone(freq: number, length: number, gain: number, decay: number, harmonics = 1): Voice {
  return (out, start) =>
    addTone(out, start, RATE * length, (t) => {
      let s = 0;
      for (let h = 1; h <= harmonics; h++) s += Math.sin(2 * Math.PI * freq * h * t) / (h * h);
      const attack = Math.min(1, t * 60);
      return s * attack * Math.exp(-t * decay) * gain;
    });
}

const noteFreq = (pitchClass: number, octave: number) => 16.3516 * 2 ** (octave + pitchClass / 12);

/** Guadagno che porta il picco a 0,89: gli stems usano quello del mix completo. */
function normalizeGain(samples: Float32Array): number {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  return peak > 0 ? 0.89 / peak : 1;
}

function writeWav(samples: Float32Array, gain = normalizeGain(samples)): Buffer {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(RATE, 24);
  buffer.writeUInt32LE(RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * gain)) * 32767), 44 + i * 2));
  return buffer;
}

/**
 * Suona il loop scrivendo ogni parte nella traccia del suo stem. Per l'anteprima tutte le tracce
 * sono lo stesso array: l'ordine delle somme (e quindi il file) resta identico a prima.
 */
function synthesize(beat: DemoBeat, track: (stem: StemName) => Float32Array): void {
  const beatLen = (60 / beat.bpm) * RATE;
  const bars = Math.floor((RATE * SECONDS) / (beatLen * 4));
  const minor = beat.keyMode === "MINOR";
  // Progressioni: i–VI–III–VII (minore) o I–V–vi–IV (maggiore), in semitoni dalla tonica.
  const progression = minor ? [0, 8, 3, 10] : [0, 7, 9, 5];
  const chordMinor = minor ? [true, false, false, false] : [false, false, true, false];
  const clap = noiseVoice(7, 0.25, 18, 0.45, false);
  const hat = noiseVoice(11, 0.05, 90, 0.22, true);
  const halfTime = beat.bpm >= 120;
  const drums = track("drums");

  for (let bar = 0; bar < bars; bar++) {
    const barStart = Math.round(bar * beatLen * 4);
    const degree = progression[bar % 4];
    const root = (beat.keyRoot + degree) % 12;

    // Accordo tenuto per tutta la battuta.
    const third = chordMinor[bar % 4] ? 3 : 4;
    for (const interval of [0, third, 7]) {
      tone(noteFreq((root + interval) % 12, 4 + (root + interval >= 12 ? 1 : 0)), (beatLen * 4) / RATE, 0.07, 0.6, 3)(track("keys"), barStart);
    }
    // 808 sulla tonica dell'accordo.
    tone(noteFreq(root, 1), (beatLen * 2.5) / RATE, 0.55, 1.2, 2)(track("bass"), barStart);

    for (let step = 0; step < 16; step++) {
      const at = Math.round(barStart + (step * beatLen) / 4);
      const pos = step / 4;
      const kickHere = halfTime ? step === 0 || step === 10 || (bar % 2 === 1 && step === 7) : step === 0 || step === 8 || step === 11;
      if (kickHere) kick(drums, at);
      if (halfTime ? step === 8 : pos === 1 || pos === 3) clap(drums, at);
      if (step % 2 === 0 || (halfTime && bar % 2 === 1 && step > 12)) hat(drums, at);
    }

    // Watermark: glissando acuto ogni 4 battute, impossibile da tagliare senza rovinare il loop.
    if (bar % 4 === 1) {
      addTone(track("fx"), barStart + Math.round(beatLen * 2), RATE * 0.35, (t) => {
        const freq = 1400 + 1800 * t;
        return Math.sin(2 * Math.PI * freq * t) * Math.sin(Math.PI * Math.min(1, t / 0.35)) * 0.28;
      });
    }
  }
}

export function renderDemoPreview(beat: DemoBeat): Buffer {
  const cached = cache.get(beat.id);
  if (cached) return cached;
  const out = new Float32Array(RATE * SECONDS);
  synthesize(beat, () => out);
  const wav = writeWav(out);
  cache.set(beat.id, wav);
  return wav;
}

/**
 * Uno stem dell'anteprima (WAV mono, stesso formato). I quattro stems sono normalizzati con
 * un unico guadagno, quello del mix completo, così sommati tornano l'anteprima.
 */
export function renderDemoStem(beat: DemoBeat, stem: StemName): Buffer {
  const cached = stemCache.get(beat.id);
  if (cached) return cached[stem];
  const tracks = Object.fromEntries(STEM_NAMES.map((name) => [name, new Float32Array(RATE * SECONDS)])) as Record<StemName, Float32Array>;
  synthesize(beat, (name) => tracks[name]);
  const mix = new Float32Array(RATE * SECONDS);
  for (const name of STEM_NAMES) tracks[name].forEach((s, i) => (mix[i] += s));
  const gain = normalizeGain(mix);
  const wavs = Object.fromEntries(STEM_NAMES.map((name) => [name, writeWav(tracks[name], gain)])) as Record<StemName, Buffer>;
  stemCache.set(beat.id, wavs);
  return wavs[stem];
}
