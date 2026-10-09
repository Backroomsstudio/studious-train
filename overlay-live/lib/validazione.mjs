// Validatori condivisi: controllano testi, numeri, voti e comparse prima di scriverli nello stato.
// Solo funzioni pure, usate da lib/stato.mjs e lib/battle.mjs.
import { randomUUID } from "node:crypto";

export const ICONE = ["nero", "instagram", "tiktok", "instagram+tiktok", "twitch", "kick", "youtube", "spotify", "whatsapp", "dm", "sito", "microfono", "logo"];

export const oggetto = (x) => Boolean(x) && typeof x === "object" && !Array.isArray(x);

// Il corpo di un comando dalla regia deve essere un oggetto: altrimenti un errore chiaro, non un TypeError.
export function corpo(dati, nome) {
  if (!oggetto(dati)) throw new Error(`${nome}: forma non valida`);
  return dati;
}

export function testo(valore, max, nome, { obbligatorio = false } = {}) {
  if (typeof valore !== "string") throw new Error(`${nome}: serve un testo`);
  const pulito = valore.trim();
  if (obbligatorio && !pulito) throw new Error(`${nome}: non può essere vuoto`);
  if (pulito.length > max) throw new Error(`${nome}: al massimo ${max} caratteri`);
  return pulito;
}

export function numeroTra(valore, min, max, nome) {
  const n = typeof valore === "number" || (typeof valore === "string" && valore.trim()) ? Number(valore) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${nome}: tra ${min} e ${max}`);
  return Math.round(n);
}

export function siNo(valore, nome) {
  if (typeof valore !== "boolean") throw new Error(`${nome}: sì o no (true o false)`);
  return valore;
}

// Velocità della fascia social dei layout nuovi (drum, produzione, reaction, podcast), in pixel al secondo.
export const VELOCITA_MIN = 40;
export const VELOCITA_MAX = 160;
export const velocitaFascia = (valore) => numeroTra(valore, VELOCITA_MIN, VELOCITA_MAX, "Velocità della fascia (px/s)");

export const arrotonda = (x, cifre) => (x === null ? null : Math.round(x * 10 ** cifre) / 10 ** cifre);

export function normalizzaVoto(valore, { min = 0, max = 10 } = {}) {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(String(valore).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Il voto deve essere tra ${min} e ${max}`);
  return Math.round(n * 10) / 10;
}

// Accetta «@nome», «nome» o il link del profilo (instagram.com/nome/?hl=it): resta solo il nome, senza @.
export function pulisciInstagram(valore) {
  if (typeof valore !== "string") throw new Error("Instagram: serve un testo");
  const nome = valore
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "")
    .replace(/[/?#].*$/, "");
  if (nome.length > 30) throw new Error("Instagram: al massimo 30 caratteri");
  if (nome && !/^[a-z0-9._]+$/i.test(nome)) throw new Error("Instagram: solo lettere, numeri, punto e trattino basso (es. @nome.artista)");
  return nome;
}

// Elenco di comparse/pop-up (pannelli con icona, riga sopra, titolo e riga sotto): controllato voce per voce.
export function controllaComparse(lista, massimo, { elenco = "Comparse", voce = "Comparsa" } = {}) {
  if (!Array.isArray(lista)) throw new Error(`${elenco}: serve l'elenco`);
  if (lista.length > massimo) throw new Error(`${elenco}: al massimo ${massimo}`);
  return lista.map((c, i) => {
    const n = `${voce} ${i + 1}`;
    if (!oggetto(c)) throw new Error(`${n}: servono i testi`);
    if (!ICONE.includes(c.icona)) throw new Error(`${n}: icona sconosciuta`);
    const comparsa = {
      id: typeof c.id === "string" && c.id ? c.id.slice(0, 40) : randomUUID(),
      attiva: c.attiva !== false,
      icona: c.icona,
      sopra: testo(c.sopra ?? "", 40, `${n} (riga sopra)`),
      titolo: testo(c.titolo ?? "", 28, `${n} (titolo)`),
      sotto: testo(c.sotto ?? "", 60, `${n} (riga sotto)`),
    };
    if (comparsa.attiva && !comparsa.titolo) throw new Error(`${n}: manca il titolo`);
    return comparsa;
  });
}
