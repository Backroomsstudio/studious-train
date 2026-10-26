"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight, Gavel, Mic, Package, Play, Search, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { localAll } from "@/lib/beats/audio/local-store";
import { SPRING_PRESS } from "@/lib/beats/motion";
import { haptic, sfx } from "@/lib/beats/ui-feedback";
import type { BeatSummary } from "@/lib/beats/types";
import { useBadgeStates } from "../engage/badges-grid";
import { BeatCover } from "../ui/beat-cover";

/** Scheda di una zona: si inclina verso il dito/mouse con una molla e "affonda" alla pressione. */
function ZoneTile({
  href,
  icon: Icon,
  title,
  stat,
  className,
  tone,
  children,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  stat: ReactNode;
  className?: string;
  tone: string;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [5, -5]), { stiffness: 300, damping: 24 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-6, 6]), { stiffness: 300, damping: 24 });
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <motion.div
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      whileHover={reduce ? undefined : { y: -4 }}
      whileTap={{ scale: 0.965 }}
      transition={SPRING_PRESS}
      className={cn("zone-tile group relative", className)}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      <Link
        href={href}
        onClick={() => {
          sfx("tab");
          haptic("tap");
        }}
        className={cn("relative flex h-full min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-[26px] p-4 sm:p-5", tone)}
      >
        {children}
        <span className="relative flex items-start justify-between gap-2">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-md">
            <Icon className="size-5" aria-hidden />
          </span>
          <ArrowUpRight className="size-5 opacity-60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" aria-hidden />
        </span>
        <span className="relative">
          <span className="block font-display text-xl font-black tracking-tight sm:text-2xl">{title}</span>
          <span className="mt-0.5 block text-[13px] font-semibold opacity-80">{stat}</span>
        </span>
      </Link>
    </motion.div>
  );
}

/** Ventaglio di copertine che si apre al passaggio (scheda Swipe). */
function CoverFan({ beats }: { beats: BeatSummary[] }) {
  return (
    <span aria-hidden className="pointer-events-none absolute -right-6 bottom-3 flex sm:right-4 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
      {beats.slice(0, 3).map((b, i) => (
        <span
          key={b.id}
          className="zone-fan-card -ml-10 first:ml-0"
          style={{ "--i": i, zIndex: 3 - i } as React.CSSProperties}
        >
          <BeatCover beat={b} size="lg" className="size-24! rounded-[22px]! shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)] sm:size-32!" />
        </span>
      ))}
    </span>
  );
}

/**
 * Le zone dell'app in una griglia "bento": ogni sezione ha il suo colore e un dato vivo
 * (aste in diretta, demo salvate, badge). La Home riassume tutto senza ripetere le pagine.
 */
export function ZoneGrid({
  swipeBeats,
  openAuctions,
  liveAuction,
  kitCount,
  unlocked,
}: {
  swipeBeats: BeatSummary[];
  openAuctions: number;
  liveAuction: boolean;
  kitCount: number;
  unlocked: number;
}) {
  const [demos, setDemos] = useState<number | null>(null);
  const badges = useBadgeStates({ unlocked });
  const earned = badges.filter((b) => b.unlocked).length;
  useEffect(() => {
    void localAll("projects").then((p) => setDemos(p.length));
  }, []);

  return (
    <section aria-labelledby="zone-title" className="space-y-3">
      <h2 id="zone-title" className="sr-only">
        Le zone dell&apos;app
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:grid-rows-2">
        <ZoneTile
          href="/beats/swipe"
          icon={Play}
          title="Swipe"
          stat="Scorri i beat come i Reel"
          className="col-span-2 lg:row-span-2"
          tone="zone-swipe text-white"
        >
          <CoverFan beats={swipeBeats} />
        </ZoneTile>
        <ZoneTile href="/beats/registra" icon={Mic} title="Registra" tone="zone-rec text-white" stat={demos ? `${demos} ${demos === 1 ? "demo salvata" : "demo salvate"}` : "La tua voce sul beat"}>
          <span aria-hidden className="zone-rec-dot absolute right-12 top-6 size-2.5 rounded-full bg-white" />
        </ZoneTile>
        <ZoneTile href="/beats/cerca" icon={Search} title="Cerca" tone="zone-search text-graphite" stat="Producer, collab, generi" />
        <ZoneTile
          href="/beats/aste"
          icon={Gavel}
          title="Aste"
          tone="zone-auction text-[#1a1404]"
          stat={liveAuction ? "In diretta ora" : openAuctions ? `${openAuctions} ${openAuctions === 1 ? "asta aperta" : "aste aperte"}` : "Esclusive all'asta"}
        >
          {liveAuction && <span aria-hidden className="zone-live absolute right-12 top-[1.15rem] rounded-full bg-[#ff3b30] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">Live</span>}
        </ZoneTile>
        <ZoneTile href="/beats/kit" icon={Package} title="Kit" tone="zone-kit text-white" stat={kitCount ? `${kitCount} kit e preset` : "Sample e preset"} />
        <ZoneTile
          href="/beats/profilo"
          icon={UserRound}
          title="Profilo"
          tone="zone-profile text-white"
          stat={`${earned}/${badges.length} badge · piano e crediti`}
          className="col-span-2"
        />
      </div>
    </section>
  );
}
