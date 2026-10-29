"use client";

import {
  Clock,
  Disc3,
  CalendarCheck,
  Heart,
  KeyRound,
  Lock,
  Mic,
  Moon,
  Send,
  Share2,
  Award,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { useAchievementCounters } from "@/lib/beats/achievements";
import { type BadgeIcon, type BadgeState, computeBadges } from "@/lib/beats/badges";
import { useListeningStats } from "@/lib/beats/listening-log";
import { useSavedBeats } from "@/lib/beats/saved";
import { useViewer } from "../providers";

const ICONS: Record<Exclude<BadgeIcon, "ab">, LucideIcon> = {
  key: KeyRound,
  disc: Disc3,
  heart: Heart,
  clock: Clock,
  flame: CalendarCheck,
  moon: Moon,
  star: Award,
  mic: Mic,
  users: Users,
  share: Share2,
  rocket: Send,
  invite: UserPlus,
};

/**
 * Stato dei badge dell'artista collegato: libreria (licenze del profilo), ascolti e salvati
 * locali, livello Resident, contatori dei traguardi. `unlocked` sostituisce il conteggio dal profilo.
 */
export function useBadgeStates(options: { unlocked?: number } = {}): BadgeState[] {
  const { data: viewer } = useViewer();
  const saved = useSavedBeats();
  const stats = useListeningStats();
  const counters = useAchievementCounters();
  const unlocked = options.unlocked ?? Object.keys(viewer?.owned ?? {}).length;
  const months = viewer?.level.months ?? 0;
  return useMemo(
    () =>
      computeBadges({
        unlocked,
        saved: saved.length,
        listenSeconds: stats.totalSeconds,
        longestStreak: stats.longestStreak,
        nightOwl: stats.nightOwl,
        levelMonths: months,
        counters,
      }),
    [unlocked, saved.length, stats.totalSeconds, stats.longestStreak, stats.nightOwl, months, counters],
  );
}

function Medal({ badge }: { badge: BadgeState }) {
  const { def, unlocked } = badge;
  const Icon = def.icon === "ab" ? null : ICONS[def.icon];
  return (
    <span
      aria-hidden
      className={cn(
        "badge-medal grid size-12 shrink-0 place-items-center rounded-2xl",
        unlocked ? (def.gold ? "badge-medal-gold" : "badge-medal-on") : "chrome-surface text-chrome-400",
      )}
    >
      {Icon ? <Icon className="size-6" /> : <span className="font-display text-sm font-semibold">A/B</span>}
    </span>
  );
}

/** Bacheca dei badge: sbloccati in colore, bloccati in cromo con barra di avanzamento. */
export function BadgesGrid({ unlocked, className, title = "I tuoi badge" }: { unlocked?: number; className?: string; title?: string }) {
  const badges = useBadgeStates({ unlocked });
  const done = badges.filter((b) => b.unlocked).length;
  return (
    <section aria-labelledby="badges-title" className={cn("space-y-4", className)}>
      <h2 id="badges-title" className="font-display text-xl font-semibold">
        {title}{" "}
        <span className="text-chrome-400" data-testid="badges-count">
          · {done}/{badges.length}
        </span>
      </h2>
      <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
        {badges.map((b) => (
          <li
            key={b.def.id}
            className={cn("glass flex min-w-0 items-center gap-4 rounded-2xl p-4", !b.unlocked && "opacity-80")}
            data-unlocked={b.unlocked || undefined}
          >
            <Medal badge={b} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate font-display text-[15px] font-semibold">
                {!b.unlocked && <Lock aria-label="Bloccato" className="size-3.5 shrink-0 text-chrome-400" />}
                <span className="truncate">{b.def.name}</span>
              </p>
              <p className="truncate text-xs text-chrome-500">{b.def.goal}</p>
              {!b.unlocked && b.def.target > 1 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-chrome-200">
                    <span className="block h-full rounded-full bg-electric" style={{ width: `${Math.round(b.progress * 100)}%` }} />
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-chrome-500">
                    {b.current}/{b.def.target}
                    {b.def.unit ? ` ${b.def.unit}` : ""}
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
