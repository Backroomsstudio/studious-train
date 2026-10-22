/**
 * Catena del master automatico, renderizzata offline nel browser (più veloce del tempo reale):
 * passa-alto → low shelf → presenza → aria → compressore "colla" → spinta → saturazione tanh → limiter,
 * poi `limitPeaks` per i picchi che il compressore del browser lascia passare.
 */
import { levelStats, MASTER_PRESETS, pushGain, saturationCurve, type LevelStats, type MasterPresetId } from "@/lib/beats/audio/master";
import { limitPeaks } from "@/lib/beats/audio/wav";

export interface MasterResult {
  buffer: AudioBuffer;
  before: LevelStats;
  after: LevelStats;
}

const channelsOf = (buffer: AudioBuffer) => Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));

export async function renderMaster(input: AudioBuffer, presetId: MasterPresetId): Promise<MasterResult> {
  const p = MASTER_PRESETS[presetId];
  const ac = new OfflineAudioContext(2, input.length, input.sampleRate);
  const before = levelStats(channelsOf(input), 4);

  const src = ac.createBufferSource();
  src.buffer = input;
  const hp = new BiquadFilterNode(ac, { type: "highpass", frequency: 28 });
  const low = new BiquadFilterNode(ac, { type: "lowshelf", frequency: p.lowF, gain: p.low });
  const presence = new BiquadFilterNode(ac, { type: "peaking", frequency: 3000, gain: p.pres, Q: 0.8 });
  const air = new BiquadFilterNode(ac, { type: "highshelf", frequency: 11_000, gain: p.air });
  const glue = new DynamicsCompressorNode(ac, { threshold: p.glue, ratio: 2.5, attack: 0.025, release: 0.25, knee: 8 });
  const push = new GainNode(ac, { gain: pushGain(before.rms) });
  const saturation = new WaveShaperNode(ac, { curve: saturationCurve(p.drive), oversample: "4x" });
  const limiter = new DynamicsCompressorNode(ac, { threshold: -1.5, ratio: 20, knee: 0, attack: 0.001, release: 0.06 });

  src.connect(hp).connect(low).connect(presence).connect(air).connect(glue).connect(push).connect(saturation).connect(limiter).connect(ac.destination);
  src.start();
  const buffer = await ac.startRendering();
  limitPeaks(channelsOf(buffer), 0.95);
  return { buffer, before, after: levelStats(channelsOf(buffer), 4) };
}
