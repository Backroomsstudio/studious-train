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
   * Fascia oraria prenotabile online (ore di Roma, 0–23): apertura e chiusura.
   * Ogni sessione deve iniziare dopo l'apertura e finire entro la chiusura.
   * Se la chiusura è minore o uguale all'apertura la fascia passa la mezzanotte e appartiene
   * al giorno in cui apre: con 14 → 2 il "venerdì" va da venerdì 14:00 a sabato 02:00.
   * Apertura = chiusura = 24 ore (studio aperto 24/7).
   */
  openHour: number;
  closeHour: number;
}

export const DEFAULT_RULES: BookingRules = {
  // Si prenota online almeno 24 ore prima dell'inizio.
  minNoticeMinutes: 24 * 60,
  horizonDays: 60,
  stepMinutes: 30,
  // Disponibilità online dalle 14:00 alle 02:00 della notte dopo: l'ultima sessione finisce alle 02:00.
  // Le altre ore si concordano su WhatsApp.
  openHour: 14,
  closeHour: 2,
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

/** Inizio e fine (UTC) della fascia prenotabile del giorno di Roma `day`. */
export function bookableWindow(day: string, rules: BookingRules = DEFAULT_RULES): { open: Date; close: Date } {
  const open = romeToUtc(day, rules.openHour);
  const close = rules.closeHour > rules.openHour ? romeToUtc(day, rules.closeHour) : romeToUtc(addDays(day, 1), rules.closeHour);
  return { open, close };
}

/**
 * Tutti gli inizi possibili nella fascia di un giorno di Roma, con il loro stato, in ordine di orario.
 * La fascia può passare la mezzanotte (es. 14:00 → 02:00): gli inizi dopo mezzanotte stanno nel giorno in cui la fascia apre.
 * Si propongono solo i blocchi che finiscono entro la chiusura.
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
  const { open, close } = bookableWindow(day, rules);
  const closeMs = close.getTime();
  const out: Slot[] = [];
  const labels = new Set<string>();

  // Si avanza in tempo reale (UTC): nei giorni del cambio d'ora non ci sono doppioni né ore mancanti.
  const starts: number[] = [];
  for (let startMs = open.getTime(); startMs + durationMinutes * 60000 <= closeMs; startMs += rules.stepMinutes * 60000) starts.push(startMs);
  // In più, subito dopo la fine di un impegno (es. beat 18:00–19:30 → master dalle 19:30): niente buchi di mezz'ora.
  const regular = new Set(starts);
  const extra = new Set<number>();
  for (const [, be] of busyMs) {
    if (be % (30 * 60000) !== 0 || regular.has(be) || be < open.getTime() || be + durationMinutes * 60000 > closeMs) continue;
    const endMs = be + durationMinutes * 60000;
    if (be >= earliest && be <= latest && !busyMs.some(([bs, b2]) => overlaps(be, endMs, bs, b2))) extra.add(be);
  }
  starts.push(...extra);
  starts.sort((a, b) => a - b);

  for (const startMs of starts) {
    const start = new Date(startMs);
    const label = romeTimeLabel(start);
    // La notte del ritorno all'ora solare un'ora "da orologio" si ripete: si propone una volta sola.
    if (labels.has(label)) continue;
    labels.add(label);
    const endMs = startMs + durationMinutes * 60000;

    let state: SlotState = "libero";
    if (startMs < earliest) state = "passato";
    else if (startMs > latest) state = "fuori-orizzonte";
    else if (busyMs.some(([bs, be]) => overlaps(startMs, endMs, bs, be))) state = "occupato";

    out.push({ start: start.toISOString(), end: new Date(endMs).toISOString(), label, state });
  }
  return out;
}

/** Controllo lato server: il blocco richiesto è ancora prenotabile? */
export function isBookable(startIso: string, durationMinutes: number, busy: Interval[], now: Date, rules: BookingRules = DEFAULT_RULES): boolean {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return false;
  const day = romeDay(start);
  // Un inizio dopo mezzanotte appartiene alla fascia del giorno prima.
  return [day, addDays(day, -1)].some((d) =>
    slotsForDay(d, durationMinutes, busy, now, rules).some((s) => s.start === start.toISOString() && s.state === "libero"),
  );
}

/**
 * Controllo lato server per un appuntamento che può iniziare anche alla mezz'ora
 * (es. la registrazione subito dopo un beat da 1 h 30 nello stesso giorno).
 * Deve stare tutto dentro la fascia prenotabile di un giorno, rispettare preavviso e orizzonte
 * e non toccare nessun impegno.
 */
export function fitsAt(startIso: string, durationMinutes: number, busy: Interval[], now: Date, rules: BookingRules = DEFAULT_RULES): boolean {
  const start = Date.parse(startIso);
  if (Number.isNaN(start) || durationMinutes <= 0) return false;
  if (start % (30 * 60000) !== 0) return false;
  const end = start + durationMinutes * 60000;
  if (start < now.getTime() + rules.minNoticeMinutes * 60000) return false;
  if (start > now.getTime() + rules.horizonDays * 24 * 60 * 60000) return false;
  const day = romeDay(new Date(start));
  const inWindow = [day, addDays(day, -1)].some((d) => {
    const { open, close } = bookableWindow(d, rules);
    return start >= open.getTime() && end <= close.getTime();
  });
  if (!inWindow) return false;
  return !busy.some((b) => overlaps(start, end, Date.parse(b.start), Date.parse(b.end)));
}
