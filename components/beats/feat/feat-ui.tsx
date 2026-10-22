"use client";

import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/beats/feat";
import type { FeatArtist } from "@/lib/beats/types";
import { useMinuteClock } from "./use-feat";

/** Avatar dell'artista: iniziale su un disco del suo colore, con alone. */
export function ArtistAvatar({ artist, size = "md", className }: { artist: FeatArtist; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-display font-bold text-white",
        size === "sm" ? "size-9 text-sm" : "size-11 text-base",
        className,
      )}
      style={{ background: artist.color, boxShadow: `0 0 16px ${artist.color}66, inset 0 1px 0 rgba(255,255,255,0.35)` }}
    >
      {artist.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Livello Resident dell'artista (Bronze, Silver, Gold, Platinum). */
export function LevelPill({ level }: { level: FeatArtist["level"] }) {
  return (
    <span className="chrome-surface inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-none tracking-[0.08em] text-graphite-700">
      <span aria-hidden className="size-2 rounded-full ring-1 ring-graphite/15" style={{ background: level.color, boxShadow: `0 0 6px ${level.color}` }} />
      {level.name}
    </span>
  );
}

/** "5 minuti fa", aggiornato ogni minuto (il testo del server può differire di poco: niente avvisi). */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const now = useMinuteClock();
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {timeAgo(iso, now)}
    </time>
  );
}
