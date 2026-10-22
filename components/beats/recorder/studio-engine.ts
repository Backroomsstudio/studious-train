"use client";

import { audibleTracks, trackBuffer } from "@/lib/beats/audio/render";
import type { StudioTrack, TakeData, TrackId } from "@/lib/beats/audio/studio-project";
import { voxChain, type LiveChain, type VoxMix } from "@/lib/beats/audio/vocal-chain";
import type { VoxFx } from "@/lib/beats/audio/vocal-presets";

/**
 * Motore audio dello studio (fuori da React): un AudioContext condiviso, il beat e le voci con la
 * loro catena dal vivo, metronomo e conto alla rovescia, registrazione dal microfono con
 * ScriptProcessor e compensazione della latenza.
 */

/** Dimensione del blocco di cattura: entra nel calcolo della latenza. */
const BUFFER_SIZE = 4096;

export interface StartOptions {
  from: number;
  seconds: number;
  bpm: number;
  beat: AudioBuffer;
  tracks: StudioTrack[];
  volume: number;
  /** Se presente, registra sulla traccia indicata (che non viene riprodotta). */
  record?: { index: number; countIn: boolean; metro: boolean; mic: MediaStream };
  onEnd: () => void;
}

export class StudioEngine {
  private ctx: AudioContext | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private live = new Map<TrackId, LiveChain>();
  private raf = 0;
  private proc: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private chunks: Array<{ t: number; d: Float32Array }> = [];
  private recording = false;
  /** Punto della timeline da cui parte la take in registrazione. */
  private recStart = 0;
  get recordedFrom() {
    return this.recStart;
  }
  private onEnd: (() => void) | null = null;
  t0 = 0;
  from = 0;
  seconds = 0;
  bpm = 120;
  level = 0;
  running = false;

  context(): AudioContext {
    this.ctx ??= new AudioContext({ latencyHint: "interactive" });
    return this.ctx;
  }

  /** Posizione corrente sulla timeline (s). */
  position(): number {
    if (!this.running || !this.ctx) return this.from;
    return this.from + Math.max(0, this.ctx.currentTime - this.t0);
  }

  /** Secondi che mancano alla fine del conto alla rovescia (0 = si registra). */
  countLeft(): number {
    return this.running && this.ctx ? Math.max(0, this.t0 - this.ctx.currentTime) : 0;
  }

  isRecording() {
    return this.recording;
  }

  async getMic(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error("getUserMedia non disponibile"), { name: "NotSupportedError" });
    }
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  }

  private click(at: number, accent: boolean) {
    const ctx = this.context();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 1100;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.35, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(at);
    o.stop(at + 0.08);
    this.sources.push(o);
  }

  async start(opts: StartOptions): Promise<void> {
    const ctx = this.context();
    if (ctx.state === "suspended") await ctx.resume();
    this.halt();
    const { bpm, seconds, record } = opts;
    const bar = (60 / bpm) * 4;
    const lead = record?.countIn ? bar : 0;
    const from = Math.max(0, Math.min(opts.from, seconds - 0.5));
    const t0 = ctx.currentTime + 0.1 + lead;
    this.t0 = t0;
    this.from = from;
    this.seconds = seconds;
    this.bpm = bpm;
    this.onEnd = opts.onEnd;

    if (record && lead) for (let i = 0; i < 4; i++) this.click(ctx.currentTime + 0.1 + (i * bar) / 4, i === 0);

    const out = ctx.createGain();
    out.gain.value = opts.volume;
    out.connect(ctx.destination);
    const bs = ctx.createBufferSource();
    bs.buffer = opts.beat;
    bs.connect(out);
    bs.start(t0, from);
    this.sources.push(bs);

    const audible = new Set(audibleTracks(opts.tracks));
    opts.tracks.forEach((t, i) => {
      if (!audible.has(t) || !t.take) return;
      if (record && i === record.index) return;
      const end = t.take.start + t.take.data.length / t.take.sr;
      if (end <= from) return;
      const buf = trackBuffer(ctx, t);
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const chain = voxChain(ctx, t.fx, { vol: t.vol, pan: t.pan }, out, bpm);
      src.connect(chain.input);
      this.live.set(t.id, chain);
      src.start(t0 + Math.max(0, t.take.start - from), Math.max(0, from - t.take.start));
      this.sources.push(src);
    });

    if (record?.metro) {
      const step = bar / 4;
      for (let k = Math.ceil(from / step); k * step < seconds; k++) this.click(t0 + k * step - from, k % 4 === 0);
    }

    if (record) {
      this.chunks = [];
      this.recording = true;
      this.recStart = from;
      this.micSource = ctx.createMediaStreamSource(record.mic);
      const proc = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      const silent = ctx.createGain();
      silent.gain.value = 0;
      this.micSource.connect(proc);
      proc.connect(silent);
      silent.connect(ctx.destination);
      proc.onaudioprocess = (e) => {
        const d = e.inputBuffer.getChannelData(0);
        let q = 0;
        for (let i = 0; i < d.length; i += 8) q += d[i] * d[i];
        this.level = Math.sqrt(q / (d.length / 8));
        if (e.playbackTime >= this.t0 - 0.02) this.chunks.push({ t: e.playbackTime, d: new Float32Array(d) });
      };
      this.proc = proc;
    }

    this.running = true;
    const loop = () => {
      if (!this.running) return;
      if (this.position() >= seconds - 0.05) {
        this.onEnd?.();
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Aggiorna dal vivo catena, volume e panorama. Ritorna false se serve ripartire (ping-pong cambiato). */
  updateLive(id: TrackId, fx: VoxFx, mix: VoxMix): boolean {
    const chain = this.live.get(id);
    if (!chain) return true;
    if (chain.pingPong !== fx.dly.pp) return false;
    chain.update(fx, mix);
    return true;
  }

  hasLive(id: TrackId) {
    return this.live.has(id);
  }

  private halt() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* già fermata */
      }
    }
    this.sources = [];
    this.live.clear();
    cancelAnimationFrame(this.raf);
    this.running = false;
  }

  /**
   * Ferma tutto. Se stava registrando ritorna la take, già riallineata:
   * latenza = baseLatency + outputLatency + blocco di cattura + "Sincronizza la voce".
   */
  stop(syncMs: number): TakeData | null {
    const pos = this.position();
    this.halt();
    this.from = pos;
    this.level = 0;
    let take: TakeData | null = null;
    if (this.proc) {
      this.proc.onaudioprocess = null;
      this.proc.disconnect();
      this.proc = null;
      this.micSource?.disconnect();
      this.micSource = null;
      if (this.recording) take = this.finalize(syncMs);
    }
    this.recording = false;
    return take;
  }

  private finalize(syncMs: number): TakeData | null {
    const ctx = this.ctx;
    const ch = this.chunks;
    this.chunks = [];
    if (!ctx || !ch.length) return null;
    const sr = ctx.sampleRate;
    const total = ch.reduce((a, c) => a + c.d.length, 0);
    const data = new Float32Array(total);
    let o = 0;
    for (const c of ch) {
      data.set(c.d, o);
      o += c.d.length;
    }
    const lat = (ctx.baseLatency || 0.01) + (ctx.outputLatency || 0) + BUFFER_SIZE / sr + syncMs / 1000;
    let start = this.recStart + (ch[0].t - this.t0) - lat;
    let skip = 0;
    if (start < 0) {
      skip = Math.floor(-start * sr);
      start = 0;
    }
    if (skip >= data.length) return null;
    return { data: data.slice(skip), sr, start, sync: syncMs };
  }

  setPosition(pos: number) {
    if (!this.running) this.from = pos;
  }

  dispose() {
    this.stop(0);
  }
}

let engine: StudioEngine | null = null;

export function getStudioEngine(): StudioEngine {
  engine ??= new StudioEngine();
  return engine;
}
