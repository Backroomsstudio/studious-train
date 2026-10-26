/**
 * Badge dell'artista (funzioni pure): ogni badge legge un numero dalla situazione
 * dell'artista (libreria, ascolti, salvati, livello, contatori) e si sblocca al traguardo.
 * Gli altri moduli alimentano i contatori con `recordAchievement` (lib/beats/achievements.ts).
 */

/** Contatori incrementati dalle altre funzioni: registratore demo, feat, confronto, condivisioni… */
export type AchievementKind = "demo" | "collab" | "compare" | "share" | "release" | "invite";

export interface BadgeInput {
  /** Beat sbloccati (licenze distinte per beat). */
  unlocked: number;
  saved: number;
  listenSeconds: number;
  /** Serie di giorni consecutivi più lunga. */
  longestStreak: number;
  nightOwl: boolean;
  /** Mesi da Resident (livello). */
  levelMonths: number;
  counters: Partial<Record<AchievementKind, number>>;
}

export type BadgeIcon = "key" | "disc" | "heart" | "clock" | "flame" | "moon" | "star" | "mic" | "users" | "ab" | "share" | "rocket" | "invite";

export interface BadgeDef {
  id: string;
  name: string;
  /** Cosa serve, scritto come invito ("Sblocca il tuo primo beat"). */
  goal: string;
  icon: BadgeIcon;
  target: number;
  /** Unità mostrata nella barra di avanzamento ("3/10 beat"). */
  unit?: string;
  /** Metallo della medaglia: oro per i traguardi lunghi. */
  gold?: boolean;
  value: (input: BadgeInput) => number;
}

export const BADGES: BadgeDef[] = [
  { id: "primo-sblocco", name: "Primo sblocco", goal: "Sblocca il tuo primo beat", icon: "key", target: 1, value: (i) => i.unlocked },
  { id: "collezionista", name: "Collezionista", goal: "Sblocca 10 beat", icon: "disc", target: 10, unit: "beat", gold: true, value: (i) => i.unlocked },
  { id: "swiper", name: "Swiper", goal: "Salva 5 beat", icon: "heart", target: 5, unit: "salvati", value: (i) => i.saved },
  { id: "maratoneta", name: "Maratoneta", goal: "Ascolta 10 ore di beat", icon: "clock", target: 10, unit: "ore", gold: true, value: (i) => Math.floor(i.listenSeconds / 3600) },
  { id: "in-serie", name: "In serie", goal: "Ascolta 7 giorni di fila", icon: "flame", target: 7, unit: "giorni", value: (i) => i.longestStreak },
  { id: "notturno", name: "Notturno", goal: "Ascolta dopo mezzanotte", icon: "moon", target: 1, value: (i) => (i.nightOwl ? 1 : 0) },
  { id: "resident-gold", name: "Resident Gold", goal: "6 mesi con noi", icon: "star", target: 6, unit: "mesi", gold: true, value: (i) => i.levelMonths },
  { id: "prima-demo", name: "Prima demo", goal: "Registra la tua prima demo", icon: "mic", target: 1, value: (i) => i.counters.demo ?? 0 },
  { id: "orecchio-fino", name: "Orecchio fino", goal: "Confronta due beat in A/B", icon: "ab", target: 1, value: (i) => i.counters.compare ?? 0 },
  { id: "ambasciatore", name: "Ambasciatore", goal: "Condividi il tuo Wrapped o la tessera", icon: "share", target: 1, value: (i) => i.counters.share ?? 0 },
  { id: "talent-scout", name: "Talent scout", goal: "Invita un artista", icon: "invite", target: 1, value: (i) => i.counters.invite ?? 0 },
  { id: "hit-uscita", name: "Hit uscita", goal: "Fai uscire il tuo pezzo", icon: "rocket", target: 1, gold: true, value: (i) => i.counters.release ?? 0 },
];

export interface BadgeState {
  def: BadgeDef;
  current: number;
  unlocked: boolean;
  /** Avanzamento 0–1. */
  progress: number;
}

export function computeBadges(input: BadgeInput, defs: BadgeDef[] = BADGES): BadgeState[] {
  return defs.map((def) => {
    const current = Math.max(0, Math.floor(def.value(input)));
    return { def, current: Math.min(current, def.target), unlocked: current >= def.target, progress: Math.min(1, current / def.target) };
  });
}

/** Badge appena sbloccati rispetto a un elenco già visto (per il toast "Badge sbloccato"). */
export function newlyUnlocked(states: BadgeState[], seen: string[]): BadgeState[] {
  const known = new Set(seen);
  return states.filter((s) => s.unlocked && !known.has(s.def.id));
}
