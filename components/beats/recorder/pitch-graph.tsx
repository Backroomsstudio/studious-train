import { memo } from "react";
import type { PitchPoint } from "@/lib/beats/audio/autotune";
import { scalePitchClasses } from "@/lib/beats/audio/pitch";
import type { MusicalKey } from "@/lib/beats/music";

const H = 84;

/** Grafico dell'intonazione: cantato in grigio, corretto nel colore della traccia, righe = note della scala. */
export const PitchGraph = memo(function PitchGraph({ curve, color, musicalKey }: { curve: PitchPoint[]; color: string; musicalKey: MusicalKey }) {
  const sung = curve.filter((p) => p[1] !== null).map((p) => p[1] as number);
  if (!sung.length) {
    return <p className="rounded-2xl bg-[#0b0d11] px-4 py-6 text-center text-xs text-chrome-400">Nessuna nota intonata riconosciuta in questa take.</p>;
  }
  // Un minimo/massimo senza spread: le take lunghe hanno migliaia di frame
  let lo = Infinity;
  let hi = -Infinity;
  for (const m of sung) {
    if (m < lo) lo = m;
    if (m > hi) hi = m;
  }
  lo = Math.floor(lo) - 1;
  hi = Math.ceil(hi) + 1;
  const W = curve.length;
  const y = (m: number) => H - 4 - ((m - lo) / (hi - lo || 1)) * (H - 8);
  const pcs = scalePitchClasses(musicalKey);
  const lines: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(((m % 12) + 12) % 12)) lines.push(m);

  const path = (k: 1 | 2) => {
    let d = "";
    let pen = false;
    for (const p of curve) {
      const v = p[k];
      if (v === null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${p[0]} ${y(v).toFixed(1)} `;
      pen = true;
    }
    return d;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Intonazione: la voce originale in grigio, quella corretta in colore"
      className="block h-[84px] w-full rounded-2xl bg-[#0b0d11]"
    >
      {lines.map((m) => (
        <line
          key={m}
          x1={0}
          x2={W}
          y1={y(m)}
          y2={y(m)}
          stroke={`rgba(255,255,255,${((m % 12) + 12) % 12 === musicalKey.root ? 0.25 : 0.08})`}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={path(1)} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <path d={path(2)} fill="none" stroke={color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
});
