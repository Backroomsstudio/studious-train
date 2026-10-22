import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDb,
  isMasterPreset,
  levelStats,
  loudnessMatchGain,
  MASTER_PRESET_ORDER,
  MASTER_PRESETS,
  pushGain,
  saturationCurve,
} from "../../lib/beats/audio/master";

test("preset del master: trap, pop e club con i valori del prototipo", () => {
  assert.deepEqual(MASTER_PRESET_ORDER, ["trap", "pop", "club"]);
  assert.equal(MASTER_PRESETS.club.drive, 2.3);
  assert.equal(MASTER_PRESETS.pop.air, 4);
  assert.ok(isMasterPreset("trap"));
  assert.ok(!isMasterPreset("rock"));
});

test("levelStats: sinusoide a fondo scala = RMS -3 dB e picco 0 dB", () => {
  const sine = Float32Array.from({ length: 44_100 }, (_, i) => Math.sin((2 * Math.PI * 441 * i) / 44_100));
  const stats = levelStats([sine, sine]);
  assert.ok(Math.abs(stats.rms - -3.01) < 0.02, `rms ${stats.rms}`);
  assert.ok(Math.abs(stats.peak) < 0.01, `peak ${stats.peak}`);
});

test("levelStats: il silenzio non dà -Infinity", () => {
  const stats = levelStats([new Float32Array(100)]);
  assert.ok(Number.isFinite(stats.rms) && stats.rms < -80);
  assert.ok(Number.isFinite(stats.peak));
});

test("pushGain porta verso -12 dB ma resta tra 1× e 6×", () => {
  assert.ok(Math.abs(pushGain(-18) - 10 ** (6 / 20)) < 1e-9);
  assert.equal(pushGain(-6), 1);
  assert.equal(pushGain(-60), 6);
});

test("saturationCurve: simmetrica, passa per -1, 0 e 1", () => {
  const curve = saturationCurve(1.7, 1025);
  assert.ok(Math.abs(curve[0] + 1) < 1e-6);
  assert.ok(Math.abs(curve[512]) < 1e-6);
  assert.ok(Math.abs(curve[1024] - 1) < 1e-6);
  assert.ok(Math.abs(curve[100] + curve[924]) < 1e-6);
});

test("loudnessMatchGain riporta il dopo al volume del prima", () => {
  const gain = loudnessMatchGain({ rms: -18, peak: -3 }, { rms: -12, peak: -1 });
  assert.ok(Math.abs(20 * Math.log10(gain) + 6) < 1e-9);
});

test("formatDb usa la virgola e il segno solo se richiesto", () => {
  assert.equal(formatDb(-14.23), "-14,2");
  assert.equal(formatDb(3.36, true), "+3,4");
  assert.equal(formatDb(3.36), "3,4");
  assert.equal(formatDb(-0.04, true), "0,0");
});
