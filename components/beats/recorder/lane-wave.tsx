import { memo } from "react";

/** Forma d'onda a barre per le corsie della timeline (SVG, si adatta in larghezza). */
export const LaneWave = memo(function LaneWave({ peaks, color }: { peaks: number[]; color: string }) {
  const n = peaks.length || 1;
  return (
    <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
      {peaks.map((p, i) => {
        const h = Math.max(0.06, p) * 80;
        return <rect key={i} x={i + 0.18} y={(100 - h) / 2} width={0.64} height={h} rx={0.3} fill={color} />;
      })}
    </svg>
  );
});
