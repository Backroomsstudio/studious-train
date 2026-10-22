import { STEM_NAMES, stemUrl, type StemName } from "@/lib/beats/stems";

/**
 * Riproduzione sincronizzata dei quattro stems: partono tutti sullo stesso istante
 * dell'AudioContext, ognuno col suo guadagno (fader, muto, solo) e un analizzatore per il meter.
 */
export type StemBuffers = Record<StemName, AudioBuffer>;

let sharedCtx: AudioContext | null = null;
export const mixerContext = () => (sharedCtx ??= new AudioContext());

const loaded = new Map<string, Promise<StemBuffers>>();

/** Scarica e decodifica i quattro stems (una volta per beat e per sessione). */
export function loadStems(beatId: string): Promise<StemBuffers> {
  let pending = loaded.get(beatId);
  if (!pending) {
    const ctx = mixerContext();
    pending = Promise.all(
      STEM_NAMES.map(async (stem) => {
        const res = await fetch(stemUrl(beatId, stem));
        if (!res.ok) throw new Error(`stem ${stem}: ${res.status}`);
        return [stem, await ctx.decodeAudioData(await res.arrayBuffer())] as const;
      }),
    ).then((entries) => Object.fromEntries(entries) as StemBuffers);
    pending.catch(() => loaded.delete(beatId));
    loaded.set(beatId, pending);
  }
  return pending;
}

export class StemPlayer {
  private sources: AudioBufferSourceNode[] = [];
  private gains: Partial<Record<StemName, GainNode>> = {};
  analysers: Partial<Record<StemName, AnalyserNode>> = {};
  private startedAt = 0;
  private from = 0;
  playing = false;
  duration = 0;

  constructor(private readonly ctx: AudioContext) {}

  async play(buffers: StemBuffers, from: number, levels: Record<StemName, number>) {
    this.stop();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const ctx = this.ctx;
    const out = new GainNode(ctx, { gain: 0.9 });
    out.connect(ctx.destination);
    const at = ctx.currentTime + 0.05;
    for (const stem of STEM_NAMES) {
      const src = new AudioBufferSourceNode(ctx, { buffer: buffers[stem] });
      const gain = new GainNode(ctx, { gain: levels[stem] });
      const analyser = new AnalyserNode(ctx, { fftSize: 512 });
      src.connect(gain).connect(analyser).connect(out);
      src.start(at, from);
      this.sources.push(src);
      this.gains[stem] = gain;
      this.analysers[stem] = analyser;
    }
    this.startedAt = at;
    this.from = from;
    this.duration = buffers.drums.duration;
    this.playing = true;
  }

  setLevels(levels: Record<StemName, number>) {
    const now = this.ctx.currentTime;
    for (const stem of STEM_NAMES) this.gains[stem]?.gain.setTargetAtTime(levels[stem], now, 0.015);
  }

  get position(): number {
    if (!this.playing) return this.from;
    return Math.min(this.duration, this.from + Math.max(0, this.ctx.currentTime - this.startedAt));
  }

  stop(at?: number) {
    const pos = at ?? this.position;
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        // già fermata
      }
      src.disconnect();
    }
    this.sources = [];
    this.gains = {};
    this.analysers = {};
    this.playing = false;
    this.from = pos;
  }
}
