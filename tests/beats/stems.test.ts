import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_BEATS } from "../../lib/beats/demo-data";
import { renderDemoPreview, renderDemoStem } from "../../lib/beats/server/demo-audio";
import { isStemName, STEM_NAMES } from "../../lib/beats/stems";

const samples = (wav: Buffer) => new Int16Array(wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.length));

test("nomi degli stems validati", () => {
  assert.deepEqual([...STEM_NAMES], ["drums", "bass", "keys", "fx"]);
  assert.ok(isStemName("bass"));
  assert.ok(!isStemName("vocals"));
  assert.ok(!isStemName("__proto__"));
});

test("la somma dei quattro stems torna l'anteprima completa", () => {
  for (const beat of [DEMO_BEATS[0], DEMO_BEATS.find((b) => b.bpm >= 120) ?? DEMO_BEATS[1]]) {
    const full = samples(renderDemoPreview(beat));
    const stems = STEM_NAMES.map((stem) => samples(renderDemoStem(beat, stem)));
    for (const s of stems) assert.equal(s.length, full.length);
    let maxDiff = 0;
    let energy = 0;
    for (let i = 0; i < full.length; i++) {
      const sum = stems.reduce((n, s) => n + s[i], 0);
      maxDiff = Math.max(maxDiff, Math.abs(sum - full[i]));
      energy += full[i] * full[i];
    }
    // Solo l'arrotondamento a 16 bit: al massimo mezzo LSB per stem.
    assert.ok(maxDiff <= 2, `${beat.slug}: differenza massima ${maxDiff}`);
    assert.ok(energy > 0);
  }
});

test("ogni stem ha del suono e l'header WAV dell'anteprima", () => {
  const beat = DEMO_BEATS[2];
  const full = renderDemoPreview(beat);
  for (const stem of STEM_NAMES) {
    const wav = renderDemoStem(beat, stem);
    assert.deepEqual(wav.subarray(0, 44), full.subarray(0, 44));
    assert.ok(samples(wav).some((s) => Math.abs(s) > 500), `${stem} è muto`);
  }
});
