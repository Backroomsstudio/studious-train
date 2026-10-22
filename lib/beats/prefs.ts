"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Preferenze dell'esperienza, salvate sul dispositivo (localStorage).
 * Le leggono i suoni e le vibrazioni (ui-feedback.ts), la pulsazione a tempo, il logo 3D
 * e le animazioni allo scorrimento. Nessun dato personale: restano solo nel browser.
 */
export interface Prefs {
  /** Suoni sintetizzati dell'interfaccia (tap, monete, sblocchi). */
  sound: boolean;
  /** Vibrazione su sblocchi, crediti e play (dove il browser la supporta). */
  haptic: boolean;
  /** "Sito a tempo": logo, player e copertine pulsano sul BPM del beat in riproduzione. */
  pulse: boolean;
  /** Modalità leggera: niente sfocature pesanti né animazioni (telefoni meno recenti, batteria). */
  lite: boolean;
  /** Il logo 3D segue anche il giroscopio del telefono. */
  gyro: boolean;
}

export type PrefKey = keyof Prefs;

export const DEFAULT_PREFS: Prefs = { sound: true, haptic: true, pulse: true, lite: false, gyro: false };

interface PrefsState extends Prefs {
  set: <K extends PrefKey>(key: K, value: Prefs[K]) => void;
  toggle: (key: PrefKey) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PREFS,
      set: (key, value) => set({ [key]: value } as Partial<Prefs>),
      toggle: (key) => set({ [key]: !get()[key] } as Partial<Prefs>),
    }),
    {
      name: "backrooms-prefs",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sound, haptic, pulse, lite, gyro }) => ({ sound, haptic, pulse, lite, gyro }),
    },
  ),
);

/** Lettura fuori da React (handler, rAF). Sul server restituisce i valori predefiniti. */
export function getPrefs(): Prefs {
  return typeof window === "undefined" ? DEFAULT_PREFS : usePrefs.getState();
}

/** Movimento ridotto chiesto dal sistema operativo. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Animazioni decorative consentite: né movimento ridotto né modalità leggera. */
export function motionAllowed(): boolean {
  return !prefersReducedMotion() && !getPrefs().lite;
}
