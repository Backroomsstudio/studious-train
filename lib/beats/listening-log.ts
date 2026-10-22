/**
 * Registro locale degli ascolti, alimentato dal player globale.
 * `trackListening` si aggancia allo store del player (una sola volta, da `bindEngineToStore`):
 * conta il tempo reale di riproduzione, pause e buffering esclusi, e scrive su localStorage
 * a blocchi di qualche secondo (non a ogni fotogramma).
 */
import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  addListening,
  computeListeningStats,
  EMPTY_LOG,
  type ListenedBeat,
  type ListeningLog,
  type ListeningStats,
  PLAY_THRESHOLD_SEC,
} from "./listening-stats";
import { useHydrated } from "./use-hydrated";

interface ListeningLogState {
  log: ListeningLog;
  add: (beat: ListenedBeat, seconds: number, countPlay: boolean) => void;
  reset: () => void;
}

export const useListeningLog = create<ListeningLogState>()(
  persist(
    (set, get) => ({
      log: EMPTY_LOG,
      add: (beat, seconds, countPlay) => set({ log: addListening(get().log, beat, seconds, new Date(), { countPlay }) }),
      reset: () => set({ log: EMPTY_LOG }),
    }),
    { name: "backrooms-ascolti", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

/** Quanto serve dello stato del player (evita di importare il player qui). */
interface PlayerLike {
  current: ListenedBeat | null;
  playing: boolean;
  waiting: boolean;
}

interface Subscribable {
  getState: () => PlayerLike;
  subscribe: (listener: (state: PlayerLike) => void) => () => void;
}

const FLUSH_EVERY_SEC = 5;
/** Oltre questo intervallo tra due aggiornamenti (scheda in background) non si conta il tempo. */
const MAX_TICK_SEC = 2;

let unsubscribe: (() => void) | null = null;

/** Collega il registro al player. Idempotente; restituisce la funzione per scollegarlo. */
export function trackListening(player: Subscribable): () => void {
  if (unsubscribe) return unsubscribe;
  let beat: ListenedBeat | null = null;
  let lastTick: number | null = null;
  let pending = 0;
  let sinceStart = 0;
  let counted = false;

  const flush = () => {
    if (!beat || (pending <= 0 && !(sinceStart >= PLAY_THRESHOLD_SEC && !counted))) return;
    const countPlay = !counted && sinceStart >= PLAY_THRESHOLD_SEC;
    if (countPlay) counted = true;
    useListeningLog.getState().add(beat, Math.round(pending * 10) / 10, countPlay);
    pending = 0;
  };

  const onState = (s: PlayerLike) => {
    const now = performance.now();
    if (s.current?.id !== beat?.id) {
      flush();
      beat = s.current;
      sinceStart = 0;
      counted = false;
      lastTick = null;
    }
    if (!beat || !s.playing || s.waiting) {
      if (lastTick !== null) flush();
      lastTick = null;
      return;
    }
    if (lastTick !== null) {
      const delta = (now - lastTick) / 1000;
      if (delta > 0 && delta <= MAX_TICK_SEC) {
        pending += delta;
        sinceStart += delta;
      }
    }
    lastTick = now;
    if (pending >= FLUSH_EVERY_SEC || (!counted && sinceStart >= PLAY_THRESHOLD_SEC)) flush();
  };

  const stop = player.subscribe(onState);
  const onHide = () => document.visibilityState === "hidden" && flush();
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
  unsubscribe = () => {
    flush();
    stop();
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", flush);
    unsubscribe = null;
  };
  return unsubscribe;
}

/** Statistiche aggregate del registro (vuote fino all'idratazione). */
export function useListeningStats(year?: number): ListeningStats {
  const hydrated = useHydrated();
  const log = useListeningLog((s) => s.log);
  return useMemo(() => computeListeningStats(hydrated ? log : EMPTY_LOG, new Date(), year), [hydrated, log, year]);
}
