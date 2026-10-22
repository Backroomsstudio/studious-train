/**
 * Riproduzione A/B sincronizzata: originale e master partono insieme sullo stesso istante
 * dell'AudioContext e si passa dall'uno all'altro solo coi guadagni, quindi senza buchi né salti.
 * Tutti e due passano da un analizzatore per lo spettro.
 */
export class ABPlayer {
  private sources: AudioBufferSourceNode[] = [];
  private gainA: GainNode | null = null;
  private gainB: GainNode | null = null;
  private startedAt = 0;
  private from = 0;
  analyser: AnalyserNode | null = null;
  playing = false;
  duration = 0;

  constructor(private readonly ctx: AudioContext) {}

  async play(before: AudioBuffer, after: AudioBuffer, from: number, gains: { a: number; b: number }) {
    this.stop();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const ctx = this.ctx;
    const out = new GainNode(ctx, { gain: 0.9 });
    this.analyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0.75 });
    out.connect(this.analyser).connect(ctx.destination);
    this.gainA = new GainNode(ctx, { gain: gains.a });
    this.gainB = new GainNode(ctx, { gain: gains.b });
    this.gainA.connect(out);
    this.gainB.connect(out);
    const at = ctx.currentTime + 0.05;
    for (const [buffer, gain] of [
      [before, this.gainA],
      [after, this.gainB],
    ] as const) {
      const src = new AudioBufferSourceNode(ctx, { buffer });
      src.connect(gain);
      src.start(at, from);
      this.sources.push(src);
    }
    this.startedAt = at;
    this.from = from;
    this.duration = before.duration;
    this.playing = true;
  }

  /** Cambio prima/dopo con una rampa di 10 ms (niente click). */
  setGains(gains: { a: number; b: number }) {
    const now = this.ctx.currentTime;
    this.gainA?.gain.setTargetAtTime(gains.a, now, 0.01);
    this.gainB?.gain.setTargetAtTime(gains.b, now, 0.01);
  }

  get position(): number {
    if (!this.playing) return this.from;
    return Math.min(this.duration, this.from + Math.max(0, this.ctx.currentTime - this.startedAt));
  }

  /** Ferma e ricorda dove era arrivato (o `at`, se indicato). */
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
    this.analyser?.disconnect();
    this.analyser = null;
    this.playing = false;
    this.from = pos;
  }
}
