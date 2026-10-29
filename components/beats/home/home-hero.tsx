"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect } from "react";
import { SPRING_FILL } from "@/lib/beats/motion";
import { sfx } from "@/lib/beats/ui-feedback";
import type { LevelInfo } from "@/lib/beats/types";

/** Numero che sale fino al valore con una molla (crediti, mesi). */
function SpringNumber({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  // Parte sempre dal valore vero: server e browser disegnano lo stesso numero, poi la molla riparte da 0.
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString("it-IT"));
  useEffect(() => {
    if (reduce) return mv.set(value);
    mv.set(0);
    const controls = animate(mv, value, SPRING_FILL);
    return () => controls.stop();
  }, [value, mv, reduce]);
  return <motion.span className={className}>{text}</motion.span>;
}

/** Anello del livello: si riempie con una molla fino a quanto manca al prossimo livello. */
function LevelRing({ level }: { level: LevelInfo }) {
  const reduce = useReducedMotion();
  const next = level.next;
  const progress = next ? level.months / (level.months + next.monthsToNext) : 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  const fill = useMotionValue(0);
  const dash = useTransform(fill, (p) => `${p * c} ${c}`);
  useEffect(() => {
    if (reduce) return fill.set(progress);
    const controls = animate(fill, progress, { ...SPRING_FILL, delay: 0.25 });
    return () => controls.stop();
  }, [progress, fill, reduce]);

  return (
    <div className="relative grid size-[8.5rem] shrink-0 place-items-center sm:size-40">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#e0306c"
          strokeWidth="8"
          strokeLinecap="round"
          style={{ strokeDasharray: dash }}
        />
      </svg>
      <div className="relative text-center leading-none">
        <p className="text-xs text-white/56">Livello</p>
        <p className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
          {level.name}
        </p>
        <p className="mt-2 text-xs text-white/64">
          <SpringNumber value={level.months} /> {level.months === 1 ? "mese" : "mesi"}
        </p>
      </div>
    </div>
  );
}

/** La testata della Home: nome d'artista, piano, crediti, prossimo livello e l'anello del livello. */
export function HomeHero({
  name,
  planName,
  credits,
  level,
  welcome,
}: {
  name: string;
  planName: string | null;
  credits: number;
  level: LevelInfo;
  welcome: boolean;
}) {
  const next = level.next;
  return (
    <section aria-labelledby="home-title" className="chrome-pink relative overflow-hidden rounded-[32px]">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="min-w-0">
          <p className="text-sm text-white/64">{welcome ? "Benvenuto" : "Bentornato"}</p>
          <motion.h1
            id="home-title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="mt-2 truncate font-display text-[clamp(2.75rem,12vw,5.5rem)] font-semibold leading-none tracking-tight text-white"
          >
            {name}
          </motion.h1>
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4 text-white">
            {planName && (
              <div>
                <dt className="text-xs text-white/56">Piano</dt>
                <dd className="mt-2 text-base font-semibold">{planName}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-white/56">Crediti</dt>
              <dd className="mt-2 text-base font-semibold tabular-nums">
                <Link href="/beats/piani" onClick={() => sfx("tap")} className="hover:underline">
                  <SpringNumber value={credits} />
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/56">Prossimo livello</dt>
              <dd className="mt-2 text-base font-semibold">
                {next ? `${next.name} tra ${next.monthsToNext} ${next.monthsToNext === 1 ? "mese" : "mesi"}` : "Livello massimo"}
              </dd>
            </div>
          </dl>
        </div>
        <LevelRing level={level} />
      </div>
    </section>
  );
}
