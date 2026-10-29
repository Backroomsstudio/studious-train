"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const UNITS = [
  { label: "giorni", ms: 86_400_000 },
  { label: "ore", ms: 3_600_000 },
  { label: "minuti", ms: 60_000 },
  { label: "secondi", ms: 1000 },
] as const;

function parts(remaining: number) {
  let rest = Math.max(0, remaining);
  return UNITS.map((u) => {
    const value = Math.floor(rest / u.ms);
    rest -= value * u.ms;
    return { label: u.label, value };
  });
}

/** Conto alla rovescia all'apertura: parte dall'ora del server (niente differenze all'idratazione). */
export function Countdown({ to, serverNow, className }: { to: string; serverNow: number; className?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div role="timer" aria-label="Tempo all'apertura" className={cn("grid grid-cols-4 gap-2", className)}>
      {parts(target - now).map((p) => (
        <div key={p.label} className="rounded-2xl bg-white/10 px-2 py-4 text-center">
          <span className="block font-display text-3xl font-semibold tabular-nums sm:text-4xl">{p.value}</span>
          <span className="mt-2 block text-xs text-white/70">{p.label}</span>
        </div>
      ))}
    </div>
  );
}
