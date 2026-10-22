/**
 * Drop settimanale: i nuovi beat escono ogni lunedì. "Nuove entrate" sono i beat usciti
 * negli ultimi 7 giorni; il conto alla rovescia punta al prossimo lunedì.
 */

export const DROP_WEEKDAY = 1; // lunedì
export const NEW_WINDOW_DAYS = 7;
const DAY = 86_400_000;

export function isNewRelease(releasedAt: string | Date, now = new Date()): boolean {
  const t = new Date(releasedAt).getTime();
  return now.getTime() - t < NEW_WINDOW_DAYS * DAY && t <= now.getTime();
}

export function nextDrop(now = new Date()): Date {
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  const days = (DROP_WEEKDAY - next.getDay() + 7) % 7 || 7;
  next.setDate(next.getDate() + days);
  return next;
}

export function daysUntilNextDrop(now = new Date()): number {
  return Math.ceil((nextDrop(now).getTime() - now.getTime()) / DAY);
}

/** Etichetta della settimana di uscita: "Questa settimana", "Settimana scorsa", "3 settimane fa". */
export function releaseWeekLabel(releasedAt: string | Date, now = new Date()): string {
  const weeks = Math.floor((now.getTime() - new Date(releasedAt).getTime()) / (7 * DAY));
  if (weeks <= 0) return "Questa settimana";
  if (weeks === 1) return "Settimana scorsa";
  return `${weeks} settimane fa`;
}
