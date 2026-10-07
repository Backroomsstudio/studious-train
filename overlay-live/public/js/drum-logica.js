// Drum Challenge Live: parti pure della pagina e della regia (formato dei Like, finestra della colonna, testo della
// scaletta, tempi dello sblocco). Niente DOM: le usano la pagina, la regia e i test.

// 1234 → «1.234», 12480 → «12.480»: i punti delle migliaia anche sotto i 10.000.
export const formattaLike = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Il bersaglio di un modulo: 12000 → «12K», 1000000 → «1M», altrimenti il numero con i punti (1500 → «1.500»).
export function etichettaLike(n) {
  if (n > 0 && n % 1_000_000 === 0) return `${n / 1_000_000}M`;
  if (n > 0 && n % 1000 === 0) return `${n / 1000}K`;
  return formattaLike(n);
}

// I moduli della colonna: l'ultima tappa sbloccata (se c'è), l'attiva e le successive; con tutte sbloccate, le ultime.
// `raggiunte` = quante tappe sono sbloccate (se sono tutte, nessuna è attiva).
export function finestraScaletta(scaletta, raggiunte, quante = 4) {
  const lunghezza = scaletta.length;
  const attiva = raggiunte < lunghezza ? raggiunte : null;
  const ultimo = Math.max(0, lunghezza - quante); // da qui in poi la finestra arriverebbe oltre la fine
  const inizio = Math.max(0, Math.min(attiva !== null ? Math.max(0, raggiunte - 1) : lunghezza - quante, ultimo));
  const voci = scaletta.slice(inizio, inizio + quante).map((tappa, i) => {
    const indice = inizio + i;
    return { indice, like: tappa.like, titolo: tappa.titolo, stato: indice < raggiunte ? "sbloccata" : indice === attiva ? "attiva" : "chiusa" };
  });
  return { inizio, voci };
}

// Il campo della regia: una riga «like | titolo» per tappa (titolo vuoto → «like |»). leggiScaletta (lib/drum.mjs) lo rilegge.
export const testoScaletta = (scaletta) => scaletta.map((t) => (t.titolo ? `${t.like} | ${t.titolo}` : `${t.like} |`)).join("\n");

// Una tappa raggiunta senza titolo si legge «Brano a sorpresa».
export const titoloBrano = (titolo) => titolo || "Brano a sorpresa";

// La sequenza di sblocco (ms dall'inizio): urto e lampo, titolo che si rivela, banner (dopo 1 s, per 3,2 s), la colonna
// che scorre di un posto (a 1,8 s, per 0,7 s). Tutto finito a 2,6 s; il banner resta fino a 4,2 s.
export const SBLOCCO = { urtoMs: 0, titoloMs: 150, bannerDopoMs: 1000, bannerDurataMs: 3200, scorriDopoMs: 1800, scorriDurataMs: 700, totaleMs: 2600 };
