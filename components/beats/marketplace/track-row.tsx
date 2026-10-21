"use client";

import { Check, ListPlus, Pause, Play } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/beats/format";
import { creditCost, LICENSE_ORDER } from "@/lib/beats/licenses";
import { camelotCode, keyName } from "@/lib/beats/music";
import type { BeatSummary } from "@/lib/beats/types";
import { usePlayer } from "../player/player-store";
import { Waveform } from "../player/waveform";
import { useUnlockDialog, useViewer } from "../providers";
import { BeatCover } from "../ui/beat-cover";
import { CreditCost, GlowBadge, ProducerTag } from "../ui/glow-badge";

/** Equalizzatore animato per la riga in riproduzione. */
function NowPlayingBars() {
  return (
    <span aria-hidden className="flex h-3.5 items-end gap-[2px]">
      {[0, 0.2, 0.4].map((d) => (
        <span key={d} className="w-[3px] origin-bottom animate-eq rounded-full bg-electric" style={{ height: "100%", animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

export const TrackRow = memo(function TrackRow({ beat, queue }: { beat: BeatSummary; queue: BeatSummary[] }) {
  const isCurrent = usePlayer((s) => s.current?.id === beat.id);
  const playing = usePlayer((s) => s.current?.id === beat.id && s.playing);
  const progress = usePlayer((s) => (s.current?.id === beat.id && s.duration ? s.position / s.duration : 0));
  const buffered = usePlayer((s) => (s.current?.id === beat.id && s.duration ? s.buffered / s.duration : 0));
  // Selettori primitivi: un oggetto nuovo a ogni lettura farebbe ri-renderizzare la riga all'infinito.
  const loopStart = usePlayer((s) => (s.current?.id === beat.id && s.loop && s.duration ? s.loop.start / s.duration : -1));
  const loopEnd = usePlayer((s) => (s.current?.id === beat.id && s.loop && s.duration ? s.loop.end / s.duration : -1));
  const loop = loopStart >= 0 ? { start: loopStart, end: loopEnd } : null;
  const toggle = usePlayer((s) => s.toggle);
  const seek = usePlayer((s) => s.seek);
  const enqueue = usePlayer((s) => s.enqueue);
  const duration = usePlayer((s) => (s.current?.id === beat.id ? s.duration : 0));
  const openUnlock = useUnlockDialog((s) => s.open);
  const { data: viewer } = useViewer();

  const owned = viewer?.owned[beat.id] ?? [];
  const minCost = creditCost(LICENSE_ORDER[0], beat.deal?.discountPct);
  const baseCost = creditCost(LICENSE_ORDER[0]);
  const main = beat.producers.filter((p) => p.role === "MAIN");
  const co = beat.producers.filter((p) => p.role === "CO_PRODUCER");

  return (
    <li
      className={cn(
        "group relative grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 rounded-2xl px-2.5 py-2.5 transition-all duration-200 sm:gap-x-4 sm:px-3",
        "lg:grid-cols-[3.5rem_minmax(0,1.3fr)_minmax(0,1.6fr)_4.5rem_5.5rem_3.5rem_7.5rem]",
        isCurrent ? "glass ring-1 ring-electric/30 shadow-glow-sm" : "hover:bg-white/60 hover:shadow-chrome",
      )}
    >
      <button
        type="button"
        onClick={() => toggle(beat, queue)}
        aria-label={playing ? `Pausa ${beat.title}` : `Ascolta ${beat.title}`}
        className="relative shrink-0 rounded-2xl"
      >
        <BeatCover beat={beat} playing={playing} />
        <span
          className={cn(
            "absolute inset-0 grid place-items-center rounded-2xl bg-graphite/45 text-white backdrop-blur-[2px] transition-opacity",
            isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 translate-x-px fill-current" />}
        </span>
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {playing && <NowPlayingBars />}
          <Link
            href={`/beats/${beat.slug}`}
            className={cn("truncate font-display text-[15px] font-semibold tracking-tight hover:underline", isCurrent && "text-electric")}
          >
            {beat.title}
          </Link>
          {beat.deal && <GlowBadge tone="deal">-{beat.deal.discountPct}%</GlowBadge>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {main.map((p) => (
            <ProducerTag key={p.slug} name={p.name} color={p.accentColor} />
          ))}
          {co.map((p) => (
            <ProducerTag key={p.slug} name={p.name} color={p.accentColor} co />
          ))}
        </div>
        {/* Meta su mobile: sotto il titolo */}
        <p className="mt-1 truncate text-xs text-chrome-500 lg:hidden">
          {beat.bpm} BPM · {keyName(beat.key)} ({camelotCode(beat.key)}) · {beat.genres.map((g) => g.name).join(", ")}
        </p>
      </div>

      <div className="hidden min-w-0 lg:block">
        <Waveform
          peaks={beat.peaks}
          progress={progress}
          buffered={buffered}
          loop={loop}
          active={playing}
          height={34}
          compact
          label={`Forma d'onda di ${beat.title}`}
          valueText={isCurrent ? formatTime(progress * duration) : undefined}
          onSeek={isCurrent && duration ? (r) => seek(r * duration) : undefined}
        />
        <div className="mt-1 flex gap-1.5 overflow-hidden">
          {beat.typeTags.slice(0, 2).map((t) => (
            <span key={t.slug} className="truncate text-[11px] font-medium text-chrome-500">
              #{t.name.replace(/\s+/g, "")}Type
            </span>
          ))}
        </div>
      </div>

      <div className="hidden text-sm tabular-nums text-graphite-700 lg:block">
        <span className="font-semibold">{beat.bpm}</span> <span className="text-xs text-chrome-500">BPM</span>
      </div>
      <div className="hidden text-sm lg:block">
        <span className="font-semibold text-graphite-700">{keyName(beat.key)}</span>
        <span className="ml-1 rounded-md bg-chrome-200 px-1 py-0.5 font-mono text-[10px] font-bold text-chrome-500">{camelotCode(beat.key)}</span>
      </div>
      <div className="hidden text-sm tabular-nums text-chrome-500 lg:block">{formatTime(beat.durationSec)}</div>

      <div className="flex items-center gap-1.5 justify-self-end">
        <button
          type="button"
          onClick={() => enqueue(beat)}
          aria-label={`Aggiungi ${beat.title} alla coda`}
          className="hidden size-9 place-items-center rounded-full text-chrome-500 transition hover:bg-white hover:text-graphite sm:grid"
        >
          <ListPlus className="size-4" />
        </button>
        {owned.length ? (
          <button
            type="button"
            onClick={() => openUnlock(beat)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ok/10 px-3 text-xs font-bold text-ok ring-1 ring-inset ring-ok/30"
          >
            <Check className="size-3.5" /> Tua
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openUnlock(beat)}
            aria-label={`Sblocca ${beat.title} da ${minCost} crediti`}
            className="rounded-full transition active:scale-95"
          >
            <CreditCost cost={minCost} original={beat.deal ? baseCost : undefined} className="h-9 px-3 text-xs hover:shadow-glow" />
          </button>
        )}
      </div>
    </li>
  );
});

export function TrackList({ beats, className }: { beats: BeatSummary[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-1", className)} aria-label="Beat">
      {beats.map((beat) => (
        <TrackRow key={beat.id} beat={beat} queue={beats} />
      ))}
    </ul>
  );
}
