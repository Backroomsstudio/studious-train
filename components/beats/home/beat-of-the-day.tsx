"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { BeatSummary } from "@/lib/beats/types";
import { camelotCode, keyName } from "@/lib/beats/music";
import { usePlayer } from "../player/player-store";
import { Waveform } from "../player/waveform";
import { useUnlockDialog } from "../providers";
import { GlowBadge } from "../ui/glow-badge";

function useCountdown(endsAt: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const end = new Date(endsAt).getTime();
    let frame = 0;
    // requestAnimationFrame per i centesimi; il calcolo parte dal clock, quindi niente deriva.
    const tick = () => {
      setLeft(Math.max(0, end - Date.now()));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [endsAt]);
  return left;
}

const pad = (n: number) => n.toString().padStart(2, "0");

/** Beat del giorno: sconto a tempo con conto alla rovescia (ore : min : sec : cent). */
export function BeatOfTheDay({ beat }: { beat: BeatSummary }) {
  const left = useCountdown(beat.deal?.endsAt ?? new Date().toISOString());
  const playing = usePlayer((s) => s.current?.id === beat.id && s.playing);
  const toggle = usePlayer((s) => s.toggle);
  const progress = usePlayer((s) => (s.current?.id === beat.id && s.duration ? s.position / s.duration : 0));
  const openUnlock = useUnlockDialog((s) => s.open);
  const producers = beat.producers;

  const parts =
    left === null
      ? ["--", "--", "--", "--"]
      : [Math.floor(left / 3_600_000), Math.floor(left / 60_000) % 60, Math.floor(left / 1000) % 60, Math.floor(left / 10) % 100].map(pad);

  return (
    <section aria-labelledby="botd-title" className="obsidian relative flex flex-col overflow-hidden rounded-[28px] p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-electric/30 blur-3xl" />
      <div className="relative flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-electric-cyan">Beat del giorno</p>
        {beat.deal && <GlowBadge tone="deal" className="px-3 py-1.5 text-sm">-{beat.deal.discountPct}%</GlowBadge>}
      </div>
      <h2 id="botd-title" className="chrome-text-light relative mt-3 font-display text-5xl font-black uppercase tracking-tight sm:text-6xl">
        {beat.title}
      </h2>
      <p className="relative mt-1 text-[15px] text-chrome-300">
        Tutte le licenze -{beat.deal?.discountPct ?? 0}% · prod. by{" "}
        {producers.map((p, i) => (
          <span key={p.slug} style={{ color: p.accentColor ?? undefined }} className="font-semibold">
            {i > 0 && " & "}
            {p.name}
          </span>
        ))}
      </p>
      <p className="relative mt-4 flex flex-wrap items-baseline gap-x-3" aria-label="Tempo rimanente all'offerta">
        <span className="font-mono text-4xl font-black tabular-nums tracking-tight text-electric-cyan drop-shadow-[0_0_14px_rgba(0,240,255,0.55)] sm:text-5xl" aria-hidden>
          {parts.join(":")}
        </span>
        <span className="text-xs text-chrome-400">ore : min : sec : cent</span>
      </p>
      <div className="relative mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => toggle(beat)}
          className="sheen inline-flex h-14 flex-1 items-center justify-center gap-2.5 rounded-full bg-[linear-gradient(180deg,#3b82f6_0%,#0066ff_60%,#0052cc_100%)] text-[15px] font-bold uppercase tracking-[0.12em] text-white shadow-glow transition active:scale-[0.98]"
        >
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          {playing ? "In ascolto" : "Ascolta subito"}
        </button>
        <button
          type="button"
          onClick={() => openUnlock(beat)}
          className="inline-flex h-14 items-center rounded-full border border-white/15 bg-white/5 px-6 text-[15px] font-semibold text-white transition hover:bg-white/10"
        >
          Licenze
        </button>
      </div>
      {/* Su desktop la scheda è alta quanto la colonna accanto: la forma d'onda riempie il fondo. */}
      <div className="relative mt-6 hidden lg:mt-auto lg:block lg:pt-8">
        <Waveform peaks={beat.peaks} progress={progress} active={playing} height={72} label={`Forma d'onda di ${beat.title}`} />
        <p className="mt-3 text-[13px] text-chrome-400">
          {beat.bpm} BPM · {keyName(beat.key)} ({camelotCode(beat.key)}) · {beat.genres.map((g) => g.name).join(", ")}
        </p>
      </div>
    </section>
  );
}
