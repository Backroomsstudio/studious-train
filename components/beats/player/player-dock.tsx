"use client";

import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "framer-motion";
import { Gauge, ListMusic, Loader2, Mic, Pause, Play, Repeat, SkipBack, SkipForward, Volume2, VolumeX, X, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/beats/format";
import { camelotCode, keyName } from "@/lib/beats/music";
import { useUnlockDialog } from "../providers";
import { BeatCover } from "../ui/beat-cover";
import { RangeSlider } from "../ui/range-slider";
import { bindEngineToStore, usePlayer } from "./player-store";
import { Waveform } from "./waveform";

/** Accetta e inoltra tutte le props: serve come `asChild` dei trigger Radix (ref, onClick, aria-*). */
function DockButton({
  label,
  active,
  children,
  className,
  ...rest
}: ComponentProps<"button"> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full transition",
        active ? "bg-electric/10 text-electric shadow-glow-sm" : "text-graphite-700 hover:bg-white/80 hover:text-graphite",
        className,
      )}
    >
      {children}
    </button>
  );
}

function PopoverPanel({ trigger, children, label }: { trigger: ReactNode; children: ReactNode; label: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild aria-label={label}>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={12} collisionPadding={12} className="glass z-50 w-72 rounded-3xl bg-white/90 p-4 outline-none">
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SpeedPanel() {
  const rate = usePlayer((s) => s.rate);
  const keepPitch = usePlayer((s) => s.keepPitch);
  const setRate = usePlayer((s) => s.setRate);
  const bpm = usePlayer((s) => s.current?.bpm ?? 0);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Velocità</p>
        <p className="text-sm tabular-nums text-chrome-500">
          {Math.round(bpm * rate)} BPM · {rate.toFixed(2)}×
        </p>
      </div>
      <RangeSlider value={[rate]} min={0.8} max={1.2} step={0.01} onValueChange={([r]) => setRate(r)} label="Velocità di riproduzione" />
      <label className="flex items-center justify-between gap-3 text-[13px] text-graphite-700">
        Mantieni la tonalità
        <input type="checkbox" checked={keepPitch} onChange={(e) => setRate(rate, e.target.checked)} className="size-4 accent-[#0066ff]" />
      </label>
      <p className="text-xs text-chrome-500">Senza tonalità fissa la velocità alza o abbassa anche il pitch, come un giradischi.</p>
      <button type="button" onClick={() => setRate(1)} className="text-[13px] font-semibold text-electric hover:underline">
        Ripristina 1×
      </button>
    </div>
  );
}

function QueuePanel() {
  const queue = usePlayer((s) => s.queue);
  const current = usePlayer((s) => s.current);
  const play = usePlayer((s) => s.play);
  const remove = usePlayer((s) => s.removeFromQueue);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">In coda · {queue.length}</p>
      <ol className="max-h-72 space-y-1 overflow-y-auto">
        {queue.map((b) => (
          <li key={b.id} className={cn("flex items-center gap-2 rounded-xl p-1.5", b.id === current?.id && "bg-electric/10")}>
            <button type="button" onClick={() => play(b, queue)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <BeatCover beat={b} size="sm" />
              <span className="min-w-0">
                <span className={cn("block truncate text-sm font-semibold", b.id === current?.id && "text-electric")}>{b.title}</span>
                <span className="block truncate text-xs text-chrome-500">{b.producers.map((p) => p.name).join(" & ")}</span>
              </span>
            </button>
            {b.id !== current?.id && (
              <button type="button" onClick={() => remove(b.id)} aria-label={`Togli ${b.title} dalla coda`} className="p-1 text-chrome-400 hover:text-graphite">
                <X className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function VocalPanel() {
  const vocal = usePlayer((s) => s.vocal);
  const enabled = usePlayer((s) => s.vocalEnabled);
  const volume = usePlayer((s) => s.vocalVolume);
  const setEnabled = usePlayer((s) => s.setVocalEnabled);
  const setVolume = usePlayer((s) => s.setVocalVolume);
  const setVocal = usePlayer((s) => s.setVocal);
  if (!vocal) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold">{vocal.name}</p>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} aria-label="Voce attiva" className="size-4 accent-[#0066ff]" />
      </div>
      <Waveform peaks={vocal.peaks} progress={0} height={28} compact label="Forma d'onda della voce" />
      <RangeSlider value={[volume]} min={0} max={1} step={0.01} onValueChange={([v]) => setVolume(v)} label="Volume voce" />
      <button type="button" onClick={() => setVocal(null)} className="text-[13px] font-semibold text-deal hover:underline">
        Rimuovi la voce
      </button>
    </div>
  );
}

/**
 * Dock audio persistente: vive nel layout del negozio, quindi la musica continua tra le pagine.
 * Su mobile si appoggia sopra la tab bar; da desktop occupa il fondo della finestra.
 */
export function PlayerDock() {
  useEffect(() => bindEngineToStore(), []);

  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing);
  const waiting = usePlayer((s) => s.waiting);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const buffered = usePlayer((s) => s.buffered);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const loop = usePlayer((s) => s.loop);
  const rate = usePlayer((s) => s.rate);
  const hasVocal = usePlayer((s) => Boolean(s.vocal));
  const queueLength = usePlayer((s) => s.queue.length);
  const { toggle, seek, next, previous, setVolume, toggleMute, loopBars, clearLoop } = usePlayer.getState();
  const openUnlock = useUnlockDialog((s) => s.open);

  // Barra spaziatrice = play/pausa (fuori dai campi di testo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.code !== "Space" || target.closest("input, textarea, select, button, [role=slider], [contenteditable]")) return;
      if (!usePlayer.getState().current) return;
      e.preventDefault();
      usePlayer.getState().toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const progress = duration ? position / duration : 0;

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="fixed inset-x-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 lg:inset-x-6 lg:bottom-4"
          role="region"
          aria-label="Player"
        >
          <div className={cn("glass mx-auto max-w-6xl rounded-[26px] bg-white/80 px-3 py-2.5 lg:px-5 lg:py-3", playing && "ring-1 ring-electric/25")}>
            <div className="flex items-center gap-3">
              <Link href={`/beats/${current.slug}`} className="shrink-0" aria-label={`Apri ${current.title}`}>
                <BeatCover beat={current} size="sm" playing={playing} />
              </Link>

              <div className="min-w-0 flex-1 lg:max-w-[14rem]">
                <p className="truncate font-display text-sm font-semibold">{current.title}</p>
                <p className="truncate text-xs text-chrome-500">
                  {current.producers.map((p) => p.name).join(" & ")} · {current.bpm} BPM · {keyName(current.key)} ({camelotCode(current.key)})
                </p>
              </div>

              <div className="flex items-center gap-0.5">
                <DockButton label="Precedente" onClick={previous} className="hidden sm:grid">
                  <SkipBack className="size-4 fill-current" />
                </DockButton>
                <button
                  type="button"
                  onClick={() => toggle()}
                  aria-label={playing ? "Pausa" : "Riproduci"}
                  className="grid size-11 place-items-center rounded-full bg-graphite text-white shadow-glow-sm transition active:scale-95"
                >
                  {waiting ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : playing ? (
                    <Pause className="size-5 fill-current" />
                  ) : (
                    <Play className="size-5 translate-x-px fill-current" />
                  )}
                </button>
                <DockButton label="Successivo" onClick={next}>
                  <SkipForward className="size-4 fill-current" />
                </DockButton>
              </div>

              <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
                <span className="w-10 text-right text-xs tabular-nums text-chrome-500">{formatTime(position)}</span>
                <Waveform
                  peaks={current.peaks}
                  progress={progress}
                  buffered={duration ? buffered / duration : 0}
                  loop={loop && duration ? { start: loop.start / duration, end: loop.end / duration } : null}
                  active={playing}
                  height={36}
                  label="Posizione di riproduzione"
                  valueText={`${formatTime(position)} di ${formatTime(duration)}`}
                  onSeek={duration ? (r) => seek(r * duration) : undefined}
                />
                <span className="w-10 text-xs tabular-nums text-chrome-500">{formatTime(duration)}</span>
              </div>

              <div className="hidden items-center gap-0.5 sm:flex">
                <DockButton label={loop ? "Disattiva loop" : "Loop di 4 battute"} active={Boolean(loop)} onClick={() => (loop ? clearLoop() : loopBars(4))}>
                  <Repeat className="size-4" />
                </DockButton>
                <PopoverPanel
                  label="Velocità e pitch"
                  trigger={
                    <DockButton label="Velocità e pitch" active={rate !== 1}>
                      <Gauge className="size-4" />
                    </DockButton>
                  }
                >
                  <SpeedPanel />
                </PopoverPanel>
                {hasVocal && (
                  <PopoverPanel
                    label="Traccia vocale"
                    trigger={
                      <DockButton label="Traccia vocale" active>
                        <Mic className="size-4" />
                      </DockButton>
                    }
                  >
                    <VocalPanel />
                  </PopoverPanel>
                )}
                <PopoverPanel
                  label="Coda"
                  trigger={
                    <DockButton label={`Coda (${queueLength})`}>
                      <ListMusic className="size-4" />
                    </DockButton>
                  }
                >
                  <QueuePanel />
                </PopoverPanel>
                <div className="hidden items-center gap-1 xl:flex">
                  <DockButton label={muted ? "Riattiva audio" : "Muto"} onClick={toggleMute}>
                    {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                  </DockButton>
                  <div className="w-24">
                    <RangeSlider value={[muted ? 0 : volume]} min={0} max={1} step={0.01} onValueChange={([v]) => setVolume(v)} label="Volume" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openUnlock(current)}
                className="hidden h-10 items-center gap-1.5 rounded-full bg-electric px-4 text-[13px] font-bold text-white shadow-glow-sm transition hover:shadow-glow md:inline-flex"
              >
                <Zap className="size-3.5 fill-current" /> Sblocca
              </button>
            </div>

            {/* Scrubber sottile su mobile */}
            <div className="mt-2 lg:hidden">
              <Waveform
                peaks={current.peaks}
                progress={progress}
                buffered={duration ? buffered / duration : 0}
                active={playing}
                height={18}
                compact
                label="Posizione di riproduzione"
                valueText={`${formatTime(position)} di ${formatTime(duration)}`}
                onSeek={duration ? (r) => seek(r * duration) : undefined}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
