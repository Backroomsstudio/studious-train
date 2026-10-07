// Livelli audio che la regia manda all'equalizzatore del Drum: 12 bande più un colpo (battuta rilevata), interi da 0 a 100.
// Solo funzioni pure: il server le usa per controllare ogni messaggio prima di ritrasmetterlo.
import { oggetto } from "./validazione.mjs";

export const BANDE_AUDIO = 12;

const livello = (n) => Math.min(100, Math.max(0, Math.round(n)));
const numero = (x) => typeof x === "number" && Number.isFinite(x);

// Il messaggio `audio` dalla regia → { b: 12 interi, c: intero } oppure null (forma sbagliata, valori non numeri finiti).
// I valori fuori scala si limitano a 0…100; senza `c` il colpo vale 0. Di tutto il resto del messaggio non resta nulla.
export function leggiAudio(msg) {
  if (!oggetto(msg) || !Array.isArray(msg.b) || msg.b.length !== BANDE_AUDIO) return null;
  if (!msg.b.every(numero)) return null;
  if (msg.c !== undefined && !numero(msg.c)) return null;
  return { b: msg.b.map(livello), c: msg.c === undefined ? 0 : livello(msg.c) };
}

// Un messaggio audio ogni `minMs` al massimo, per ogni connessione. `ora` in millisecondi, da un orologio che non torna
// indietro (performance.now()).
export class LimiteFrequenza {
  #minMs;
  #ultimo = -Infinity;

  constructor(minMs = 25) {
    this.#minMs = minMs;
  }

  permetti(ora) {
    if (ora - this.#ultimo < this.#minMs) return false;
    this.#ultimo = ora;
    return true;
  }
}
