/**
 * Voce dimostrativa "cantata" un po' stonata (dente di sega + formanti + vibrato), nella tonalità
 * e al BPM del beat: serve a sentire subito autotune e catena anche senza microfono.
 * Usa OfflineAudioContext, quindi gira solo nel browser.
 */
import { seededRandom } from "../demo-data";
import type { MusicalKey } from "../music";
import { SCALE } from "./pitch";

/** Melodia in gradi della scala (null = pausa), un movimento ciascuno. */
const MELODY: Array<number | null> = [0, 0, 2, 4, 4, 2, 1, 0, null, 4, 5, 4, 2, 1, 0, null, 2, 4, 5, 7, 5, 4, 2, null, 4, 2, 1, 0, 0, null, null, null];

export async function demoVoice(key: MusicalKey, bpm: number, beatSeconds: number): Promise<{ data: Float32Array; sr: number }> {
  const sr = 44100;
  const bt = 60 / bpm;
  const seconds = Math.max(2, Math.min(beatSeconds - bt * 4, bt * 36));
  const ac = new OfflineAudioContext(1, Math.ceil(sr * seconds), sr);
  const o = ac.createOscillator();
  const env = ac.createGain();
  const lfo = ac.createOscillator();
  const lg = ac.createGain();
  o.type = "sawtooth";
  lfo.frequency.value = 5.4;
  lg.gain.value = 9;
  lfo.connect(lg);
  lg.connect(o.detune);
  env.gain.value = 0;

  const sc = SCALE[key.mode];
  const base = (key.root < 5 ? 57 : 45) + key.root;
  const r = seededRandom(99 + key.root);
  MELODY.forEach((deg, i) => {
    const at = i * bt;
    if (at >= seconds) return;
    if (deg === null) {
      env.gain.setTargetAtTime(0, at, 0.02);
      return;
    }
    // Ogni nota parte calante/crescente e resta un po' fuori (± mezzo semitono)
    const midi = base + sc[deg % 7] + 12 * Math.floor(deg / 7) + (r() - 0.5) * 0.9;
    const f = 440 * 2 ** ((midi - 69) / 12);
    o.frequency.setValueAtTime(f * 2 ** (((r() - 0.5) * 0.7) / 12), at);
    o.frequency.exponentialRampToValueAtTime(f, at + 0.09);
    env.gain.setTargetAtTime(0.0001, at, 0.01);
    env.gain.setTargetAtTime(0.5, at + 0.015, 0.03);
    env.gain.setTargetAtTime(0.32, at + bt * 0.7, 0.05);
  });

  // Formanti di una "a" aperta
  const mix = ac.createGain();
  for (const [f, q, g] of [
    [720, 6, 1],
    [1180, 8, 0.5],
    [2650, 10, 0.22],
  ]) {
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    bp.Q.value = q;
    const gg = ac.createGain();
    gg.gain.value = g;
    o.connect(bp);
    bp.connect(gg);
    gg.connect(mix);
  }
  mix.connect(env);
  env.connect(ac.destination);
  o.start();
  lfo.start();
  const out = (await ac.startRendering()).getChannelData(0);
  let pk = 0;
  for (let i = 0; i < out.length; i++) pk = Math.max(pk, Math.abs(out[i]));
  const g = pk ? 0.7 / pk : 1;
  const data = new Float32Array(out.length);
  for (let i = 0; i < out.length; i++) data[i] = out[i] * g;
  return { data, sr };
}
