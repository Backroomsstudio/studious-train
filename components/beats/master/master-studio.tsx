"use client";

import { ArrowRight, Download, FileAudio, Loader2, Mic, Music2, Pause, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/beats/format";
import { LAST_DEMO_KEY, localGet, type StoredAudio } from "@/lib/beats/audio/local-store";
import {
  formatDb,
  loudnessMatchGain,
  MASTER_PRESET_ORDER,
  MASTER_PRESETS,
  peaksOf,
  type MasterPresetId,
} from "@/lib/beats/audio/master";
import { encodeWav } from "@/lib/beats/audio/wav";
import { previewUrl, usePlayer } from "../player/player-store";
import { ChromeButton } from "../ui/chrome-button";
import { ABPlayer } from "./ab-player";
import { renderMaster, type MasterResult } from "./render-master";

export interface MasterBeatOption {
  id: string;
  title: string;
  bpm: number;
  by: string;
}

type Side = "before" | "after";
type SourceKind = "demo" | "file" | "beat";

interface Source {
  kind: SourceKind;
  name: string;
  buffer: AudioBuffer;
}

let sharedCtx: AudioContext | null = null;
const audioContext = () => (sharedCtx ??= new AudioContext());

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "demo";

/**
 * Master A/B: carica un mix (file, ultima demo dello studio o un beat del catalogo), lo masterizza
 * nel browser con un preset e lo confronta prima/dopo in riproduzione sincronizzata.
 * Nessun upload: il file non lascia il dispositivo.
 */
export function MasterStudio({ beats, autoDemo = false }: { beats: MasterBeatOption[]; autoDemo?: boolean }) {
  const [source, setSource] = useState<Source | null>(null);
  const [result, setResult] = useState<MasterResult | null>(null);
  const [preset, setPreset] = useState<MasterPresetId>("trap");
  const [side, setSide] = useState<Side>("after");
  const [match, setMatch] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoMissing, setDemoMissing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  const playerRef = useRef<ABPlayer | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const sideRef = useRef<Side>(side);
  const matchRef = useRef(match);
  const renderToken = useRef(0);

  const player = () => (playerRef.current ??= new ABPlayer(audioContext()));
  const gainsFor = useCallback(
    (s: Side, m: boolean, r: MasterResult | null) => ({
      a: s === "before" ? 1 : 0,
      b: s === "after" ? (m && r ? loudnessMatchGain(r.before, r.after) : 1) : 0,
    }),
    [],
  );

  const stop = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    p.stop();
    setPlaying(false);
    setPosition(p.position);
  }, []);

  const start = useCallback(
    async (src: Source, res: MasterResult, from: number, s: Side, m: boolean) => {
      usePlayer.getState().pause();
      await player().play(src.buffer, res.buffer, from, gainsFor(s, m, res));
      setPlaying(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- player() è stabile
    [gainsFor],
  );

  /** Masterizza `src` col preset; se stava suonando riparte dallo stesso punto. */
  const master = useCallback(
    async (src: Source, id: MasterPresetId) => {
      const token = ++renderToken.current;
      const wasPlaying = playerRef.current?.playing ?? false;
      const at = playerRef.current?.position ?? 0;
      if (wasPlaying) stop();
      setBusy("Preparo il master…");
      setError(null);
      try {
        const res = await renderMaster(src.buffer, id);
        if (token !== renderToken.current) return;
        setResult(res);
        setBusy(null);
        if (wasPlaying) await start(src, res, at, sideRef.current, matchRef.current);
      } catch {
        if (token !== renderToken.current) return;
        setBusy(null);
        setError("Non riesco a masterizzare questo file. Prova con un WAV o un MP3.");
      }
    },
    [start, stop],
  );

  const load = useCallback(
    async (kind: SourceKind, input?: File | MasterBeatOption) => {
      playerRef.current?.stop(0);
      setPlaying(false);
      setPosition(0);
      setError(null);
      setDemoMissing(false);
      setBusy(kind === "beat" ? "Carico il beat…" : "Leggo il file…");
      try {
        const ctx = audioContext();
        let next: Source;
        if (kind === "demo") {
          const stored = await localGet<StoredAudio>("renders", LAST_DEMO_KEY);
          if (!stored?.channels?.length || !stored.channels[0].length) {
            setBusy(null);
            setDemoMissing(true);
            return;
          }
          const buffer = ctx.createBuffer(stored.channels.length, stored.channels[0].length, stored.sampleRate);
          stored.channels.forEach((data, c) => buffer.getChannelData(c).set(data));
          next = { kind, name: stored.name || "La tua ultima demo", buffer };
        } else if (kind === "file" && input instanceof File) {
          const buffer = await ctx.decodeAudioData(await input.arrayBuffer());
          next = { kind, name: input.name.replace(/\.[^.]+$/, ""), buffer };
        } else if (kind === "beat" && input && !(input instanceof File)) {
          const res = await fetch(previewUrl(input.id));
          if (!res.ok) throw new Error("preview");
          const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
          next = { kind, name: `${input.title} · prod. ${input.by}`, buffer };
        } else return;
        setSource(next);
        setResult(null);
        await master(next, preset);
      } catch {
        setBusy(null);
        setError("Non riesco a leggere questo file audio. Prova con un WAV o un MP3.");
      }
    },
    [master, preset],
  );

  // /beats/master?sorgente=demo apre subito l'ultima demo dello studio.
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (!autoDemo || autoLoaded.current) return;
    autoLoaded.current = true;
    void load("demo");
  }, [autoDemo, load]);

  // Se parte il player globale, il confronto si ferma (mai due audio insieme).
  useEffect(
    () =>
      usePlayer.subscribe((s, prev) => {
        if (s.playing && !prev.playing && playerRef.current?.playing) stop();
      }),
    [stop],
  );

  // Uscendo dalla pagina si ferma tutto.
  useEffect(() => () => playerRef.current?.stop(), []);

  // Spettro, testina e tempo a 60 fps senza passare da React.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let data: Uint8Array<ArrayBuffer> | null = null;
    const loop = () => {
      const p = playerRef.current;
      if (!p?.playing) return;
      const pos = p.position;
      if (pos >= p.duration - 0.01) {
        p.stop(0);
        setPlaying(false);
        setPosition(0);
        return;
      }
      const ratio = p.duration ? pos / p.duration : 0;
      if (headRef.current) headRef.current.style.left = `${ratio * 100}%`;
      if (timeRef.current) timeRef.current.textContent = formatTime(pos);
      const cvs = canvasRef.current;
      if (cvs && p.analyser) {
        const g = cvs.getContext("2d");
        const W = (cvs.width = cvs.clientWidth * devicePixelRatio);
        const H = (cvs.height = cvs.clientHeight * devicePixelRatio);
        data ??= new Uint8Array(p.analyser.frequencyBinCount);
        p.analyser.getByteFrequencyData(data);
        if (g) {
          g.clearRect(0, 0, W, H);
          const n = 64;
          const bw = W / n;
          const after = sideRef.current === "after";
          const grd = g.createLinearGradient(0, H, 0, 0);
          grd.addColorStop(0, after ? "#0066ff" : "#8c95a3");
          grd.addColorStop(1, after ? "#00e5ff" : "#e5e7eb");
          g.fillStyle = grd;
          for (let i = 0; i < n; i++) {
            // Scala quasi logaritmica: più barre sui bassi, dove sta il grosso del master.
            const v = data[Math.floor(Math.pow(i / n, 2) * data.length * 0.7)] / 255;
            g.fillRect(i * bw + 1, H - v * H, bw - 2, v * H);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      const cvs = canvasRef.current;
      cvs?.getContext("2d")?.clearRect(0, 0, cvs.width, cvs.height);
    };
  }, [playing]);

  const choose = (s: Side) => {
    setSide(s);
    sideRef.current = s;
    playerRef.current?.setGains(gainsFor(s, match, result));
  };

  const toggleMatch = () => {
    const m = !match;
    setMatch(m);
    matchRef.current = m;
    playerRef.current?.setGains(gainsFor(side, m, result));
  };

  const changePreset = (id: MasterPresetId) => {
    if (id === preset || !source) return;
    setPreset(id);
    void master(source, id);
  };

  const togglePlay = () => {
    if (!source || !result) return;
    if (playing) stop();
    else void start(source, result, position >= source.buffer.duration ? 0 : position, side, match);
  };

  const seekTo = (ratio: number) => {
    if (!source || !result) return;
    const t = Math.max(0, Math.min(source.buffer.duration - 0.05, ratio * source.buffer.duration));
    if (playing) void start(source, result, t, side, match);
    else {
      player().stop(t);
      setPosition(t);
    }
  };

  const download = () => {
    if (!source || !result) return;
    const b = result.buffer;
    const wav = encodeWav({ sampleRate: b.sampleRate, channels: [b.getChannelData(0), b.getChannelData(1)] });
    const url = URL.createObjectURL(new Blob([wav as Uint8Array<ArrayBuffer>], { type: "audio/wav" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(source.name)}-master-${preset}.wav`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const reset = () => {
    renderToken.current++;
    playerRef.current?.stop(0);
    setPlaying(false);
    setPosition(0);
    setSource(null);
    setResult(null);
    setBusy(null);
    setError(null);
  };

  const ready = source && result;
  const duration = source?.buffer.duration ?? 0;

  return (
    <section className="obsidian mst-stage relative isolate grid gap-4 overflow-hidden rounded-[32px] p-5 sm:p-7" aria-label="Confronto prima e dopo">
      {busy && (
        <p className="flex items-center gap-2 text-sm font-semibold text-electric-cyan" role="status">
          <Loader2 className="size-4 animate-spin" /> {busy}
        </p>
      )}

      {busy && !ready && (
        <div className="grid gap-4" aria-hidden>
          <span className="mst-skel h-14 rounded-full" />
          <span className="mst-skel h-[120px]" />
          <span className="mst-skel h-[70px]" />
          <span className="grid grid-cols-3 gap-2">
            <span className="mst-skel h-16" />
            <span className="mst-skel h-16" />
            <span className="mst-skel h-16" />
          </span>
        </div>
      )}

      {ready && (
        <div className={cn("grid gap-4 transition-opacity", busy && "pointer-events-none opacity-50")}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold">{source.name}</p>
              <p className="text-xs font-semibold text-chrome-400">
                {formatTime(duration)} · preset {MASTER_PRESETS[preset].name}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[13px] font-semibold text-chrome-100 ring-1 ring-inset ring-white/15 transition hover:bg-white/15 hover:text-white"
            >
              <RotateCcw className="size-3.5" /> Cambia
            </button>
          </div>

          <div className="mst-ab" role="group" aria-label="Prima o dopo il master">
            <button type="button" aria-pressed={side === "before"} onClick={() => choose("before")}>
              Prima
            </button>
            <button type="button" className="after" aria-pressed={side === "after"} onClick={() => choose("after")}>
              Dopo
            </button>
          </div>

          <div className="relative">
            <canvas ref={canvasRef} className="mst-spec" aria-hidden />
            {!playing && (
              <p className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] font-semibold text-chrome-500">
                Premi play per vedere lo spettro
              </p>
            )}
          </div>

          <MasterWave
            before={source.buffer}
            after={result.buffer}
            side={side}
            ratio={duration ? position / duration : 0}
            headRef={headRef}
            onSeek={seekTo}
            valueText={`${formatTime(position)} di ${formatTime(duration)}`}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pausa" : "Ascolta"}
              className="grid size-14 place-items-center rounded-full bg-white text-graphite shadow-[0_0_30px_rgba(255,255,255,0.25)] transition active:scale-95"
            >
              {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
            </button>
            <span className="font-mono text-sm tabular-nums text-chrome-300">
              <span ref={timeRef}>{formatTime(position)}</span> / {formatTime(duration)}
            </span>
            <ChromeButton variant="electric" size="md" className="ml-auto" onClick={download}>
              <Download className="size-4" /> Scarica WAV
            </ChromeButton>
          </div>

          <dl className="mst-stats">
            <div>
              <dt>Volume medio (dB)</dt>
              <dd data-testid="mst-loudness">
                {formatDb(result.before.rms)} → {formatDb(result.after.rms)}
              </dd>
            </div>
            <div>
              <dt>Differenza</dt>
              <dd data-testid="mst-gain">{formatDb(result.after.rms - result.before.rms, true)} dB</dd>
            </div>
            <div>
              <dt>Picco (dB)</dt>
              <dd data-testid="mst-peak">{formatDb(result.after.peak)}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Preset del master">
            {MASTER_PRESET_ORDER.map((id) => (
              <button key={id} type="button" className="mst-chip" aria-pressed={preset === id} onClick={() => changePreset(id)}>
                {MASTER_PRESETS[id].name}
              </button>
            ))}
          </div>

          <button type="button" className="mst-toggle" role="switch" aria-checked={match} onClick={toggleMatch}>
            <span className="min-w-0">
              <span className="block font-semibold text-white">Stesso volume</span>
              <span className="block text-[13px] text-chrome-400">
                Abbassa il &quot;dopo&quot; al volume del &quot;prima&quot;: confronti il suono, non solo quanto è forte.
              </span>
            </span>
            <span className="mst-switch" aria-hidden />
          </button>

          <p className="rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-chrome-300">
            È un master automatico per le demo. Per l&apos;uscita, il master lo facciamo noi in studio.{" "}
            <Link href="/beats/registra?servizio=MIX_MASTER#servizi" className="font-semibold text-electric-cyan underline-offset-2 hover:underline">
              Scopri il master vero <ArrowRight className="inline size-3.5" />
            </Link>
          </p>
        </div>
      )}

      {!ready && !busy && (
        <div className="grid gap-3">
          <p className="text-[15px] text-chrome-300">Scegli cosa masterizzare:</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" className="mst-source mst-source-main" onClick={() => void load("demo")}>
              <Mic className="size-5" />
              <span>
                <b>La tua ultima demo</b>
                <small>Quella registrata nello studio in app</small>
              </span>
            </button>
            <button type="button" className="mst-source" onClick={() => fileRef.current?.click()}>
              <FileAudio className="size-5" />
              <span>
                <b>Carica un file</b>
                <small>MP3, WAV o M4A: resta sul tuo dispositivo</small>
              </span>
            </button>
            <div className="mst-source">
              <Music2 className="size-5" />
              <span className="min-w-0">
                <b>Prova con un beat</b>
                <small>L&apos;anteprima di un beat del catalogo</small>
                {beats.length > 0 && (
                  <span className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Beat da provare">
                    {beats.map((b) => (
                      <button key={b.id} type="button" className="mst-chip" onClick={() => void load("beat", b)}>
                        {b.title}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="sr-only"
            tabIndex={-1}
            aria-label="Carica un file audio"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void load("file", f);
            }}
          />
          {demoMissing && (
            <p className="rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-chrome-300" role="status">
              Non trovo nessuna demo su questo dispositivo.{" "}
              <Link href="/beats/registra" className="font-semibold text-electric-cyan underline-offset-2 hover:underline">
                Registrane una nello studio
              </Link>{" "}
              e torna qui per sentirla masterizzata.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-2xl bg-deal/15 px-4 py-3 text-sm font-semibold text-red-200" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** Forme d'onda prima/dopo sovrapposte, con testina e seek (puntatore o frecce). */
function MasterWave({
  before,
  after,
  side,
  ratio,
  headRef,
  onSeek,
  valueText,
}: {
  before: AudioBuffer;
  after: AudioBuffer;
  side: Side;
  ratio: number;
  headRef: React.RefObject<HTMLSpanElement | null>;
  onSeek: (ratio: number) => void;
  valueText: string;
}) {
  const [peaks, setPeaks] = useState<{ a: number[]; b: number[] } | null>(null);
  useEffect(() => {
    setPeaks({ a: peaksOf(before.getChannelData(0), 120), b: peaksOf(after.getChannelData(0), 120) });
  }, [before, after]);

  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };

  const bars = (list: number[]) =>
    list.map((p, i) => {
      const h = Math.max(0.04, p) * 100;
      return <rect key={i} x={i + 0.15} y={(100 - h) / 2} width={0.7} height={h} rx={0.3} />;
    });

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Posizione nel brano"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuetext={valueText}
      className="mst-wave"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onSeek(at(e));
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 0.02;
        const map: Record<string, number> = { ArrowRight: ratio + step, ArrowLeft: ratio - step, Home: 0 };
        if (e.key in map) {
          e.preventDefault();
          onSeek(Math.min(1, Math.max(0, map[e.key])));
        }
      }}
    >
      {peaks && (
        <>
          <svg viewBox={`0 0 ${peaks.a.length} 100`} preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full">
            <g fill="rgba(255,255,255,0.5)" opacity={side === "before" ? 1 : 0.35}>
              {bars(peaks.a)}
            </g>
          </svg>
          <svg viewBox={`0 0 ${peaks.b.length} 100`} preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full">
            <g fill="rgba(0,150,255,0.6)" opacity={side === "after" ? 1 : 0.3}>
              {bars(peaks.b)}
            </g>
          </svg>
        </>
      )}
      <span ref={headRef} aria-hidden className="mst-head" style={{ left: `${ratio * 100}%` }} />
    </div>
  );
}
