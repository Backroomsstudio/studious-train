"use client";

import { CalendarClock, Pause, Play } from "lucide-react";
import Link from "next/link";
import { formatRelativeDay } from "@/lib/beats/format";
import { beatColor } from "@/lib/beats/genres";
import type { BeatSummary } from "@/lib/beats/types";
import { usePlayer } from "../player/player-store";
import { BeatCover } from "../ui/beat-cover";
import { GlowBadge } from "../ui/glow-badge";

function ArrivalCard({ beat, queue }: { beat: BeatSummary; queue: BeatSummary[] }) {
  const playing = usePlayer((s) => s.current?.id === beat.id && s.playing);
  const toggle = usePlayer((s) => s.toggle);
  const color = beatColor(beat);
  return (
    <li className="w-44 shrink-0 snap-start sm:w-52">
      <div className="group relative">
        <BeatCover beat={beat} size="xl" playing={playing} className="size-44! sm:size-52!" />
        <GlowBadge tone="graphite" className="absolute left-2 top-2">
          Nuovo
        </GlowBadge>
        <button
          type="button"
          onClick={() => toggle(beat, queue)}
          aria-label={playing ? `Pausa ${beat.title}` : `Ascolta ${beat.title}`}
          className="absolute bottom-2.5 right-2.5 grid size-12 place-items-center rounded-full bg-white text-graphite shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)] transition active:scale-90"
        >
          {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 translate-x-px fill-current" />}
        </button>
      </div>
      <Link href={`/beats/${beat.slug}`} className="mt-2 block truncate font-display text-[15px] font-semibold hover:underline">
        {beat.title}
      </Link>
      <p className="truncate text-[13px] text-chrome-500">{beat.producers.map((p) => p.name).join(" & ")}</p>
      <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-graphite-700">
        <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
        {beat.genres[0]?.name}
        <span className="font-normal text-chrome-400">· {formatRelativeDay(beat.releasedAt)}</span>
      </p>
    </li>
  );
}

/** Nuove entrate: i beat del drop settimanale in uno scaffale orizzontale. */
export function NewArrivals({
  beats,
  daysToNextDrop,
}: {
  beats: BeatSummary[];
  daysToNextDrop: number;
}) {
  return (
    <section aria-labelledby="new-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-electric">Drop settimanale</p>
          <h2 id="new-title" className="font-display text-2xl font-semibold tracking-tight">
            Nuove entrate <span className="text-chrome-400">· {beats.length}</span>
          </h2>
        </div>
        <p className="flex items-center gap-2 text-[13px] font-normal text-chrome-500">
          <CalendarClock className="size-4" /> Nuovi beat ogni lunedì · prossimo drop{" "}
          {daysToNextDrop <= 1 ? "domani" : `tra ${daysToNextDrop} giorni`}
        </p>
      </div>
      {beats.length ? (
        <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
          {beats.map((b) => (
            <ArrivalCard key={b.id} beat={b} queue={beats} />
          ))}
        </ul>
      ) : (
        <p className="glass rounded-3xl p-6 text-sm text-chrome-500">Il drop di questa settimana arriva lunedì.</p>
      )}
    </section>
  );
}
