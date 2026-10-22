"use client";

import { create } from "zustand";

/**
 * "Installa l'app" (PWA). Chrome/Edge/Android emettono `beforeinstallprompt`: lo teniamo da parte
 * e lo mostriamo quando l'utente tocca "Installa". Safari su iPhone non lo emette mai: lì mostriamo
 * i passaggi "Condividi → Aggiungi alla schermata Home".
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "ios" | "android" | "desktop";

interface InstallState {
  event: BeforeInstallPromptEvent | null;
  installed: boolean;
}

export const useInstall = create<InstallState>(() => ({ event: null, installed: false }));

let listening = false;

/** Registra una sola volta gli ascoltatori (chiamato dagli effetti globali del negozio). */
export function listenForInstallPrompt() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  useInstall.setState({ installed: isStandalone() });
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    useInstall.setState({ event: e as BeforeInstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => useInstall.setState({ event: null, installed: true }));
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function installPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // iPadOS si presenta come Mac: lo riconosciamo dal touch.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** Apre il prompt nativo se disponibile; "unavailable" = mostra le istruzioni manuali. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const evt = useInstall.getState().event;
  if (!evt) return "unavailable";
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  useInstall.setState({ event: null, installed: outcome === "accepted" });
  return outcome;
}

// Il prompt può arrivare prima che React monti gli effetti: ci mettiamo in ascolto subito.
listenForInstallPrompt();
