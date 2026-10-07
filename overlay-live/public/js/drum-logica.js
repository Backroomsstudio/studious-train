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

// La colonna mentre si sblocca la tappa `indice` (le tappe raggiunte erano `indice`, ora sono `indice + 1`):
//   prima   la finestra di prima con la tappa `indice` già sbloccata (verde, piena), per l'urto e il banner;
//   scorre  la stessa finestra con la tappa dopo accesa (attiva), un attimo prima che la colonna scorra;
//   entra   la voce che compare in fondo quando la finestra scorre di un posto (altrimenti null);
//   dopo    la finestra a fine scorrimento, con le tappe raggiunte aggiornate (quella normale).
// null se `indice` non è una tappa della scaletta.
export function colonnaSblocco(scaletta, indice, quante = 4) {
  if (!Number.isInteger(indice) || indice < 0 || indice >= scaletta.length) return null;
  const prima = finestraScaletta(scaletta, indice, quante).voci.map((v) => (v.indice === indice ? { ...v, stato: "sbloccata" } : v));
  const scorre = prima.map((v) => (v.indice === indice + 1 ? { ...v, stato: "attiva" } : v));
  const { inizio, voci: dopo } = finestraScaletta(scaletta, indice + 1, quante);
  const entra = inizio > prima[0].indice ? { ...dopo[dopo.length - 1], stato: "chiusa" } : null;
  return { prima, scorre, entra, dopo };
}

// Il titolo mentre si rivela con l'effetto «slot»: le prime `k · lettere` lettere (k da 0 a 1) sono quelle vere, le altre girano
// (una lettera a caso, maiuscola o minuscola come l'originale); spazi, cifre e segni restano com'è. `casuale` dà numeri in [0, 1).
const LETTERE_SLOT = "abcdefghijklmnopqrstuvwxyz";
const èLettera = (c) => /\p{L}/u.test(c);
export function titoloSlot(testo, k, casuale = Math.random) {
  const caratteri = [...testo];
  const ferme = Math.floor(Math.max(0, Number.isFinite(k) ? k : 0) * caratteri.filter(èLettera).length); // oltre 1 sono tutte ferme
  let viste = 0;
  return caratteri
    .map((c) => {
      if (!èLettera(c) || viste++ < ferme) return c;
      const girata = LETTERE_SLOT[Math.floor(casuale() * LETTERE_SLOT.length)];
      return c === c.toLowerCase() ? girata : girata.toUpperCase();
    })
    .join("");
}

// Quanto è piena la clessidra di una voce: le sbloccate sono piene, le chiuse vuote, l'attiva in proporzione ai Like. Durante
// uno sblocco la colonna può mostrare «attiva» una tappa che i Like hanno già superato (piena) o non ancora raggiunto (vuota).
export function livelloVoce(voce, d) {
  if (voce.stato === "sbloccata") return 1;
  if (voce.stato === "chiusa") return 0;
  if (d.attiva === voce.indice) return d.progresso;
  return d.attiva === null || d.attiva > voce.indice ? 1 : 0;
}

// ---------- Equalizzatore ----------

// Le 12 bande dalla regia (0…100) diventano `n` valori 0…1, interpolati in linea retta tra una banda e l'altra: il primo valore
// è la prima banda e l'ultimo l'ultima. Senza bande, silenzio; i numeri fuori scala si limitano.
export function interpolaBande(bande, n) {
  const ultimo = bande.length - 1;
  if (ultimo < 0) return Array(n).fill(0);
  return Array.from({ length: n }, (_, i) => {
    const posizione = n > 1 ? (i / (n - 1)) * ultimo : 0;
    const da = Math.floor(posizione);
    const a = Math.min(ultimo, da + 1);
    const valore = bande[da] + (bande[a] - bande[da]) * (posizione - da);
    return Math.min(1, Math.max(0, valore / 100));
  });
}

// Una barra rincorre il suo bersaglio: sale in fretta (costante di tempo 0,04 s) e scende piano (0,22 s). `dt` in secondi.
export function passoBarra(attuale, bersaglio, dt) {
  const costante = bersaglio > attuale ? 0.04 : 0.22;
  return attuale + (bersaglio - attuale) * (1 - Math.exp(-dt / costante));
}

// Il cappuccio bianco sopra la barra: sta sopra di lei quando sale e cade di 0,6 al secondo.
export const cappuccio = (attuale, valore, dt) => Math.max(valore, attuale - 0.6 * dt);

// Il «respiro» di una barra senza segnale: un'onda lenta e bassa tra 0,06 e 0,14, con una fase diversa per ogni barra.
export const respiro = (t, i, n) => 0.1 + 0.04 * Math.sin(t * 1.2 + (i / n) * Math.PI * 3);
