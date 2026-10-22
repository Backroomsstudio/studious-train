"use client";

import { getPrefs } from "./prefs";

/**
 * Suoni e vibrazioni dell'interfaccia.
 *
 *   sfx("coin");  haptic("success");
 *
 * Suoni sintetizzati con Web Audio (nessun file da scaricare), volume basso, mai sopra la musica.
 * Sul server, senza Web Audio / vibrazione o con la preferenza spenta sono no-op silenziosi:
 * si possono chiamare ovunque senza controlli.
 */

export type SfxName = "tap" | "pop" | "coin" | "unlock" | "win" | "error";
export type HapticKind = "tap" | "select" | "success" | "warning" | "error" | "heavy";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let lastTap = 0;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    out = ctx.createGain();
    out.gain.value = 0.3;
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

/** Un'oscillazione con inviluppo percussivo: frequenza (con glissato opzionale), durata, forma, volume, ritardo. */
function tone(c: AudioContext, f: number, f2: number | null, d: number, type: OscillatorType, g: number, at = 0) {
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const e = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d * 0.55);
  e.gain.setValueAtTime(0, t);
  e.gain.linearRampToValueAtTime(g, t + 0.004);
  e.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(e);
  e.connect(out!);
  o.start(t);
  o.stop(t + d + 0.05);
}

/** Suona un effetto dell'interfaccia (se l'utente li ha attivi). */
export function sfx(name: SfxName): void {
  if (!getPrefs().sound) return;
  try {
    const c = audio();
    if (!c) return;
    switch (name) {
      case "tap": {
        // Click metallico: limitato a uno ogni 60 ms per non "grattare" sui doppi tocchi.
        const now = performance.now();
        if (now - lastTap < 60) return;
        lastTap = now;
        tone(c, 2650, null, 0.045, "sine", 0.18);
        tone(c, 4100, null, 0.025, "triangle", 0.06);
        break;
      }
      case "pop":
        tone(c, 880, 1760, 0.09, "sine", 0.22);
        break;
      case "coin":
        tone(c, 1318, null, 0.14, "triangle", 0.28);
        tone(c, 1976, null, 0.42, "triangle", 0.26, 0.08);
        break;
      case "unlock":
        // Colpo di 808 con un click in testa.
        tone(c, 170, 44, 0.8, "sine", 0.95);
        tone(c, 3400, null, 0.018, "square", 0.06);
        break;
      case "win":
        [523, 659, 784, 1047].forEach((f, i) => tone(c, f, null, 0.32, "triangle", 0.24, i * 0.07));
        tone(c, 110, 55, 0.5, "sine", 0.5);
        break;
      case "error":
        tone(c, 220, 150, 0.22, "sawtooth", 0.08);
        tone(c, 196, 140, 0.26, "sawtooth", 0.06, 0.1);
        break;
    }
  } catch {
    // Audio non disponibile (permessi, contesto chiuso): l'interfaccia resta muta.
  }
}

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 10,
  select: 15,
  success: [18, 40, 30],
  warning: [30, 60, 30],
  error: [40, 50, 40, 50, 40],
  heavy: [40, 60, 40, 60, 120],
};

/** Vibrazione breve (Android e browser che la supportano; su iPhone Safari non è disponibile). */
export function haptic(kind: HapticKind | number | number[] = "tap"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function" || !getPrefs().haptic) return;
  // Prima del primo tocco il browser blocca la vibrazione (e lo scrive in console): meglio non chiederla.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    navigator.vibrate(typeof kind === "string" ? PATTERNS[kind] : kind);
  } catch {
    // Alcuni browser lanciano se la pagina non ha ancora ricevuto un gesto dell'utente.
  }
}

/** Scorciatoia per gli esiti positivi più comuni: suono + vibrazione insieme. */
export function feedback(name: SfxName, kind: HapticKind = name === "error" ? "error" : name === "tap" ? "tap" : "success"): void {
  sfx(name);
  haptic(kind);
}
