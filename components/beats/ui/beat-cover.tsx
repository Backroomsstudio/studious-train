import { cn } from "@/lib/cn";
import type { BeatSummary } from "@/lib/beats/types";

/**
 * Copertina: l'immagine del beat se c'è, altrimenti una lastra cromata con il colore del
 * produttore principale e l'iniziale del titolo (coerente con il "quadrato luminoso" del mockup).
 */
export function BeatCover({
  beat,
  size = "md",
  playing = false,
  className,
}: {
  beat: Pick<BeatSummary, "title" | "coverUrl" | "producers">;
  size?: "sm" | "md" | "lg" | "xl";
  playing?: boolean;
  className?: string;
}) {
  const accent = beat.producers[0]?.accentColor ?? "#0066ff";
  const dims = { sm: "size-11 rounded-xl", md: "size-14 rounded-2xl", lg: "size-20 rounded-2xl", xl: "size-36 rounded-[28px]" }[size];

  if (beat.coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- URL firmati/esterni: niente ottimizzazione Next
    return <img src={beat.coverUrl} alt="" className={cn(dims, "object-cover shadow-chrome", className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn("obsidian relative grid shrink-0 place-items-center overflow-hidden", dims, className)}
      style={{ boxShadow: playing ? `0 0 24px ${accent}88, inset 0 1px 0 rgba(255,255,255,0.1)` : undefined }}
    >
      <span
        className="absolute inset-[22%] rounded-[22%] border-2"
        style={{ borderColor: accent, boxShadow: `0 0 14px ${accent}, inset 0 0 10px ${accent}66` }}
      />
      <span className="relative font-display text-[0.95em] font-bold text-white/90" style={{ textShadow: `0 0 10px ${accent}` }}>
        {beat.title.charAt(0)}
      </span>
    </span>
  );
}
