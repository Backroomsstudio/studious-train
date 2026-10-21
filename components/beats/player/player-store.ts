"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BeatSummary } from "@/lib/beats/types";
import { getEngine } from "./audio-engine";

export const previewUrl = (beatId: string) => `/api/beats/${encodeURIComponent(beatId)}/preview`;

export interface VocalTake {
  url: string;
  name: string;
  peaks: number[];
  duration: number;
}

interface PlayerState {
  current: BeatSummary | null;
  queue: BeatSummary[];
  playing: boolean;
  waiting: boolean;
  position: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  rate: number;
  keepPitch: boolean;
  loop: { start: number; end: number } | null;
  vocal: VocalTake | null;
  vocalEnabled: boolean;
  vocalVolume: number;
  /** Ultimo ascolto (persistito) per "Riprendi da dove eri rimasto". */
  resume: { beat: BeatSummary; position: number; duration: number } | null;

  play: (beat: BeatSummary, queue?: BeatSummary[]) => void;
  toggle: (beat?: BeatSummary, queue?: BeatSummary[]) => void;
  pause: () => void;
  seek: (seconds: number) => void;
  next: () => void;
  previous: () => void;
  enqueue: (beat: BeatSummary) => void;
  removeFromQueue: (beatId: string) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setRate: (rate: number, keepPitch?: boolean) => void;
  /** Loop di N battute a partire dalla posizione corrente (calcolato dal BPM). */
  loopBars: (bars: number) => void;
  clearLoop: () => void;
  setVocal: (take: VocalTake | null) => void;
  setVocalEnabled: (enabled: boolean) => void;
  setVocalVolume: (volume: number) => void;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      current: null,
      queue: [],
      playing: false,
      waiting: false,
      position: 0,
      duration: 0,
      buffered: 0,
      volume: 0.9,
      muted: false,
      rate: 1,
      keepPitch: true,
      loop: null,
      vocal: null,
      vocalEnabled: true,
      vocalVolume: 0.9,
      resume: null,

      play(beat, queue) {
        const engine = getEngine();
        if (!engine) return;
        const resumeAt = get().resume?.beat.id === beat.id && get().current?.id !== beat.id ? get().resume!.position : 0;
        set({
          current: beat,
          queue: queue ?? (get().queue.some((b) => b.id === beat.id) ? get().queue : [beat]),
          loop: get().current?.id === beat.id ? get().loop : null,
        });
        engine.setLoop(get().loop);
        void engine.load(previewUrl(beat.id), resumeAt);
      },

      toggle(beat, queue) {
        const { current, playing } = get();
        if (beat && beat.id !== current?.id) return get().play(beat, queue);
        if (!current) return;
        const engine = getEngine();
        if (playing) engine?.pause();
        else if (engine) void engine.load(previewUrl(current.id), get().position);
      },

      pause: () => getEngine()?.pause(),

      seek(seconds) {
        getEngine()?.seek(seconds);
      },

      next() {
        const { queue, current } = get();
        const i = queue.findIndex((b) => b.id === current?.id);
        const upcoming = queue[i + 1];
        if (upcoming) get().play(upcoming, queue);
        else getEngine()?.pause();
      },

      previous() {
        const { queue, current, position } = get();
        // Come su Apple Music: dopo 3 secondi "indietro" riavvia il brano.
        if (position > 3) return get().seek(0);
        const i = queue.findIndex((b) => b.id === current?.id);
        const prev = queue[i - 1];
        if (prev) get().play(prev, queue);
        else get().seek(0);
      },

      enqueue(beat) {
        if (get().queue.some((b) => b.id === beat.id)) return;
        set({ queue: [...get().queue, beat] });
        if (!get().current) get().play(beat, [beat]);
      },

      removeFromQueue(beatId) {
        if (beatId === get().current?.id) return;
        set({ queue: get().queue.filter((b) => b.id !== beatId) });
      },

      setVolume(volume) {
        set({ volume, muted: volume === 0 });
        getEngine()?.setVolume(volume, volume === 0);
      },

      toggleMute() {
        const muted = !get().muted;
        set({ muted });
        getEngine()?.setVolume(get().volume, muted);
      },

      setRate(rate, keepPitch = get().keepPitch) {
        set({ rate, keepPitch });
        getEngine()?.setRate(rate, keepPitch);
      },

      loopBars(bars) {
        const { current, position, duration } = get();
        if (!current) return;
        const barSeconds = (60 / current.bpm) * 4;
        // Allinea l'inizio del loop alla battuta in corso.
        const start = Math.floor(position / barSeconds) * barSeconds;
        const end = Math.min(duration || start + bars * barSeconds, start + bars * barSeconds);
        const loop = { start, end };
        set({ loop });
        getEngine()?.setLoop(loop);
      },

      clearLoop() {
        set({ loop: null });
        getEngine()?.setLoop(null);
      },

      setVocal(take) {
        const old = get().vocal;
        if (old && old.url !== take?.url) URL.revokeObjectURL(old.url);
        set({ vocal: take, vocalEnabled: true });
        getEngine()?.setVocal(take?.url ?? null, { volume: get().vocalVolume, offset: 0, enabled: true });
      },

      setVocalEnabled(enabled) {
        set({ vocalEnabled: enabled });
        getEngine()?.setVocal(get().vocal?.url ?? null, { volume: get().vocalVolume, offset: 0, enabled });
      },

      setVocalVolume(volume) {
        set({ vocalVolume: volume });
        getEngine()?.setVocal(get().vocal?.url ?? null, { volume, offset: 0, enabled: get().vocalEnabled });
      },
    }),
    {
      name: "backrooms-player",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Solo preferenze e ultimo ascolto: il file vocale resta in memoria e non viene mai salvato.
      partialize: (s) => ({ volume: s.volume, muted: s.muted, keepPitch: s.keepPitch, vocalVolume: s.vocalVolume, resume: s.resume }),
    },
  ),
);

let bound = false;

/** Collega una sola volta gli eventi del motore allo store (chiamato dal dock). */
export function bindEngineToStore() {
  const engine = getEngine();
  if (!engine || bound) return;
  bound = true;
  const { volume, muted, rate, keepPitch } = usePlayer.getState();
  engine.setVolume(volume, muted);
  engine.setRate(rate, keepPitch);

  let lastSaved = 0;
  engine.subscribe((s) => {
    const state = usePlayer.getState();
    const patch: Partial<PlayerState> = {
      position: s.position,
      duration: s.duration,
      buffered: s.buffered,
      playing: s.playing,
      waiting: s.waiting,
    };
    // Salva il punto di ascolto al massimo una volta al secondo.
    if (state.current && Math.abs(s.position - lastSaved) >= 1) {
      lastSaved = s.position;
      patch.resume = { beat: state.current, position: s.position, duration: s.duration };
    }
    usePlayer.setState(patch);
  });
  engine.onEnded(() => usePlayer.getState().next());
}
