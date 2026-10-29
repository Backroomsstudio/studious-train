/**
 * Lancio pubblico del negozio. Prima di `STORE_LAUNCH_AT` entra solo lo staff (i tre producer):
 * il pubblico vede la pagina "presto online" con la lista d'attesa. Funzioni pure, usate dal proxy,
 * dal layout e dalla registrazione.
 */

export type UserRole = "ARTIST" | "PRODUCER" | "ADMIN";

export const isStaffRole = (role: unknown): role is "PRODUCER" | "ADMIN" => role === "PRODUCER" || role === "ADMIN";

/** Data ISO (es. `2027-01-01T00:00:00+01:00`); vuota o non valida = negozio già aperto. */
export function parseLaunchAt(raw: string | undefined): Date | null {
  const value = raw?.trim();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function storeOpen(launchAt: Date | null, now = new Date()): boolean {
  return !launchAt || now.getTime() >= launchAt.getTime();
}

/** Raggiungibili da tutti anche prima del lancio: accesso, pagina d'attesa e servizi di sistema. */
const EXEMPT_PREFIXES = [
  "/beats/accedi",
  "/beats/presto",
  "/beats/manifest.webmanifest",
  "/api/auth/",
  "/api/webhooks/",
  "/api/cron/",
  "/api/waitlist",
  "/api/me",
  "/api/staff/",
];

export function gateExempt(pathname: string): boolean {
  return EXEMPT_PREFIXES.some((prefix) => {
    const base = prefix.replace(/\/$/, "");
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}

/**
 * Codici d'invito dello staff: `astral:CODICE,freya:CODICE,plugghe:CODICE`.
 * Chi si registra con uno di questi diventa admin e firma i beat di quel produttore.
 * Restituisce codice (maiuscolo) → slug del produttore.
 */
export function parseStaffInvites(raw: string | undefined): Map<string, string> {
  const invites = new Map<string, string>();
  for (const pair of (raw ?? "").split(",")) {
    const [slug, code] = pair.split(":").map((part) => part?.trim());
    if (slug && code && /^[A-Z0-9]{6,16}$/i.test(code)) invites.set(code.toUpperCase(), slug.toLowerCase());
  }
  return invites;
}

const LAUNCH_DATE = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });

/** "1° gennaio 2027": in italiano il primo del mese si scrive con l'ordinale. */
export function launchLabel(launchAt: Date): string {
  return LAUNCH_DATE.formatToParts(launchAt)
    .map((part) => (part.type === "day" && part.value === "1" ? "1°" : part.value))
    .join("");
}
