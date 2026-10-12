/**
 * Google Analytics 4: si attiva SOLO se esiste NEXT_PUBLIC_GA_ID (formato G-XXXXXXXXXX).
 * Senza l'ID il sito non carica nulla e non mostra il banner: nessun cambiamento rispetto a prima.
 * Con l'ID, GA parte soltanto dopo il consenso esplicito del visitatore.
 */
export const GA_ID = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
export const analyticsEnabled = /^G-[A-Z0-9]{6,}$/.test(GA_ID);

export const CONSENT_KEY = "br-consent"; // "granted" | "denied"
export const CONSENT_RESET_EVENT = "br-consent-reset"; // dal link «Gestisci cookie» nel footer
