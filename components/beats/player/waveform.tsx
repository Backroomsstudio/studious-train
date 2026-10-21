"use client";

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * Forma d'onda da picchi pre-calcolati (JSON), disegnata in SVG: nitida a ogni densità di pixel,
 * leggera (nessun decoding audio lato client) e accessibile come slider.
 * Il riempimento del progresso è un clipPath, quindi aggiornarlo non ridisegna le barre.
 */
export function Waveform({
  peaks,
  progress,
  buffered = 0,
  loop,
  active = false,
  onSeek,
  label,
  valueText,
  className,
  height = 40,
  compact = false,
}: {
  peaks: number[];
  /** 0..1 */
  progress: number;
  buffered?: number;
  loop?: { start: number; end: number } | null;
  active?: boolean;
  onSeek?: (ratio: number) => void;
  label: string;
  valueText?: string;
  className?: string;
  height?: number;
  compact?: boolean;
}) {
  const clipId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const bars = peaks.length || 1;
  const gap = compact ? 0.35 : 0.3;

  const ratioAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(ratioAt(e.clientX));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const r = ratioAt(e.clientX);
    setHover(r);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onSeek(r);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    const map: Record<string, number> = { ArrowRight: progress + step, ArrowLeft: progress - step, Home: 0, End: 0.999 };
    if (e.key in map) {
      e.preventDefault();
      onSeek(Math.min(1, Math.max(0, map[e.key])));
    }
  };

  const shape = (
    <>
      {peaks.map((p, i) => {
        const h = Math.max(0.08, p) * 100;
        return <rect key={i} x={i + gap / 2} y={(100 - h) / 2} width={1 - gap} height={h} rx={0.35} />;
      })}
    </>
  );

  return (
    <div
      ref={ref}
      role={onSeek ? "slider" : "img"}
      aria-label={label}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      aria-valuetext={onSeek ? valueText : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      className={cn("group relative w-full touch-none select-none", onSeek && "cursor-pointer", className)}
      style={{ height }}
    >
      <svg viewBox={`0 0 ${bars} 100`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <clipPath id={`${clipId}-p`}>
            <rect x={0} y={0} width={bars * progress} height={100} />
          </clipPath>
          <clipPath id={`${clipId}-b`}>
            <rect x={0} y={0} width={bars * buffered} height={100} />
          </clipPath>
          <linearGradient id={`${clipId}-g`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0066ff" />
            <stop offset="1" stopColor="#00c8ff" />
          </linearGradient>
        </defs>
        {loop && (
          <rect
            x={bars * loop.start}
            width={bars * Math.max(0, loop.end - loop.start)}
            y={0}
            height={100}
            fill="rgba(0,102,255,0.1)"
            stroke="rgba(0,102,255,0.5)"
            strokeWidth={0.15}
          />
        )}
        <g fill="#d1d5db">{shape}</g>
        <g fill="#9ca3af" clipPath={`url(#${clipId}-b)`}>
          {shape}
        </g>
        <g
          fill={`url(#${clipId}-g)`}
          clipPath={`url(#${clipId}-p)`}
          style={active ? { filter: "drop-shadow(0 0 1.5px rgba(0,102,255,0.9))" } : undefined}
        >
          {shape}
        </g>
      </svg>
      {onSeek && hover !== null && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-electric/60"
          style={{ left: `${hover * 100}%` }}
        />
      )}
    </div>
  );
}
