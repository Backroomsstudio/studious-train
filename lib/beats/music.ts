/**
 * Tonalità e ruota Camelot.
 * Una tonalità è (tonica come pitch class 0-11, modo). Sulla ruota Camelot le minori sono "A",
 * le maggiori "B"; due tonalità sono compatibili per il mix se hanno lo stesso numero
 * (relativa maggiore/minore) o se sono adiacenti sulla stessa lettera (±1).
 */

export type KeyMode = "MAJOR" | "MINOR";

export interface MusicalKey {
  root: number;
  mode: KeyMode;
}

export const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

/** Numero Camelot indicizzato per pitch class. */
const CAMELOT_MAJOR = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1] as const;
const CAMELOT_MINOR = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10] as const;

export function keyName({ root, mode }: MusicalKey): string {
  return `${NOTE_NAMES[root]} ${mode === "MAJOR" ? "maj" : "min"}`;
}

export function camelotNumber({ root, mode }: MusicalKey): number {
  return (mode === "MAJOR" ? CAMELOT_MAJOR : CAMELOT_MINOR)[root];
}

export function camelotCode(key: MusicalKey): string {
  return `${camelotNumber(key)}${key.mode === "MAJOR" ? "B" : "A"}`;
}

function fromCamelot(num: number, mode: KeyMode): MusicalKey {
  const table = mode === "MAJOR" ? CAMELOT_MAJOR : CAMELOT_MINOR;
  return { root: table.indexOf(num as never), mode };
}

const wrap = (n: number) => ((n - 1 + 12) % 12) + 1;

/** La tonalità stessa, la relativa e le due vicine sulla ruota (4 tonalità). */
export function compatibleKeys(key: MusicalKey): MusicalKey[] {
  const n = camelotNumber(key);
  const other: KeyMode = key.mode === "MAJOR" ? "MINOR" : "MAJOR";
  return [key, fromCamelot(n, other), fromCamelot(wrap(n - 1), key.mode), fromCamelot(wrap(n + 1), key.mode)];
}

export function keyId({ root, mode }: MusicalKey): string {
  return `${root}${mode === "MAJOR" ? "M" : "m"}`;
}

export function parseKeyId(value: string): MusicalKey | null {
  const match = /^(\d{1,2})([Mm])$/.exec(value);
  if (!match) return null;
  const root = Number(match[1]);
  if (root < 0 || root > 11) return null;
  return { root, mode: match[2] === "M" ? "MAJOR" : "MINOR" };
}

/** Tutte le 24 tonalità ordinate come sulla ruota Camelot (1A, 1B, 2A, 2B …). */
export const ALL_KEYS: MusicalKey[] = Array.from({ length: 12 }, (_, i) => i + 1).flatMap((n) => [
  fromCamelot(n, "MINOR"),
  fromCamelot(n, "MAJOR"),
]);
