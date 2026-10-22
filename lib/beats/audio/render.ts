/**
 * Mixdown offline (OfflineAudioContext, 44,1 kHz stereo): la demo completa (beat + voci) o la sola
 * voce con effetti. Stessa catena dell'ascolto, poi un compressore-limiter e i picchi sotto 0,95.
 * Solo browser.
 */
import { limitPeaks } from "./wav";
import { voxChain } from "./vocal-chain";
import type { StudioTrack } from "./studio-project";

export const EXPORT_RATE = 44_100;

/** Le tracce che si sentono (mute/solo come al mixer). */
export function audibleTracks<T extends Pick<StudioTrack, "take" | "mute" | "solo">>(tracks: T[]): T[] {
  const anySolo = tracks.some((t) => t.solo && t.take);
  return tracks.filter((t) => t.take && !t.mute && (!anySolo || t.solo));
}

/** Buffer da suonare: de-esser › autotune › take grezza, il primo disponibile. */
export function playableData(t: Pick<StudioTrack, "take" | "tuned" | "proc" | "tune">): Float32Array | null {
  if (!t.take) return null;
  return t.proc ?? (t.tune !== "off" && t.tuned ? t.tuned : t.take.data);
}

export function trackBuffer(ac: BaseAudioContext, t: Pick<StudioTrack, "take" | "tuned" | "proc" | "tune">): AudioBuffer | null {
  const d = playableData(t);
  if (!d || !t.take || !d.length) return null;
  const b = ac.createBuffer(1, d.length, t.take.sr);
  b.getChannelData(0).set(d);
  return b;
}

export interface RenderedAudio {
  sampleRate: number;
  channels: Float32Array[];
}

export async function renderMix({
  beat,
  tracks,
  bpm,
  seconds,
  withBeat,
}: {
  beat: AudioBuffer | null;
  tracks: StudioTrack[];
  bpm: number;
  seconds: number;
  withBeat: boolean;
}): Promise<RenderedAudio> {
  const sr = EXPORT_RATE;
  const ac = new OfflineAudioContext(2, Math.max(1, Math.ceil(seconds * sr)), sr);
  const lim = ac.createDynamicsCompressor();
  lim.threshold.value = -3;
  lim.ratio.value = 12;
  lim.attack.value = 0.003;
  lim.release.value = 0.1;
  lim.knee.value = 2;
  const og = ac.createGain();
  og.gain.value = 0.89;
  lim.connect(og);
  og.connect(ac.destination);

  if (withBeat && beat) {
    const bs = ac.createBufferSource();
    bs.buffer = beat;
    const g = ac.createGain();
    g.gain.value = 0.85;
    bs.connect(g);
    g.connect(lim);
    bs.start(0);
  }
  for (const t of audibleTracks(tracks)) {
    const buf = trackBuffer(ac, t);
    if (!buf || !t.take) continue;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(voxChain(ac, t.fx, { vol: t.vol, pan: t.pan }, lim, bpm).input);
    src.start(t.take.start);
  }
  const out = await ac.startRendering();
  const channels = Array.from({ length: out.numberOfChannels }, (_, c) => new Float32Array(out.getChannelData(c)));
  limitPeaks(channels, 0.95);
  return { sampleRate: sr, channels };
}
