/**
 * Beat salvati ("Mi piace" della modalità Swipe): solo nel browser, come una lista dei desideri.
 * Si salva il riepilogo completo del beat, così la lista si mostra anche senza chiedere al server.
 */
import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BeatSummary } from "./types";
import { useHydrated } from "./use-hydrated";

export interface SavedBeat {
  beat: BeatSummary;
  savedAt: string;
}

interface SavedState {
  items: SavedBeat[];
  save: (beat: BeatSummary) => void;
  remove: (beatId: string) => void;
  toggle: (beat: BeatSummary) => boolean;
  clear: () => void;
}

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      items: [],
      save(beat) {
        if (get().items.some((i) => i.beat.id === beat.id)) return;
        set({ items: [{ beat, savedAt: new Date().toISOString() }, ...get().items].slice(0, 200) });
      },
      remove(beatId) {
        set({ items: get().items.filter((i) => i.beat.id !== beatId) });
      },
      /** Restituisce `true` se ora il beat è tra i salvati. */
      toggle(beat) {
        const has = get().items.some((i) => i.beat.id === beat.id);
        if (has) get().remove(beat.id);
        else get().save(beat);
        return !has;
      },
      clear: () => set({ items: [] }),
    }),
    { name: "backrooms-saved", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

/** Beat salvati, dal più recente. Vuoto finché la pagina non è idratata. */
export function useSavedBeats(): BeatSummary[] {
  const hydrated = useHydrated();
  const items = useSavedStore((s) => s.items);
  return useMemo(() => (hydrated ? items.map((i) => i.beat) : EMPTY), [hydrated, items]);
}

export function useIsSaved(beatId: string): boolean {
  const hydrated = useHydrated();
  const saved = useSavedStore((s) => s.items.some((i) => i.beat.id === beatId));
  return hydrated && saved;
}

const EMPTY: BeatSummary[] = [];
