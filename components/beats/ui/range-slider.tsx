"use client";

import * as Slider from "@radix-ui/react-slider";
import { cn } from "@/lib/cn";

/** Slider Radix (tastiera, touch, RTL) con traccia cromata e riempimento blu elettrico. */
export function RangeSlider({
  value,
  onValueChange,
  onValueCommit,
  min,
  max,
  step = 1,
  label,
  className,
  thumbLabels,
}: {
  value: number[];
  onValueChange: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  className?: string;
  thumbLabels?: string[];
}) {
  return (
    <Slider.Root
      value={value}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      min={min}
      max={max}
      step={step}
      minStepsBetweenThumbs={1}
      aria-label={label}
      className={cn("relative flex h-6 w-full touch-none select-none items-center", className)}
    >
      <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-chrome-300 shadow-[inset_0_1px_2px_rgba(17,24,39,0.15)]">
        <Slider.Range className="absolute h-full rounded-full bg-gradient-to-r from-electric to-electric-cyan shadow-glow-sm" />
      </Slider.Track>
      {value.map((v, i) => (
        <Slider.Thumb
          key={i}
          aria-label={thumbLabels?.[i] ?? label}
          className="chrome-surface block size-5 rounded-full transition-transform hover:scale-110 focus-visible:scale-110 focus-visible:shadow-glow focus-visible:outline-none"
        >
          <span className="sr-only">{v}</span>
        </Slider.Thumb>
      ))}
    </Slider.Root>
  );
}
