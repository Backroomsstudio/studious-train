"use client";

import { Headphones, Pause, Play, RotateCcw, SkipBack, Upload, AudioLines } from "lucide-react";
import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import { BeatCover } from "@/components/beats/ui/beat-cover";
import { cn } from "@/lib/cn";
import { peaksOf, scaleLabel } from "@/lib/beats/audio/pitch";
import type { StudioTrack } from "@/lib/beats/audio/studio-project";
import { camelotCode, keyName } from "@/lib/beats/music";
import { LaneWave } from "./lane-wave";
import { getStudioEngine } from "./studio-engine";
import { useStudio } from "./studio-store";

const fmtTc = (s: number) => {
  const v = Math.max(0, s);
  return `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}.${Math.floor(v * 10) % 10}`;
};

const STATE_LABEL = { idle: "STOP", play: "PLAY", rec: "REC", count: "PRONTI" } as const;

function TakeLane({ track, index, selected, seconds }: { track: StudioTrack; index: number; selected: boolean; seconds: number }) {
  const select = useStudio((s) => s.select);
  const data = track.tune !== "off" && track.tuned ? track.tuned : track.take?.data;
  const peaks = useMemo(() => (data ? peaksOf(data, 120) : []), [data]);
  const take = track.take;
  const left = take ? (take.start / seconds) * 100 : 0;
  const width = take ? Math.min(100 - left, (take.data.length / take.sr / seconds) * 100) : 0;
  return (
    <button
      type="button"
      onClick={() => select(index)}
      aria-label={`Corsia ${track.name}${selected ? " (traccia attiva)" : ""}`}
      aria-pressed={selected}
      className={cn(
        "relative block h-10 w-full overflow-hidden rounded-xl bg-white/5 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]",
        selected && "",
      )}
    >
      <span className="absolute left-2 top-1 z-[1] text-[10px] font-semibold text-chrome-400">{track.name}</span>
      {take && (
        <span
          className={cn("absolute inset-y-0 rounded-[10px]", track.mute && "opacity-35")}
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: `color-mix(in srgb, ${track.color} 22%, transparent)`,
          }}
        >
          <LaneWave peaks={peaks} color={track.color} />
        </span>
      )}
    </button>
  );
}

/** Il palco nero: beat, corsie delle voci, playhead, trasporto e microfono. */
export function StudioStage({ onPickBeat, onUpload }: { onPickBeat: () => void; onUpload: (index: number) => void }) {
  const beat = useStudio((s) => s.beat)!;
  const buffer = useStudio((s) => s.beatBuffer);
  const status = useStudio((s) => s.beatStatus);
  const tracks = useStudio((s) => s.tracks);
  const sel = useStudio((s) => s.sel);
  const transport = useStudio((s) => s.transport);
  const pos = useStudio((s) => s.pos);
  const metro = useStudio((s) => s.metro);
  const countIn = useStudio((s) => s.countIn);
  const mic = useStudio((s) => s.mic);
  const micError = useStudio((s) => s.micError);
  const { play, record, seek, stop, toggleMetro, toggleCountIn, useDemoVoice, setBeat } = useStudio.getState();

  const seconds = buffer?.duration ?? beat.durationSec;
  const bar = (60 / beat.bpm) * 4;
  const beatPeaks = useMemo(() => (buffer ? peaksOf(buffer.getChannelData(0), 160) : beat.peaks), [buffer, beat.peaks]);

  const phRef = useRef<HTMLSpanElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const meterRef = useRef<HTMLElement>(null);
  const countRef = useRef<HTMLDivElement>(null);

  // Playhead, timecode, battuta, livello del microfono e conto alla rovescia: fuori da React, a 60 fps.
  useEffect(() => {
    const engine = getStudioEngine();
    let raf = 0;
    const paint = () => {
      const p = transport === "idle" ? pos : engine.position();
      if (phRef.current) phRef.current.style.left = `${Math.min(100, (p / seconds) * 100)}%`;
      if (tcRef.current) tcRef.current.textContent = `${STATE_LABEL[transport]} ${fmtTc(p)}`;
      if (barRef.current) barRef.current.textContent = `Battuta ${Math.floor(p / bar) + 1}`;
      if (meterRef.current) meterRef.current.style.width = `${Math.min(100, engine.level * 260)}%`;
      if (countRef.current) countRef.current.textContent = String(Math.max(1, Math.ceil(engine.countLeft() / (bar / 4))));
      if (transport !== "idle") raf = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [transport, pos, seconds, bar]);

  const onTimeline = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * seconds);
  };

  const recording = transport === "rec" || transport === "count";
  const ready = status === "ready";
  const selTrack = tracks[sel];

  return (
    <section
      aria-label="Registratore"
      className={cn(
        "obsidian studio-stage relative grid gap-4 overflow-hidden rounded-[28px] p-4 sm:p-6",
        transport === "rec" && "studio-recording",
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <BeatCover beat={beat} size="sm" playing={transport !== "idle"} />
        <span className="min-w-0 flex-1">
          <b className="block truncate font-display text-[17px]">{beat.title}</b>
          <small className="block text-[12px] leading-snug text-chrome-400">
            {beat.bpm} BPM · {keyName(beat.key)} ({camelotCode(beat.key)}) · autotune in {scaleLabel(beat.key)}
          </small>
        </span>
        <button
          type="button"
          onClick={onPickBeat}
          disabled={recording}
          className="h-9 shrink-0 rounded-full bg-white/10 px-4 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15 disabled:opacity-40"
        >
          Cambia beat
        </button>
      </div>

      <div className="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-chrome-300">
        <i aria-hidden className={cn("size-2.5 rounded-full bg-chrome-500", transport === "rec" && "animate-pulse bg-[#e0306c]")} />
        <span ref={tcRef} className={cn(transport === "rec" && "text-[#e0306c]")} data-testid="timecode">
          STOP 0:00.0
        </span>
        <span ref={barRef} className="ml-auto text-chrome-500">
          Battuta 1
        </span>
      </div>

      <div
        className="relative grid touch-none select-none gap-2 py-2"
        onPointerDown={ready ? onTimeline : undefined}
        role="group"
        aria-label="Timeline: tocca per spostarti"
      >
        <div className="relative h-[46px] overflow-hidden rounded-xl bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
          <span className="absolute left-2 top-1 z-[1] text-[10px] font-semibold text-chrome-400">Beat</span>
          {status === "loading" && <span className="studio-skel absolute inset-0" aria-label="Carico il beat…" />}
          {status !== "loading" && <LaneWave peaks={beatPeaks} color="rgba(255,255,255,0.35)" />}
        </div>
        {tracks.map((t, i) => (
          <TakeLane key={t.id} track={t} index={i} selected={i === sel} seconds={seconds} />
        ))}
        <span
          ref={phRef}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-[3] w-0.5 bg-white",
            transport === "rec" && "bg-[#e0306c]",
          )}
        />
        {transport === "count" && (
          <div
            ref={countRef}
            aria-live="assertive"
            className="pointer-events-none absolute inset-0 z-[4] grid place-items-center rounded-xl bg-[#05070a]/45 font-display text-[96px] font-semibold text-white"
          >
            4
          </div>
        )}
      </div>

      {status === "error" && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-[#f27ba4]">
          Non riesco a caricare l&apos;anteprima del beat.
          <button type="button" className="inline-flex items-center gap-2 font-semibold text-white underline" onClick={() => setBeat(beat)}>
            <RotateCcw className="size-3.5" /> Riprova
          </button>
        </p>
      )}

      <div className="flex items-center justify-center gap-4 sm:gap-4">
        <button
          type="button"
          aria-label="Torna all'inizio"
          onClick={() => (transport === "idle" ? seek(0) : stop(true))}
          className="grid size-12 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
        >
          <SkipBack className="size-5 fill-current" />
        </button>
        <button
          type="button"
          aria-label={transport === "play" ? "Ferma" : "Ascolta"}
          onClick={() => void play()}
          disabled={!ready || recording}
          className="grid size-[58px] place-items-center rounded-full bg-white text-[#05070a] transition active:scale-95 disabled:opacity-40"
        >
          {transport === "play" ? <Pause className="size-6 fill-current" /> : <Play className="ml-0 size-6 fill-current" />}
        </button>
        <button
          type="button"
          aria-label={recording ? "Ferma la registrazione" : `Registra su ${selTrack.name}`}
          onClick={() => void record()}
          disabled={!ready}
          data-testid="rec-button"
          className="studio-recbtn grid size-[76px] place-items-center rounded-full transition active:scale-[0.92] disabled:opacity-40"
        >
          <i aria-hidden className={cn("block size-[26px] rounded-full bg-white transition-all", recording && "size-6 rounded-md")} />
        </button>
        <button
          type="button"
          aria-label="Metronomo"
          aria-pressed={metro}
          onClick={toggleMetro}
          className={cn("grid size-12 place-items-center rounded-full bg-white/10 text-white transition", metro && "bg-electric-cyan/15 text-electric-cyan")}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3 7 21h10z" />
            <path d="m12 13 6-6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Conto alla rovescia di una battuta"
          aria-pressed={countIn}
          onClick={toggleCountIn}
          className={cn("grid size-12 place-items-center rounded-full bg-white/10 text-[13px] font-semibold text-white transition", countIn && "bg-electric-cyan/15 text-electric-cyan")}
        >
          1-4
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-chrome-300">
        {mic === "error" ? (
          <span className="text-[#f27ba4]">Microfono non disponibile</span>
        ) : mic === "ready" ? (
          <span className="text-[#8e8e95]">Microfono pronto</span>
        ) : (
          <span>Il microfono si attiva quando premi REC</span>
        )}
        <span className="h-1.5 min-w-[100px] flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <i ref={meterRef} className="block h-full w-0 rounded-full bg-electric transition-[width] duration-75" />
        </span>
        <span className="inline-flex items-center gap-2 text-chrome-400">
          <Headphones className="size-3.5" /> Usa le cuffie
        </span>
      </div>

      {micError && (
        <div className="grid gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-inset ring-white/10" role="alert">
          <p className="text-sm leading-relaxed text-chrome-200">{micError}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onUpload(sel)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/15"
            >
              <Upload className="size-4" /> Carica una voce registrata
            </button>
            <button
              type="button"
              onClick={() => void useDemoVoice(sel)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-electric px-4 text-[13px] font-semibold text-white"
            >
              <AudioLines className="size-4" /> Usa la voce demo
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
