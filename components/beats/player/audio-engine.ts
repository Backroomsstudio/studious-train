/**
 * Motore audio del player persistente.
 *
 * Due elementi <audio> fuori dal DOM React (sopravvivono alla navigazione tra le pagine):
 * - `beat`: l'anteprima in streaming (Range request → seek immediato);
 * - `vocal`: la traccia vocale di prova dell'artista, un file locale (blob) mai caricato sul server,
 *   tenuto a tempo col beat da un ciclo requestAnimationFrame che corregge la deriva.
 * Il loop A-B e la velocità (varispeed o time-stretch con `preservesPitch`) sono gestiti qui.
 */

export interface EngineSnapshot {
  position: number;
  duration: number;
  buffered: number;
  playing: boolean;
  waiting: boolean;
}

type Listener = (snapshot: EngineSnapshot) => void;
type EndedListener = () => void;

const DRIFT_TOLERANCE = 0.06;

export class AudioEngine {
  private beat: HTMLAudioElement;
  private vocal: HTMLAudioElement;
  private listeners = new Set<Listener>();
  private endedListeners = new Set<EndedListener>();
  private frame = 0;
  private loop: { start: number; end: number } | null = null;
  private vocalOffset = 0;
  private vocalEnabled = false;
  private waiting = false;

  constructor() {
    this.beat = new Audio();
    this.beat.preload = "metadata";
    this.vocal = new Audio();
    this.vocal.preload = "auto";

    const emit = () => this.emit();
    for (const event of ["loadedmetadata", "durationchange", "progress", "play", "pause", "seeked"]) {
      this.beat.addEventListener(event, emit);
    }
    this.beat.addEventListener("waiting", () => {
      this.waiting = true;
      this.vocal.pause();
      this.emit();
    });
    this.beat.addEventListener("playing", () => {
      this.waiting = false;
      this.syncVocal(true);
      this.emit();
    });
    this.beat.addEventListener("play", () => this.startTicking());
    this.beat.addEventListener("pause", () => {
      this.vocal.pause();
      this.stopTicking();
    });
    this.beat.addEventListener("ended", () => {
      this.vocal.pause();
      this.endedListeners.forEach((fn) => fn());
    });
  }

  snapshot(): EngineSnapshot {
    const b = this.beat;
    const buffered = b.buffered.length ? b.buffered.end(b.buffered.length - 1) : 0;
    return {
      position: b.currentTime,
      duration: Number.isFinite(b.duration) ? b.duration : 0,
      buffered,
      playing: !b.paused,
      waiting: this.waiting,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onEnded(listener: EndedListener): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }

  private emit() {
    const s = this.snapshot();
    this.listeners.forEach((fn) => fn(s));
  }

  async load(src: string, startAt = 0, autoplay = true): Promise<void> {
    if (!this.beat.src.endsWith(src)) {
      this.loop = null;
      this.beat.src = src;
      // Prima dei metadati alcuni browser ignorano il seek: lo si applica appena arrivano.
      if (startAt > 0) {
        this.beat.addEventListener("loadedmetadata", () => (this.beat.currentTime = startAt), { once: true });
      }
    } else if (Math.abs(this.beat.currentTime - startAt) > 0.25) {
      this.beat.currentTime = startAt;
    }
    if (autoplay) await this.play();
    else this.emit();
  }

  async play(): Promise<void> {
    try {
      await this.beat.play();
    } catch (error) {
      // Autoplay bloccato o sorgente non valida: lo stato torna "in pausa".
      if ((error as DOMException).name !== "AbortError") console.warn("[player]", error);
      this.emit();
    }
  }

  pause() {
    this.beat.pause();
  }

  seek(seconds: number) {
    const max = this.snapshot().duration || seconds;
    this.beat.currentTime = Math.max(0, Math.min(seconds, max - 0.05));
    this.syncVocal(true);
    this.emit();
  }

  setVolume(volume: number, muted: boolean) {
    this.beat.volume = volume;
    this.beat.muted = muted;
    this.vocal.muted = muted;
  }

  /** Velocità di riproduzione: con `keepPitch` la tonalità resta uguale (time-stretch del browser). */
  setRate(rate: number, keepPitch: boolean) {
    for (const el of [this.beat, this.vocal]) {
      el.playbackRate = rate;
      el.preservesPitch = keepPitch;
    }
  }

  setLoop(loop: { start: number; end: number } | null) {
    this.loop = loop && loop.end > loop.start ? loop : null;
  }

  setVocal(src: string | null, options: { volume: number; offset: number; enabled: boolean }) {
    if (src && this.vocal.src !== src) this.vocal.src = src;
    if (!src) {
      this.vocal.pause();
      this.vocal.removeAttribute("src");
      this.vocal.load();
    }
    this.vocal.volume = options.volume;
    this.vocalOffset = options.offset;
    this.vocalEnabled = Boolean(src) && options.enabled;
    if (!this.vocalEnabled) this.vocal.pause();
    else this.syncVocal(true);
  }

  private syncVocal(force: boolean) {
    if (!this.vocalEnabled) return;
    const target = this.beat.currentTime - this.vocalOffset;
    const inRange = target >= 0 && (!Number.isFinite(this.vocal.duration) || target < this.vocal.duration);
    if (!inRange || this.beat.paused || this.waiting) {
      this.vocal.pause();
      if (target < 0 && Math.abs(this.vocal.currentTime) > 0.01) this.vocal.currentTime = 0;
      return;
    }
    if (force || Math.abs(this.vocal.currentTime - target) > DRIFT_TOLERANCE) this.vocal.currentTime = target;
    if (this.vocal.paused) void this.vocal.play().catch(() => undefined);
  }

  private startTicking() {
    cancelAnimationFrame(this.frame);
    const tick = () => {
      if (this.loop && this.beat.currentTime >= this.loop.end) {
        this.beat.currentTime = this.loop.start;
        this.syncVocal(true);
      } else {
        this.syncVocal(false);
      }
      this.emit();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private stopTicking() {
    cancelAnimationFrame(this.frame);
    this.emit();
  }
}

let engine: AudioEngine | null = null;

/** Istanza unica lato client (null durante il rendering sul server). */
export function getEngine(): AudioEngine | null {
  if (typeof window === "undefined") return null;
  engine ??= new AudioEngine();
  return engine;
}

/** Picchi della forma d'onda di un file locale, calcolati con la Web Audio API. */
export async function computePeaks(file: Blob, count = 160): Promise<{ peaks: number[]; duration: number }> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new Ctx();
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    const data = audio.getChannelData(0);
    const block = Math.max(1, Math.floor(data.length / count));
    const peaks = Array.from({ length: count }, (_, i) => {
      let max = 0;
      for (let j = i * block; j < Math.min(data.length, (i + 1) * block); j += 16) max = Math.max(max, Math.abs(data[j]));
      return max;
    });
    const top = Math.max(...peaks, 0.001);
    return { peaks: peaks.map((p) => Math.round((p / top) * 100) / 100), duration: audio.duration };
  } finally {
    void context.close();
  }
}
