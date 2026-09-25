"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { KineticText, Reveal } from "@/components/Reveal";
import { BookingTrigger } from "@/components/BookingModal";
import { audioBus } from "@/lib/audioBus";
import { genres, tracks, type GenreId, type Track } from "@/lib/content";
import { buttonStyles, cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";

type Mode = "raw" | "master";

interface Engine {
  ctx: AudioContext;
  raw: GainNode;
  master: GainNode;
  analyser: AnalyserNode;
  freq: Uint8Array<ArrayBuffer>;
  wave: Uint8Array<ArrayBuffer>;
}

const GENRE_LABEL = Object.fromEntries(genres.map((g) => [g.id, g.label])) as Record<string, string>;
const BARS = 72;

export function AudioPlayer() {
  const [genre, setGenre] = useState<"all" | GenreId>("all");
  const [trackId, setTrackId] = useState<string>(tracks[0].id);
  const [mode, setMode] = useState<Mode>("raw");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const rawRef = useRef<HTMLAudioElement>(null);
  const masterRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const modeRef = useRef<Mode>(mode);
  const autoplayRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const track = useMemo<Track>(() => tracks.find((t) => t.id === trackId) ?? tracks[0], [trackId]);
  const filtered = useMemo(() => (genre === "all" ? tracks : tracks.filter((t) => t.genre === genre)), [genre]);

  /* ---------------- Motore Web Audio (creato al primo play) ---------------- */

  const ensureEngine = useCallback((): Engine | null => {
    if (engineRef.current) return engineRef.current;
    const raw = rawRef.current;
    const master = masterRef.current;
    if (!raw || !master) return null;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const rawGain = ctx.createGain();
      const masterGain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.78;
      ctx.createMediaElementSource(raw).connect(rawGain);
      ctx.createMediaElementSource(master).connect(masterGain);
      rawGain.connect(analyser);
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);
      rawGain.gain.value = modeRef.current === "raw" ? 1 : 0;
      masterGain.gain.value = modeRef.current === "master" ? 1 : 0;
      engineRef.current = {
        ctx,
        raw: rawGain,
        master: masterGain,
        analyser,
        freq: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)),
        wave: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
      };
      return engineRef.current;
    } catch {
      return null;
    }
  }, []);

  const applyMode = useCallback((next: Mode) => {
    modeRef.current = next;
    const engine = engineRef.current;
    const raw = rawRef.current;
    const master = masterRef.current;
    if (engine) {
      const now = engine.ctx.currentTime;
      engine.raw.gain.setTargetAtTime(next === "raw" ? 1 : 0, now, 0.025);
      engine.master.gain.setTargetAtTime(next === "master" ? 1 : 0, now, 0.025);
    } else if (raw && master) {
      raw.muted = next !== "raw";
      master.muted = next !== "master";
    }
  }, []);

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next);
      applyMode(next);
    },
    [applyMode],
  );

  const pause = useCallback(() => {
    rawRef.current?.pause();
    masterRef.current?.pause();
    setPlaying(false);
    audioBus.playing = false;
  }, []);

  const play = useCallback(async () => {
    const raw = rawRef.current;
    const master = masterRef.current;
    if (!raw || !master) return;
    const engine = ensureEngine();
    applyMode(modeRef.current);
    setLoading(true);
    try {
      if (engine && engine.ctx.state !== "running") await engine.ctx.resume();
      master.currentTime = raw.currentTime;
      await Promise.all([raw.play(), master.play()]);
      setPlaying(true);
      audioBus.playing = true;
    } catch {
      pause();
    } finally {
      setLoading(false);
    }
  }, [applyMode, ensureEngine, pause]);

  const togglePlay = useCallback(() => {
    if (playing) pause();
    else void play();
  }, [pause, play, playing]);

  const selectTrack = useCallback(
    (id: string) => {
      if (id === trackId) {
        togglePlay();
        return;
      }
      pause();
      autoplayRef.current = true;
      setTime(0);
      setDuration(0);
      setTrackId(id);
    },
    [pause, togglePlay, trackId],
  );

  const selectGenre = useCallback(
    (id: "all" | GenreId) => {
      setGenre(id);
      const list = id === "all" ? tracks : tracks.filter((t) => t.genre === id);
      if (!list.some((t) => t.id === trackId) && list[0]) {
        pause();
        autoplayRef.current = false;
        setTime(0);
        setDuration(0);
        setTrackId(list[0].id);
      }
    },
    [pause, trackId],
  );

  // Cambio traccia: ricarica i due elementi e, se richiesto, riparte in automatico
  const firstTrackRef = useRef(true);
  useEffect(() => {
    const raw = rawRef.current;
    const master = masterRef.current;
    if (!raw || !master) return;
    // al primo render non scarica nulla (preload="none"): l'audio parte solo al play
    if (firstTrackRef.current) {
      firstTrackRef.current = false;
      return;
    }
    raw.load();
    master.load();
    if (autoplayRef.current) {
      autoplayRef.current = false;
      void play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  const seek = (value: number) => {
    const raw = rawRef.current;
    const master = masterRef.current;
    if (!raw || !master) return;
    raw.currentTime = value;
    master.currentTime = value;
    setTime(value);
  };

  /* ---------------- Visualizer + sync + audio bus ---------------- */

  const draw = useCallback((live: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx2d.clearRect(0, 0, w, h);

    const engine = engineRef.current;
    const isMaster = modeRef.current === "master";
    const gap = 3 * dpr;
    const barW = (w - gap * (BARS - 1)) / BARS;
    const gradient = ctx2d.createLinearGradient(0, h, 0, 0);
    if (isMaster) {
      gradient.addColorStop(0, "#45A29E");
      gradient.addColorStop(0.55, "#FFB000");
      gradient.addColorStop(1, "#FFE3A1");
    } else {
      gradient.addColorStop(0, "rgba(197,198,199,0.25)");
      gradient.addColorStop(1, "rgba(197,198,199,0.75)");
    }
    ctx2d.fillStyle = gradient;

    let level = 0;
    if (live && engine) {
      engine.analyser.getByteFrequencyData(engine.freq);
      engine.analyser.getByteTimeDomainData(engine.wave);
      let sum = 0;
      for (let i = 0; i < engine.wave.length; i++) {
        const v = (engine.wave[i] - 128) / 128;
        sum += v * v;
      }
      level = Math.min(1, Math.sqrt(sum / engine.wave.length) * 2.6);
      const bins = engine.freq.length;
      for (let b = 0; b < BARS; b++) {
        // mappatura logaritmica delle bande
        const start = Math.floor(Math.pow(bins, b / BARS));
        const end = Math.max(start + 1, Math.floor(Math.pow(bins, (b + 1) / BARS)));
        let peak = 0;
        for (let i = start; i < end && i < bins; i++) peak = Math.max(peak, engine.freq[i]);
        const barH = Math.max(2 * dpr, (peak / 255) * h * 0.92);
        const x = b * (barW + gap);
        ctx2d.beginPath();
        ctx2d.roundRect(x, (h - barH) / 2, barW, barH, barW / 2);
        ctx2d.fill();
      }
    } else {
      for (let b = 0; b < BARS; b++) {
        const t = b / BARS;
        const env = Math.sin(Math.PI * t);
        const val = (0.18 + 0.5 * Math.abs(Math.sin(b * 0.9) * Math.cos(b * 0.37))) * env;
        const barH = Math.max(2 * dpr, val * h * (isMaster ? 0.8 : 0.45));
        ctx2d.globalAlpha = 0.55;
        ctx2d.beginPath();
        ctx2d.roundRect(b * (barW + gap), (h - barH) / 2, barW, barH, barW / 2);
        ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;
    }
    audioBus.level = level;
  }, []);

  useEffect(() => {
    if (!playing) {
      draw(false);
      return;
    }
    let lastTimeUpdate = 0;
    const loop = (now: number) => {
      const raw = rawRef.current;
      const master = masterRef.current;
      if (raw && master) {
        if (Math.abs(master.currentTime - raw.currentTime) > 0.045) master.currentTime = raw.currentTime;
        if (now - lastTimeUpdate > 120) {
          lastTimeUpdate = now;
          setTime(raw.currentTime);
        }
      }
      draw(true);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw, playing]);

  useEffect(() => {
    if (!playing) draw(false);
  }, [draw, mode, playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw(false));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(
    () => () => {
      audioBus.playing = false;
      audioBus.level = 0;
      void engineRef.current?.ctx.close();
    },
    [],
  );

  const progress = duration > 0 ? (time / duration) * 100 : 0;

  return (
    <section id="ascolta" aria-labelledby="ascolta-title" className="relative overflow-x-clip py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[40rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(69,162,158,0.12),transparent)] blur-2xl" />

      <div className="container-x">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Portfolio · Prima / Dopo</p>
            <KineticText id="ascolta-title" text="Prima grezza. *Dopo* da classifica." className="mt-5 text-[clamp(2.6rem,6vw,5.5rem)]" />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-md text-base leading-relaxed text-mist">
              Premi play e passa da <strong className="text-white">Prima</strong> a <strong className="text-white">Dopo</strong> in tempo
              reale: stessa esecuzione, sincronizzata al millisecondo. È la differenza tra una registrazione casalinga e un master
              fatto a Vicenza.
            </p>
          </Reveal>
        </div>

        {/* Filtri per genere */}
        <Reveal delay={0.1}>
          <div className="no-scrollbar -mx-5 mt-12 flex gap-3 overflow-x-auto px-5 pb-2" role="group" aria-label="Filtra per genere">
            {genres.map((g) => {
              const active = genre === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectGenre(g.id)}
                  className={cn(
                    "relative shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors duration-300",
                    active ? "border-gold text-obsidian" : "border-white/15 text-mist hover:border-white/40 hover:text-white",
                  )}
                >
                  {active && (
                    <motion.span layoutId="genre-pill" className="absolute inset-0 -z-0 rounded-full bg-gold" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                  )}
                  <span className="relative">{g.label}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          {/* Lista tracce */}
          <Reveal>
            <ul className="grid gap-3" aria-label="Tracce disponibili">
              {filtered.map((t, i) => {
                const active = t.id === trackId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selectTrack(t.id)}
                      aria-current={active ? "true" : undefined}
                      aria-label={`${active && playing ? "Metti in pausa" : "Riproduci"} ${t.title} – ${GENRE_LABEL[t.genre]}`}
                      data-cursor={active && playing ? "Pausa" : "Play"}
                      className={cn(
                        "group flex w-full items-center gap-5 rounded-2xl border p-4 text-left transition-all duration-500",
                        active ? "border-gold/60 bg-gold/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/30",
                      )}
                    >
                      <span className="font-mono text-xs text-mist">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-2xl leading-tight text-white">{t.title}</span>
                        <span className="mt-1 block font-mono text-[0.68rem] uppercase tracking-[0.2em] text-mist">
                          {GENRE_LABEL[t.genre]} · {t.bpm}
                        </span>
                      </span>
                      {active && playing ? (
                        <span className="flex h-5 items-end gap-[3px]" aria-hidden="true">
                          {[0, 1, 2, 3].map((b) => (
                            <motion.span
                              key={b}
                              className="w-[3px] rounded-full bg-gold"
                              animate={{ height: ["30%", "100%", "45%", "80%", "30%"] }}
                              transition={{ duration: 1.1, repeat: Infinity, delay: b * 0.15, ease: "easeInOut" }}
                            />
                          ))}
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                            active ? "border-gold text-gold" : "border-white/20 text-mist group-hover:border-gold group-hover:text-gold",
                          )}
                        >
                          <svg width="9" height="11" viewBox="0 0 8 10" fill="currentColor">
                            <path d="M0 0l8 5-8 5z" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Reveal>

          {/* Deck principale */}
          <Reveal delay={0.1}>
            <div className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl transition-colors duration-700",
                  mode === "master" ? "bg-gold/25" : "bg-white/5",
                )}
              />

              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-signal">{track.artist}</p>
                  <h3 className="mt-2 font-display text-4xl leading-none text-white sm:text-5xl">{track.title}</h3>
                  <p className="mt-3 text-sm text-mist">{track.notes}</p>
                </div>
                <p className="rounded-full border border-white/15 px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-mist" aria-live="polite">
                  {mode === "raw" ? "Registrazione grezza" : "Mix & Master finale"}
                </p>
              </div>

              <canvas ref={canvasRef} className="relative mt-8 h-32 w-full sm:h-40" aria-hidden="true" />

              {/* Switch A/B */}
              <div role="radiogroup" aria-label="Versione da ascoltare" className="relative mt-8 grid grid-cols-2 rounded-full border border-white/15 bg-obsidian/60 p-1.5">
                {(["raw", "master"] as const).map((m) => {
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => switchMode(m)}
                      onKeyDown={(e) => {
                        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                          e.preventDefault();
                          const next = m === "raw" ? "master" : "raw";
                          switchMode(next);
                          (e.currentTarget.parentElement?.querySelector(`[data-mode="${next}"]`) as HTMLButtonElement | null)?.focus();
                        }
                      }}
                      tabIndex={active ? 0 : -1}
                      data-mode={m}
                      className={cn(
                        "relative rounded-full px-4 py-3 text-center transition-colors duration-300",
                        active ? "text-obsidian" : "text-mist hover:text-white",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="ab-pill"
                          className={cn("absolute inset-0 rounded-full", m === "master" ? "bg-gold shadow-[0_0_30px_rgba(255,176,0,0.5)]" : "bg-mist")}
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="relative block text-sm font-bold uppercase tracking-[0.14em]">{m === "raw" ? "Prima" : "Dopo"}</span>
                      <span className="relative block text-[0.7rem] font-medium opacity-80">{m === "raw" ? "Registrazione grezza" : "Mix & Master"}</span>
                    </button>
                  );
                })}
              </div>

              {/* Trasporto */}
              <div className="relative mt-8 flex items-center gap-5">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={playing ? "Pausa" : `Riproduci ${track.title}`}
                  data-cursor={playing ? "Pausa" : "Play"}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold text-obsidian shadow-[0_0_40px_-6px_rgba(255,176,0,0.8)] transition-transform duration-300 hover:scale-105"
                >
                  {loading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-obsidian border-t-transparent" aria-hidden="true" />
                  ) : playing ? (
                    <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true">
                      <rect x="1" y="1" width="5" height="16" rx="1.5" />
                      <rect x="10" y="1" width="5" height="16" rx="1.5" />
                    </svg>
                  ) : (
                    <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true">
                      <path d="M2 1.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 2 1.5Z" />
                    </svg>
                  )}
                </button>
                <div className="flex-1">
                  <label htmlFor="seek" className="sr-only">
                    Posizione nel brano
                  </label>
                  <input
                    id="seek"
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    value={Math.min(time, duration || 0)}
                    onChange={(e) => seek(Number(e.target.value))}
                    aria-valuetext={`${formatTime(time)} di ${formatTime(duration)}`}
                    className="range-studio"
                    style={{ ["--fill" as string]: `${progress}%` }}
                  />
                  <div className="mt-2 flex justify-between font-mono text-xs text-mist">
                    <span>{formatTime(time)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>

              <div className="relative mt-8 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
                <p className="text-sm text-mist">Vuoi questo salto di qualità sul tuo brano?</p>
                <BookingTrigger className={buttonStyles.small} service="mix-master" notes={`Ho ascoltato la demo "${track.title}" e vorrei un mix & master per il mio brano.`}>
                  Richiedi Mix & Master →
                </BookingTrigger>
              </div>

              <audio
                ref={rawRef}
                src={track.raw}
                preload="none"
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => {
                  pause();
                  seek(0);
                }}
              />
              <audio ref={masterRef} src={track.master} preload="none" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
