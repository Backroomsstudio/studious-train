/**
 * Contatori dei traguardi, salvati nel browser. Le altre funzioni li incrementano con
 * `recordAchievement("demo")`, `recordAchievement("collab")`… e i badge si aggiornano da soli.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AchievementKind } from "./badges";
import { useHydrated } from "./use-hydrated";

export type { AchievementKind } from "./badges";

interface AchievementsState {
  counters: Partial<Record<AchievementKind, number>>;
  /** Primo raggiungimento di ogni traguardo (ISO). */
  firstAt: Partial<Record<AchievementKind, string>>;
  record: (kind: AchievementKind, amount?: number) => void;
}

export const useAchievements = create<AchievementsState>()(
  persist(
    (set, get) => ({
      counters: {},
      firstAt: {},
      record(kind, amount = 1) {
        const { counters, firstAt } = get();
        set({
          counters: { ...counters, [kind]: (counters[kind] ?? 0) + amount },
          firstAt: firstAt[kind] ? firstAt : { ...firstAt, [kind]: new Date().toISOString() },
        });
      },
    }),
    { name: "backrooms-traguardi", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

/** Da chiamare ovunque (anche fuori da React): "demo", "collab", "compare", "share", "release", "invite". */
export function recordAchievement(kind: AchievementKind, amount = 1): void {
  if (typeof window === "undefined") return;
  useAchievements.getState().record(kind, amount);
}

const EMPTY: Partial<Record<AchievementKind, number>> = {};

export function useAchievementCounters(): Partial<Record<AchievementKind, number>> {
  const hydrated = useHydrated();
  const counters = useAchievements((s) => s.counters);
  return hydrated ? counters : EMPTY;
}
