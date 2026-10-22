"use client";

import { Loader2, Pause, Play, SlidersVertical, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/beats/format";
import { creditCost } from "@/lib/beats/licenses";
import { STEM_INFO, STEM_NAMES, type StemName } from "@/lib/beats/stems";
import type { BeatSummary } from "@/lib/beats/types";
import { usePlayer } from "../player/player-store";
import { useUnlockDialog } from "../providers";
import { ChromeButton } from "../ui/chrome-button";
import { Dialog } from "../ui/dialog";
import { loadStems, mixerContext, StemPlayer, type StemBuffers } from "./stem-player";

type Levels = Record<StemName, number>;
const FULL: Levels = { drums: 1, bass: 1, keys: 1, fx: 1 };

/** Bottone "Mixer stems" della pagina del beat (solo per i beat con gli stems) e la sua modale. */
export function StemMixerButton({ beat }: { beat: BeatSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ChromeButton variant="chrome" size="lg" onClick={() => setOpen(true)}>
        <SlidersVertical className="size-4" /> Mixer stems
      </ChromeButton>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Mixer degli stems"
        description={`${beat.title} diviso nelle sue parti: spegni la batteria, alza l'808, senti come respira il beat.`}
        className="sm:w-[min(620px,calc(100vw-2rem))]"
      >
        {open && <StemMixer beat={beat} onUnlock={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function StemMixer({ beat, onUnlock }: { beat: BeatSummary; onUnlock: () => void }) {
  const [buffers, setBuffers] = useState<StemBuffers | null>(null);
  const [error, setError] = useState(false);
  const [volume, setVolume] = useState<Levels>(FULL);
  const [mute, setMute] = useState<Partial<Record<StemName, boolean>>>({});
  const [solo, setSolo] = useState<StemName | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  const playerRef = useRef<StemPlayer | null>(null);
  const meterRefs = useRef<Partial<Record<StemName, HTMLElement | null>>>({});
  const barRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const openUnlock = useUnlockDialog((s) => s.open);

  const player = () => (playerRef.current ??= new StemPlayer(mixerContext()));
  const levels = useCallback(
    (v: Levels, m: Partial<Record<StemName, boolean>>, s: StemName | null): Levels =>
      Object.fromEntries(STEM_NAMES.map((k) => [k, !m[k] && (!s || s === k) ? v[k] : 0])) as Levels,
    [],
  );
  const current = levels(volume, mute, solo);

  useEffect(() => {
    let alive = true;
    loadStems(beat.id).then(
      (b) => alive && setBuffers(b),
      () => alive && setError(true),
    );
    return () => {
      alive = false;
    };
  }, [beat.id]);

  const stop = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    p.stop();
    setPlaying(false);
    setPosition(p.position);
    for (const el of Object.values(meterRefs.current)) if (el) el.style.height = "0";
  }, []);

  // Chiudendo la modale (smontaggio) il mixer si ferma.
  useEffect(() => () => playerRef.current?.stop(), []);

  // Se riparte il player globale, il mixer si ferma.
  useEffect(
    () =>
      usePlayer.subscribe((s, prev) => {
        if (s.playing && !prev.playing && playerRef.current?.playing) stop();
      }),
    [stop],
  );

  // Meter e avanzamento a 60 fps, fuori da React.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const data = new Float32Array(512);
    const held: Levels = { drums: 0, bass: 0, keys: 0, fx: 0 };
    const loop = () => {
      const p = playerRef.current;
      if (!p?.playing) return;
      const pos = p.position;
      if (pos >= p.duration - 0.01) {
        p.stop(0);
        setPlaying(false);
        setPosition(0);
        for (const el of Object.values(meterRefs.current)) if (el) el.style.height = "0";
        return;
      }
      for (const stem of STEM_NAMES) {
        const an = p.analysers[stem];
        const el = meterRefs.current[stem];
        if (!an || !el) continue;
        an.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 2) sum += data[i] * data[i];
        // Salita immediata, discesa morbida come un meter vero.
        held[stem] = Math.max(Math.min(100, Math.sqrt(sum / (data.length / 2)) * 300), held[stem] * 0.9);
        el.style.height = `${held[stem] < 0.5 ? 0 : held[stem]}%`;
      }
      if (barRef.current) barRef.current.style.width = `${(pos / p.duration) * 100}%`;
      if (timeRef.current) timeRef.current.textContent = formatTime(pos);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const apply = (v: Levels, m: Partial<Record<StemName, boolean>>, s: StemName | null) => playerRef.current?.setLevels(levels(v, m, s));

  const toggle = async () => {
    if (!buffers) return;
    if (playing) return stop();
    usePlayer.getState().pause();
    const duration = buffers.drums.duration;
    await player().play(buffers, position >= duration - 0.05 ? 0 : position, current);
    setPlaying(true);
  };

  const seek = async (ratio: number) => {
    if (!buffers) return;
    const t = Math.max(0, Math.min(buffers.drums.duration - 0.05, ratio * buffers.drums.duration));
    setPosition(t);
    if (barRef.current) barRef.current.style.width = `${ratio * 100}%`;
    if (playing) await player().play(buffers, t, current);
    else player().stop(t);
  };

  const duration = buffers?.drums.duration ?? beat.durationSec;
  const trackoutCost = creditCost("TRACKOUT", beat.deal?.discountPct);

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-2xl bg-deal/10 px-4 py-3 text-sm font-semibold text-deal" role="alert">
          Non riesco a caricare gli stems di questo beat. Riprova tra poco.
        </p>
      )}
      {!buffers && !error && (
        <p className="flex items-center gap-2 text-sm font-semibold text-electric" role="status">
          <Loader2 className="size-4 animate-spin" /> Carico gli stems…
        </p>
      )}

      <div className="mxr-grid">
        {STEM_NAMES.map((stem) => {
          const { label, color } = STEM_INFO[stem];
          const on = !mute[stem] && (!solo || solo === stem);
          return (
            <div key={stem} className={cn("mxr-strip glass", !on && "is-off")} style={{ ["--sc" as string]: color }}>
              <b className="text-[12.5px]">{label}</b>
              <div className="mxr-fader-wrap">
                <span className="mxr-meter" aria-hidden>
                  <i ref={(el) => void (meterRefs.current[stem] = el)} data-testid={`meter-${stem}`} />
                </span>
                <input
                  type="range"
                  className="mxr-fader"
                  min={0}
                  max={1.5}
                  step={0.01}
                  value={volume[stem]}
                  disabled={!buffers}
                  aria-label={`Volume ${label}`}
                  aria-valuetext={`${Math.round(volume[stem] * 100)}%`}
                  onChange={(e) => {
                    const v = { ...volume, [stem]: Number(e.target.value) };
                    setVolume(v);
                    apply(v, mute, solo);
                  }}
                />
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="mxr-btn"
                  aria-pressed={!!mute[stem]}
                  aria-label={`Muto ${label}`}
                  onClick={() => {
                    const m = { ...mute, [stem]: !mute[stem] };
                    setMute(m);
                    apply(volume, m, solo);
                  }}
                >
                  M
                </button>
                <button
                  type="button"
                  className="mxr-btn mxr-solo"
                  aria-pressed={solo === stem}
                  aria-label={`Solo ${label}`}
                  onClick={() => {
                    const s = solo === stem ? null : stem;
                    setSolo(s);
                    apply(volume, mute, s);
                  }}
                >
                  S
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Posizione nel beat"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((position / (duration || 1)) * 100)}
        aria-valuetext={`${formatTime(position)} di ${formatTime(duration)}`}
        className="mxr-progress"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          void seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
        }}
        onKeyDown={(e) => {
          const ratio = position / (duration || 1);
          const map: Record<string, number> = { ArrowRight: ratio + 0.05, ArrowLeft: ratio - 0.05, Home: 0 };
          if (e.key in map) {
            e.preventDefault();
            void seek(Math.min(1, Math.max(0, map[e.key])));
          }
        }}
      >
        <span ref={barRef} style={{ width: `${(position / (duration || 1)) * 100}%` }} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ChromeButton variant="electric" size="lg" onClick={() => void toggle()} disabled={!buffers}>
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          {playing ? "Pausa" : "Ascolta"}
        </ChromeButton>
        <span className="font-mono text-sm tabular-nums text-chrome-500">
          <span ref={timeRef}>{formatTime(position)}</span> / {formatTime(duration)}
        </span>
      </div>

      <div className="obsidian flex flex-wrap items-center gap-3 rounded-[22px] p-4">
        <p className="min-w-[180px] flex-1 text-sm text-chrome-200">
          <b className="block font-display text-[15px] text-white">Vuoi le stems vere? Sbloccale con la licenza</b>
          WAV separati in qualità piena, senza tag, con la Trackout o la Unlimited.
        </p>
        <ChromeButton
          variant="electric"
          onClick={() => {
            onUnlock();
            openUnlock(beat);
          }}
        >
          <Zap className="size-4 fill-current" /> Trackout · {trackoutCost} crediti
        </ChromeButton>
      </div>
    </div>
  );
}
