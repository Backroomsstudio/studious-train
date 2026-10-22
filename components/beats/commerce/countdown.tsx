"use client";

import { useEffect, useState } from "react";

/** Secondi mancanti a una data, aggiornati ogni secondo. */
export function useSecondsLeft(target: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}g ${pad(h)}h ${pad(m)}m`;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function Countdown({ to, className }: { to: string; className?: string }) {
  const left = useSecondsLeft(to);
  return (
    <span className={className} suppressHydrationWarning>
      {formatCountdown(left)}
    </span>
  );
}
