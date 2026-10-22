import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeWav, limitPeaks } from "../../lib/beats/audio/wav";
import { crc32, zipStore } from "../../lib/beats/audio/zip";

test("crc32 coincide con il valore di riferimento", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("WAV stereo: intestazione e campioni corretti", () => {
  const left = Float32Array.from([0, 1, -1, 0.5]);
  const right = Float32Array.from([0, -1, 1, -0.5]);
  const wav = encodeWav({ sampleRate: 44_100, channels: [left, right] });
  const view = new DataView(wav.buffer);
  assert.equal(new TextDecoder().decode(wav.subarray(0, 4)), "RIFF");
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44_100);
  assert.equal(view.getUint32(40, true), 16);
  assert.equal(view.getInt16(44 + 4 * 1, true), 32767);
  assert.equal(view.getInt16(44 + 4 * 1 + 2, true), -32768);
});

test("limitPeaks riporta i picchi sotto la soglia", () => {
  const data = Float32Array.from([0.2, -1.4, 0.7]);
  limitPeaks([data], 0.95);
  assert.ok(Math.abs(Math.abs(data[1]) - 0.95) < 1e-6);
});

test("ZIP store: firme, numero di file e offset della directory centrale", () => {
  const zip = zipStore([
    { name: "demo.wav", data: new Uint8Array([1, 2, 3]) },
    { name: "LEGGIMI.txt", data: new TextEncoder().encode("ciao") },
  ]);
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  const centralOffset = view.getUint32(end + 16, true);
  assert.equal(view.getUint32(centralOffset, true), 0x02014b50);
});
