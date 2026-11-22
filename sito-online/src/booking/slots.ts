/**
 * Calcolo degli slot liberi. Lo studio è aperto 24/7: ogni ora piena (ora di Roma) è un possibile inizio.
 * Modulo puro, condiviso tra browser (per disegnare il calendario) e server (per ricontrollare prima di vendere).
 */

export const TIME_ZONE = "Europe/Rome";

export interface BookingRules {
  /** Preavviso minimo tra adesso e l'inizio della sessione, in minuti */
  minNoticeMinutes: number;
  /** Quanti giorni avanti si può prenotare */
  horizonDays: number;
  /** Passo tra un inizio e l'altro, in minuti */
  stepMinutes: number;
  /**
   * Primo e ultimo orario di inizio prenotabile online (ore di Roma, 0–23).
   * Se l'ultimo è minore del primo la fascia passa la mezzanotte (es. 10 → 2 = dalle 10:00 alle 02:00).
   * 0 → 23 = tutto il giorno (studio aperto 24/7).
   */
  firstStartHour: number;
  lastStartHour: number;
}

/** true se un inizio alle `hour` (ora di Roma) cade nella fascia prenotabile. */
export function inBookableHours(hour: number, rules: BookingRules): boolean {
  const a = rules.firstStartHour ?? 0;
  const b = rules.lastStartHour ?? 23;
  return a <= b ? hour >= a && hour <= b : hour >= a || hour <= b;
}

export const DEFAULT_RULES: BookingRules = {
  minNoticeMinutes: 3 * 60,
  horizonDays: 60,
  stepMinutes: 60,
  firstStartHour: 0,
  lastStartHour: 23,
};

export interface Interval {
  start: string; // ISO
  end: string; // ISO
}

export type SlotState = "libero" | "occupato" | "passato" | "fuori-orizzonte";

export interface Slot {
  start: string; // ISO UTC
  end: string; // ISO UTC
  /** Etichetta HH:MM in ora di Roma */
  label: string;
  state: SlotState;
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zonedParts(date: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out;
}

/** Scarto in minuti tra l'ora di Roma e UTC in un dato istante (+60 d'inverno, +120 d'estate). */
export function romeOffsetMinutes(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Istante UTC corrispondente a una data e un'ora "da orologio" di Roma. */
export function romeToUtc(day: string, hour: number, minute = 0): Date {
  const [y, m, d] = day.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, hour, minute);
  let guess = naive - romeOffsetMinutes(new Date(naive)) * 60000;
  // Seconda passata: corregge i giorni del cambio d'ora.
  guess = naive - romeOffsetMinutes(new Date(guess)) * 60000;
  return new Date(guess);
}

/** Data (YYYY-MM-DD) di Roma per un istante. */
export function romeDay(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function romeTimeLabel(date: Date): string {
  const p = zonedParts(date);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Somma giorni a una data YYYY-MM-DD (aritmetica di calendario, senza fusi). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Tutti gli inizi possibili di un giorno di Roma, con il loro stato.
 * Uno slot è "libero" solo se l'intero blocco [inizio, inizio + durata) non tocca nessun impegno.
 */
export function slotsForDay(
  day: string,
  durationMinutes: number,
  busy: Interval[],
  now: Date,
  rules: BookingRules = DEFAULT_RULES,
): Slot[] {
  const busyMs = busy.map((b) => [Date.parse(b.start), Date.parse(b.end)] as const);
  const earliest = now.getTime() + rules.minNoticeMinutes * 60000;
  const latest = now.getTime() + rules.horizonDays * 24 * 60 * 60000;
  const seen = new Set<number>();
  const out: Slot[] = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += rules.stepMinutes) {
    const start = romeToUtc(day, Math.floor(minutes / 60), minutes % 60);
    const startMs = start.getTime();
    // Nel giorno del cambio d'ora alcune ore "da orologio" non esistono o coincidono: si saltano i doppioni
    // e gli istanti che in realtà cadono in un altro giorno.
    if (seen.has(startMs) || romeDay(start) !== day) continue;
    seen.add(startMs);
    if (!inBookableHours(Math.floor(minutes / 60), rules)) continue;
    const endMs = startMs + durationMinutes * 60000;

    let state: SlotState = "libero";
    if (startMs < earliest) state = "passato";
    else if (startMs > latest) state = "fuori-orizzonte";
    else if (busyMs.some(([bs, be]) => overlaps(startMs, endMs, bs, be))) state = "occupato";

    out.push({ start: start.toISOString(), end: new Date(endMs).toISOString(), label: romeTimeLabel(start), state });
  }
  return out;
}

/** Controllo lato server: il blocco richiesto è ancora prenotabile? */
export function isBookable(startIso: string, durationMinutes: number, busy: Interval[], now: Date, rules: BookingRules = DEFAULT_RULES): boolean {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return false;
  const day = romeDay(start);
  return slotsForDay(day, durationMinutes, busy, now, rules).some((s) => s.start === start.toISOString() && s.state === "libero");
}
