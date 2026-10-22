"use client";

import { useEffect } from "react";
import { prefersReducedMotion, usePrefs } from "@/lib/beats/prefs";
import { haptic, sfx } from "@/lib/beats/ui-feedback";
import { getEngine } from "../player/audio-engine";
import { usePlayer } from "../player/player-store";
import { listenForInstallPrompt } from "../settings/install-prompt";

/** Elementi che fanno "tic" quando li tocchi. */
const TAPPABLE = "button, a[href], [role=switch], [role=tab], [role=option], summary, label[for]";

/**
 * Effetti globali dell'esperienza, montati una volta nel layout del negozio (non disegna nulla):
 * - classi sul body: `lite` (modalità leggera) e `gyro`;
 * - pulsazione: `--beat` su <html> va da 1 a 0 a ogni battito del beat in riproduzione,
 *   `--beat-accent` è il colore del produttore; `data-beat-playing` su <html> mentre suona;
 * - `--sy` (scrollY in px) per la parallasse dei loghi;
 * - "tic" sui tocchi e vibrazione al play;
 * - ascolto del prompt di installazione dell'app.
 * Con movimento ridotto o modalità leggera pulsazione e parallasse restano spente.
 */
export function ExperienceEffects() {
  // Classi del body dalle preferenze.
  useEffect(() => {
    const apply = () => {
      const { lite, gyro } = usePrefs.getState();
      document.body.classList.toggle("lite", lite);
      document.body.classList.toggle("gyro", gyro && !lite);
    };
    apply();
    return usePrefs.subscribe(apply);
  }, []);

  // Pulsazione a tempo: un rAF solo mentre suona, fermo altrimenti.
  useEffect(() => {
    const root = document.documentElement;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let running = false;
    let wasPlaying = usePlayer.getState().playing;

    const stop = () => {
      cancelAnimationFrame(frame);
      running = false;
      root.style.setProperty("--beat", "0");
    };
    const step = () => {
      const beat = usePlayer.getState().current;
      const engine = getEngine();
      if (beat && engine) {
        const phase = ((engine.snapshot().position * beat.bpm) / 60) % 1;
        // Attacco immediato e coda esponenziale: si "sente" il colpo sulla cassa.
        root.style.setProperty("--beat", Math.exp(-phase * 5.5).toFixed(3));
      }
      frame = requestAnimationFrame(step);
    };
    const sync = () => {
      const { playing, current } = usePlayer.getState();
      const { pulse, lite } = usePrefs.getState();
      if (playing) root.dataset.beatPlaying = "";
      else delete root.dataset.beatPlaying;
      root.style.setProperty("--beat-accent", current?.producers[0]?.accentColor ?? "#0066ff");
      if (playing && !wasPlaying) haptic("tap");
      wasPlaying = playing;
      const should = playing && pulse && !lite && !motion.matches && Boolean(current);
      if (should && !running) {
        running = true;
        frame = requestAnimationFrame(step);
      } else if (!should && running) stop();
    };
    sync();
    const offPlayer = usePlayer.subscribe((s, prev) => {
      if (s.playing !== prev.playing || s.current?.id !== prev.current?.id) sync();
    });
    const offPrefs = usePrefs.subscribe(sync);
    motion.addEventListener("change", sync);
    return () => {
      offPlayer();
      offPrefs();
      motion.removeEventListener("change", sync);
      stop();
    };
  }, []);

  // Parallasse: scrollY in una variabile CSS, al massimo una volta per frame.
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const off = usePrefs.getState().lite || prefersReducedMotion();
        root.style.setProperty("--sy", off ? "0px" : `${Math.round(window.scrollY)}px`);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const offPrefs = usePrefs.subscribe(onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      offPrefs();
      cancelAnimationFrame(frame);
    };
  }, []);

  // "Tic" metallico su pulsanti e link (fase di cattura: arriva anche se il tasto ferma l'evento).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = (e.target as Element | null)?.closest?.(TAPPABLE);
      if (!el || el.closest("[data-no-sfx]") || (el as HTMLButtonElement).disabled) return;
      sfx("tap");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  useEffect(() => listenForInstallPrompt(), []);

  return null;
}
