"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Zap } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { SPRING_FILL, SPRING_PRESS } from "@/lib/beats/motion";
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
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={level.color}
          strokeWidth="9"
          strokeLinecap="round"
          style={{ strokeDasharray: dash, filter: `drop-shadow(0 0 8px ${level.color})` }}
        />
      </svg>
      <div className="relative text-center leading-none">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">Livello</p>
        <p className="mt-1 font-display text-[1.6rem] font-black sm:text-3xl" style={{ color: level.color, textShadow: `0 0 18px ${level.color}88` }}>
          {level.name}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-white/60">
          <SpringNumber value={level.months} /> {level.months === 1 ? "mese" : "mesi"}
        </p>
      </div>
    </div>
  );
}

/**
 * La testata della Home: un corridoio dei Backrooms di notte. Neon fluorescente che si accende
 * (una volta sola), moquette calda sotto, il nome d'artista enorme e l'anello del livello.
 */
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
    <section aria-labelledby="home-title" className="home-hero relative isolate overflow-hidden rounded-[32px] text-white">
      {/* Strati: carta da parati gialla dei Backrooms, buio, neon, grana */}
      <div aria-hidden className="home-hero-wall absolute inset-0 -z-30" />
      <div aria-hidden className="absolute inset-0 -z-20 bg-[radial-gradient(120%_80%_at_20%_0%,rgba(255,214,102,0.32),transparent_55%),linear-gradient(180deg,rgba(14,12,6,0.55),#07080b_78%)]" />
      <div aria-hidden className="home-hero-neon absolute inset-x-8 top-0 -z-10 h-[3px] rounded-full sm:inset-x-16" />
      <div aria-hidden className="home-hero-grain absolute inset-0 -z-10 opacity-[0.07] mix-blend-overlay" />

      <div className="flex flex-col gap-6 p-5 pt-8 sm:flex-row sm:items-center sm:justify-between sm:p-8 sm:pt-10">
        <div className="min-w-0">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING_PRESS}
            className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#ffd866]"
          >
            {welcome ? "Benvenuto al Level 0" : "Bentornato al Level 0"}
          </motion.p>
          <motion.h1
            id="home-title"
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.05 }}
            className="home-hero-name mt-1 truncate font-display text-[clamp(3.2rem,15vw,7rem)] font-black leading-[0.9] tracking-[-0.04em]"
          >
            {name}
          </motion.h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {planName && (
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] ring-1 ring-white/15 backdrop-blur">
                {planName}
              </span>
            )}
            <motion.span whileTap={{ scale: 0.94 }} transition={SPRING_PRESS} className="inline-flex">
              <Link
                href="/beats/piani"
                onClick={() => sfx("coin")}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#ffd866] px-3.5 py-1.5 font-mono text-sm font-black text-[#1a1404] shadow-[0_0_24px_rgba(255,216,102,0.45)]"
              >
                <Zap className="size-4 fill-current" aria-hidden />
                <SpringNumber value={credits} /> crediti
              </Link>
            </motion.span>
          </div>
          <p className="mt-3 max-w-md text-sm text-white/65">
            {next
              ? `Ti mancano ${next.monthsToNext} ${next.monthsToNext === 1 ? "mese" : "mesi"} per diventare Resident ${next.name}.`
              : "Sei al livello massimo: grazie di essere con noi."}
            {level.perks[0] ? ` Ora hai: ${level.perks.slice(0, 2).join(", ").toLowerCase()}.` : ""}
          </p>
        </div>
        <LevelRing level={level} />
      </div>
    </section>
  );
}
