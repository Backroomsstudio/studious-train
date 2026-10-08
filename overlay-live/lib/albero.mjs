// Tabellone ad albero della gara: disegna, dai risultati confermati della serata (la classifica), un tabellone a eliminazione
// diretta con le teste di serie al loro posto. È solo un disegno: nessuno scontro vero e nessuna regola in più. Funzione pura,
// senza I/O: il server la chiama a ogni stato.

const MASSIMO_ALBERO = 16;
const NOMI_TURNO = { 16: "Ottavi di finale", 8: "Quarti di finale", 4: "Semifinali", 2: "Finale" };

// Stesso ordine della classifica (`confronta` in lib/stato.mjs: totale più alto, poi chi è stato confermato prima; test/albero.test.mjs
// controlla che restino uguali). Qui non si importa da stato.mjs, così i due moduli non dipendono uno dall'altro.
const inOrdine = (a, b) => b.totale - a.totale || a.confermatoAlle - b.confermatoAlle;

// L'ordine delle teste di serie in un tabellone da `posti` (potenza di 2), a coppie di posti vicini: per 2 → [1, 2]; per 2n → per
// ogni testa s dell'ordine di n, [s, 2n + 1 − s]. Così la 1 e la 2 si incontrano solo in finale.
function ordineTeste(posti) {
  return posti === 2 ? [1, 2] : ordineTeste(posti / 2).flatMap((testa) => [testa, posti + 1 - testa]);
}

// Passa chi ha il totale più alto; a parità, chi è stato confermato prima (cioè chi ha il posto più basso in classifica).
// Contro un posto vuoto passa la testa di serie.
function chiVince(a, b) {
  if (!a || !b) return a ? "a" : b ? "b" : null;
  if (a.totale !== b.totale && Number.isFinite(a.totale - b.totale)) return a.totale > b.totale ? "a" : "b";
  return a.posto < b.posto ? "a" : "b";
}

// → null (meno di 2 risultati) oppure { dimensione, turni: [{ nome, partite: [{ a, b, vince }] }], esclusi }.
// I lati sono { id, titolo, artista, totale, posto } oppure null (posto vuoto); `vince` è "a", "b" o null. Si prendono i primi
// `massimo` risultati (al massimo 16: gli altri sono `esclusi`) e il tabellone si porta a 4, 8 o 16 posti con posti vuoti.
export function costruisciAlbero(risultati, { massimo = MASSIMO_ALBERO } = {}) {
  if (!Array.isArray(risultati) || risultati.length < 2) return null;
  const limite = Number.isInteger(massimo) ? Math.min(MASSIMO_ALBERO, Math.max(2, massimo)) : MASSIMO_ALBERO;
  const ordinati = [...risultati].sort(inOrdine);
  const presi = ordinati.slice(0, limite);
  let dimensione = 4;
  while (dimensione < presi.length) dimensione *= 2;

  const lato = (posto) => {
    const r = presi[posto - 1];
    return r ? { id: r.id, titolo: r.titolo, artista: r.artista, totale: r.totale, posto } : null;
  };
  const teste = ordineTeste(dimensione);
  let partite = [];
  for (let i = 0; i < teste.length; i += 2) partite.push({ a: lato(teste[i]), b: lato(teste[i + 1]) });

  const turni = [];
  for (let posti = dimensione; posti >= 2; posti /= 2) {
    for (const partita of partite) partita.vince = chiVince(partita.a, partita.b);
    turni.push({ nome: NOMI_TURNO[posti], partite });
    if (posti === 2) break;
    // il turno dopo mette di fronte i vincitori di due partite vicine
    const vincitore = (partita) => (partita.vince ? { ...partita[partita.vince] } : null);
    const giocate = partite;
    partite = [];
    for (let i = 0; i < giocate.length; i += 2) partite.push({ a: vincitore(giocate[i]), b: vincitore(giocate[i + 1]) });
  }
  return { dimensione, turni, esclusi: ordinati.length - presi.length };
}
