"use client";

import { motion } from "motion/react";
import { Gavel, Mic, Package, Play, Search, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { localAll } from "@/lib/beats/audio/local-store";
import { SPRING_PRESS } from "@/lib/beats/motion";
import { haptic, sfx } from "@/lib/beats/ui-feedback";
import type { BeatSummary } from "@/lib/beats/types";
import { useBadgeStates } from "../engage/badges-grid";
import { BeatCover } from "../ui/beat-cover";

/** Scheda di una zona: superficie piena della palette, si abbassa alla pressione con una molla. */
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
  tone: "brand" | "accent" | "dark" | "light";
  children?: ReactNode;
}) {
  const surface = {
    brand: "chrome-pink",
    accent: "bg-electric text-white",
    dark: "bg-graphite text-white",
    light: "glass text-graphite",
  }[tone];
  return (
    <motion.div whileTap={{ scale: 0.97 }} transition={SPRING_PRESS} className={cn("relative", className)}>
      <Link
        href={href}
        onClick={() => {
          sfx("tab");
          haptic("tap");
        }}
        className={cn("relative flex h-full min-h-40 flex-col justify-between gap-6 overflow-hidden rounded-[24px] p-4 sm:p-6", surface)}
      >
        {children}
        <Icon className="relative size-6" strokeWidth={1.75} aria-hidden />
        <span className="relative">
          <span className="block font-display text-xl font-semibold tracking-tight">{title}</span>
          <span className={cn("mt-2 block text-sm", tone === "light" ? "text-chrome-500" : "text-white/72")}>{stat}</span>
        </span>
      </Link>
    </motion.div>
  );
}

/** Tre copertine in fila nella scheda Swipe. */
function CoverRow({ beats }: { beats: BeatSummary[] }) {
  return (
    <span aria-hidden className="pointer-events-none absolute right-4 top-4 flex gap-2 sm:right-6 sm:top-1/2 sm:-translate-y-1/2">
      {beats.slice(0, 3).map((b) => (
        <BeatCover key={b.id} beat={b} size="lg" className="size-16! rounded-[16px]! sm:size-24! sm:rounded-[24px]!" />
      ))}
    </span>
  );
}

/**
 * Le zone dell'app in una griglia: ogni sezione con un dato vivo (aste aperte, demo salvate,
 * badge). La Home riassume tutto senza ripetere le pagine.
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
    <section aria-labelledby="zone-title" className="space-y-4">
      <h2 id="zone-title" className="sr-only">
        Le zone dell&apos;app
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:grid-rows-2">
        <ZoneTile href="/beats/swipe" icon={Play} title="Swipe" stat="Scorri i beat come i Reel" className="col-span-2 lg:row-span-2" tone="brand">
          <CoverRow beats={swipeBeats} />
        </ZoneTile>
        <ZoneTile href="/beats/registra" icon={Mic} title="Registra" tone="accent" stat={demos ? `${demos} ${demos === 1 ? "demo salvata" : "demo salvate"}` : "La tua voce sul beat"} />
        <ZoneTile href="/beats/cerca" icon={Search} title="Cerca" tone="light" stat="Producer, collab, generi" />
        <ZoneTile
          href="/beats/aste"
          icon={Gavel}
          title="Aste"
          tone="dark"
          stat={liveAuction ? "In diretta ora" : openAuctions ? `${openAuctions} ${openAuctions === 1 ? "asta aperta" : "aste aperte"}` : "Esclusive all'asta"}
        />
        <ZoneTile href="/beats/kit" icon={Package} title="Kit" tone="light" stat={kitCount ? `${kitCount} kit e preset` : "Sample e preset"} />
        <ZoneTile href="/beats/profilo" icon={UserRound} title="Profilo" tone="dark" stat={`${earned} di ${badges.length} badge · piano e crediti`} className="col-span-2" />
      </div>
    </section>
  );
}
