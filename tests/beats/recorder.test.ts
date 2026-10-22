import assert from "node:assert/strict";
import { test } from "node:test";
import { autotune } from "../../lib/beats/audio/autotune";
import { deess } from "../../lib/beats/audio/deess";
import { detectPitch, midiOf, peaksOf, scaleLabel, snapMidi } from "../../lib/beats/audio/pitch";
import { processVoice } from "../../lib/beats/audio/process";
import { makeTrack, readmeText, toStoredTracks, TRACK_DEFS, withPreset } from "../../lib/beats/audio/studio-project";
import {
  BK,
  DELAY_TIMES,
  formatKnob,
  KNOBS,
  MODULES,
  PRESET_GENRES,
  presetGenreOf,
  ROLES,
  signatureColor,
  type VoxFx,
} from "../../lib/beats/audio/vocal-presets";
import { DEMO_PRODUCERS } from "../../lib/beats/demo-data";

const SR = 44_100;
const A_MINOR = { root: 9, mode: "MINOR" as const };

function sine(freq: number, seconds: number, amp = 0.5, sr = SR) {
  return Float32Array.from({ length: Math.floor(seconds * sr) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / sr));
}

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function medianMidi(x: Float32Array) {
  const { f0 } = detectPitch(x, SR);
  return median([...f0].filter((f) => f > 0).map(midiOf));
}

const rms = (x: Float32Array, from = 0, to = x.length) => {
  let q = 0;
  for (let i = from; i < to; i++) q += x[i] * x[i];
  return Math.sqrt(q / Math.max(1, to - from));
};

test("YIN: un La a 220 Hz è la nota MIDI 57", () => {
  const m = medianMidi(sine(220, 1));
  assert.ok(Math.abs(m - 57) < 0.1, `trovata ${m}`);
  assert.ok(Math.abs(medianMidi(sine(440, 0.6)) - 69) < 0.1);
});

test("YIN: il silenzio non ha intonazione", () => {
  const { f0 } = detectPitch(new Float32Array(SR), SR);
  assert.ok(f0.length > 0);
  assert.ok([...f0].every((f) => f === 0));
});

test("snapMidi porta le note fuori scala sulla nota della scala più vicina", () => {
  // La minore: La Si Do Re Mi Fa Sol
  assert.equal(snapMidi(61.4, 9, "MINOR"), 62); // Do# → Re
  assert.equal(snapMidi(60.6, 9, "MINOR"), 60); // Do# basso → Do
  assert.equal(snapMidi(69.2, 9, "MINOR"), 69); // già La
  // Do maggiore: Fa# → Sol o Fa
  assert.equal(snapMidi(65.7, 0, "MAJOR"), 65);
  assert.equal(snapMidi(66.7, 0, "MAJOR"), 67);
  assert.equal(scaleLabel(A_MINOR), "La minore");
});

test("autotune Robot riporta una voce calante sulla nota giusta", () => {
  const input = sine(225, 1.2); // ~57,4: un po' crescente rispetto al La
  const before = medianMidi(input);
  const { data, curve, hopSec } = autotune(input, SR, A_MINOR, "robot", 1);
  assert.equal(data.length, input.length);
  assert.ok(curve.length > 10 && hopSec > 0);
  assert.ok(curve.some(([, sung, target]) => sung !== null && target === 57));
  const after = medianMidi(data.subarray(SR * 0.2));
  assert.ok(Math.abs(after - 57) < Math.abs(before - 57) / 3, `prima ${before}, dopo ${after}`);
});

test("de-esser: una 's' acuta si attenua molto più di un tono basso", () => {
  const low = sine(300, 0.5);
  const hiss = sine(8000, 0.5);
  const lowOut = deess(low, SR, 6500, 0.7);
  const hissOut = deess(hiss, SR, 6500, 0.7);
  const skip = Math.floor(SR * 0.1);
  const lowRatio = rms(lowOut, skip) / rms(low, skip);
  const hissRatio = rms(hissOut, skip) / rms(hiss, skip);
  assert.ok(lowRatio > 0.98, `tono basso ${lowRatio}`);
  assert.ok(hissRatio < 0.85 && hissRatio < lowRatio - 0.15, `sibilante ${hissRatio}`);
  // Una "s" forte dentro una frase bassa: le alte calano, il corpo della voce resta
  const phrase = sine(250, 1, 0.2);
  const burst = sine(9000, 0.15, 0.5);
  for (let i = 0; i < burst.length; i++) phrase[SR * 0.5 + i] += burst[i];
  const out = deess(phrase, SR, 6000, 0.8);
  const diff = (x: Float32Array) => Float32Array.from(x, (v, i) => (i ? v - x[i - 1] : 0));
  const [a, b] = [SR * 0.52, SR * 0.64];
  assert.ok(rms(diff(out), a, b) < rms(diff(phrase), a, b) * 0.9, "alte della s attenuate");
  assert.ok(Math.abs(rms(out, SR * 0.1, SR * 0.45) / rms(phrase, SR * 0.1, SR * 0.45) - 1) < 0.02, "fuori dalla s non cambia");
});

test("processVoice: niente autotune né de-esser → nessun buffer derivato", () => {
  const r = processVoice({ data: sine(220, 0.3), sr: SR, key: A_MINOR, tune: "off", amount: 0, deess: { on: false, freq: 6500, amt: 0.5 } });
  assert.equal(r.tuned, null);
  assert.equal(r.proc, null);
  const r2 = processVoice({ data: sine(220, 0.3), sr: SR, key: A_MINOR, tune: "soft", amount: 0.6, deess: { on: true, freq: 6500, amt: 0.5 } });
  assert.ok(r2.tuned && r2.proc && r2.curve);
});

test("ogni genere dei preset ha Main, Doppie e Sporche con valori dentro le manopole", () => {
  const names = new Set(DEMO_PRODUCERS.map((p) => p.name));
  assert.deepEqual(
    PRESET_GENRES.map((g) => g.slug),
    ["trap", "drill", "rnb", "pop", "afro", "synthwave"],
  );
  for (const { slug } of PRESET_GENRES) {
    for (const role of ROLES) {
      const c = BK[slug][role];
      assert.ok(c, `${slug}/${role}`);
      assert.ok(c.name && c.desc, `${slug}/${role} nome e descrizione`);
      for (const n of c.by.split("&")) assert.ok(names.has(n.trim()), `firma sconosciuta ${c.by}`);
      assert.ok(["off", "soft", "trap", "robot"].includes(c.tune));
      assert.ok(c.amount >= 0 && c.amount <= 1);
      assert.ok(c.pan >= -1 && c.pan <= 1);
      assert.ok(DELAY_TIMES.includes(c.fx.dly.time));
      for (const { id } of MODULES) {
        for (const knob of KNOBS[id]) {
          const v = (c.fx[id] as unknown as Record<string, number>)[knob.key];
          assert.equal(typeof v, "number", `${slug}/${role} ${id}.${knob.key}`);
          assert.ok(v >= knob.min && v <= knob.max, `${slug}/${role} ${id}.${knob.key}=${v} fuori da ${knob.min}..${knob.max}`);
        }
      }
    }
  }
  assert.equal(BK.trap.main.name, "Level 0 · Main");
  assert.equal(BK.synthwave.sporche.by, "Plugghe");
  assert.equal(BK.drill.doppie.fx.dly.on, false);
  assert.equal(BK.trap.sporche.fx.dly.pp, true);
});

test("firme: colore d'accento del produttore, gradiente per le collaborazioni", () => {
  assert.equal(signatureColor("Astral"), "#22C55E");
  assert.equal(signatureColor("Freya"), "#EC4899");
  assert.match(signatureColor("Freya & Astral"), /linear-gradient\(90deg, #EC4899, #22C55E\)/);
});

test("generi del catalogo → generi dei preset (i sottogeneri usano il padre)", () => {
  assert.equal(presetGenreOf([{ slug: "plugg", parent: "trap" }]), "trap");
  assert.equal(presetGenreOf([{ slug: "uk-drill", parent: "drill" }]), "drill");
  assert.equal(presetGenreOf([{ slug: "uk-drill" }]), "drill");
  assert.equal(presetGenreOf([{ slug: "rnb", parent: null }]), "rnb");
  assert.equal(presetGenreOf([{ slug: "amapiano" }]), "afro");
  assert.equal(presetGenreOf([{ slug: "lofi" }]), "trap");
  assert.equal(presetGenreOf([]), "trap");
});

test("manopole formattate all'italiana", () => {
  assert.equal(formatKnob(1200, "Hz"), "1,2 kHz");
  assert.equal(formatKnob(180, "Hz"), "180 Hz");
  assert.equal(formatKnob(-1.5, "dB"), "-1,5 dB");
  assert.equal(formatKnob(3, "dB"), "+3 dB");
  assert.equal(formatKnob(0.35, "%"), "35%");
  assert.equal(formatKnob(1.8, "s"), "1,8 s");
  assert.equal(formatKnob(2.5, ":1"), "2,5:1");
  assert.equal(formatKnob(25, "ms"), "25 ms");
});

test("tracce: preset automatico del genere, applicazione e salvataggio senza derivati", () => {
  const main = makeTrack(TRACK_DEFS[0], "rnb");
  assert.equal(main.chain?.name, "Ronzio · Main");
  assert.equal(main.auto, true);
  assert.equal(main.tune, "soft");
  const dbl = withPreset(makeTrack(TRACK_DEFS[1], "trap"), "synthwave", "doppie", false);
  assert.equal(dbl.chain?.by, "Astral");
  assert.equal(dbl.auto, false);
  assert.equal(dbl.pan, -0.6);
  // La catena è una copia: modificarla non tocca il preset
  (dbl.fx as VoxFx).eq.hp = 999;
  assert.equal(BK.synthwave.doppie.fx.eq.hp, 160);

  const withTake = { ...main, take: { data: new Float32Array(10), sr: SR, start: 1 }, tuned: new Float32Array(10), proc: new Float32Array(10) };
  const [stored] = toStoredTracks([withTake]);
  assert.ok(stored.take);
  assert.ok(!("tuned" in stored) && !("proc" in stored) && !("curve" in stored));
});

test("LEGGIMI: beat in anteprima, licenza e mix & master dello studio", () => {
  const text = readmeText({
    artist: "Kael",
    beat: { title: "Level 0", bpm: 142, key: A_MINOR, producers: [{ slug: "astral", name: "Astral", role: "MAIN", accentColor: null }] },
    date: new Date(2026, 9, 22),
  });
  assert.match(text, /Kael - Level 0 \(demo\)\.wav/);
  assert.match(text, /Voce - Level 0\.wav/);
  assert.match(text, /142 BPM · A min \(8A\)/);
  assert.match(text, /anteprima del beat/);
  assert.match(text, /licenza/);
  assert.match(text, /mix & master/);
});

test("peaksOf: forma d'onda normalizzata", () => {
  const p = peaksOf(sine(100, 0.5), 50);
  assert.equal(p.length, 50);
  assert.ok(Math.max(...p) === 1 && Math.min(...p) >= 0.04);
});
