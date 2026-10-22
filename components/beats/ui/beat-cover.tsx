import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { coverArtURI } from "@/lib/beats/cover-art";
import type { BeatSummary } from "@/lib/beats/types";

type Size = "sm" | "md" | "lg" | "xl";

const DIMS: Record<Size, string> = {
  sm: "size-11 rounded-xl",
  md: "size-14 rounded-2xl",
  lg: "size-20 rounded-2xl",
  xl: "size-36 rounded-[28px]",
};
const LETTER: Record<Size, string> = {
  sm: "text-[12px]",
  md: "text-[15px]",
  lg: "text-xl",
  xl: "text-[clamp(1.75rem,22cqw,3rem)]",
};

/**
 * Copertina: l'immagine del beat se c'è, altrimenti una copertina generativa disegnata dal beat
 * stesso (forma d'onda circolare, colori di produttore e genere, BPM e tonalità: vedi cover-art.ts).
 * Mentre suona respira a tempo con `--beat` (vedi store.css, blocco "Esperienza").
 */
export function BeatCover({
  beat,
  size = "md",
  playing = false,
  className,
}: {
  beat: Pick<BeatSummary, "title" | "coverUrl" | "producers"> & Partial<Pick<BeatSummary, "id" | "slug" | "bpm" | "key" | "peaks" | "genres">>;
  size?: Size;
  playing?: boolean;
  className?: string;
}) {
  const accent = beat.producers[0]?.accentColor ?? "#0066ff";
  const dims = DIMS[size];
  const playingStyle = playing ? ({ "--cover-glow": accent } as CSSProperties) : undefined;

  if (beat.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL firmati/esterni: niente ottimizzazione Next
      <img
        src={beat.coverUrl}
        alt=""
        data-beat-cover=""
        data-playing={playing || undefined}
        style={playingStyle}
        className={cn(dims, "object-cover shadow-chrome", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      data-beat-cover=""
      data-playing={playing || undefined}
      style={playingStyle}
      className={cn("relative grid shrink-0 place-items-center overflow-hidden bg-graphite [container-type:inline-size]", dims, className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG generato in memoria come data URI */}
      <img
        src={coverArtURI(beat, size === "sm" ? "lite" : "full")}
        alt=""
        draggable={false}
        decoding="async"
        className="absolute inset-0 size-full select-none"
      />
      {/* Riflesso cromato in alto, come le superfici del negozio */}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(160deg,rgba(255,255,255,0.16),transparent_38%)] ring-1 ring-inset ring-white/10" />
      <span
        className={cn("relative font-display font-bold leading-none text-white/95", LETTER[size])}
        style={{ textShadow: `0 0 10px ${accent}, 0 1px 2px rgba(0,0,0,0.6)` }}
      >
        {beat.title.charAt(0)}
      </span>
    </span>
  );
}
