// Parti pure della pagina del Drum: formato dei Like, finestra della colonna, testo della scaletta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formattaLike, etichettaLike, finestraScaletta, testoScaletta, titoloBrano, colonnaSblocco, titoloSlot, livelloVoce, interpolaBande, passoBarra, cappuccio, respiro, SBLOCCO } from "../public/js/drum-logica.js";
import { posizioniGrani, STILI } from "../public/js/drum-clessidra.js";
import { scalettaPredefinita, leggiScaletta } from "../lib/drum.mjs";

test("formattaLike: i punti delle migliaia anche sotto 10.000", () => {
  assert.deepEqual([0, 7, 999, 1000, 1234, 12480, 500000, 1000000].map(formattaLike), ["0", "7", "999", "1.000", "1.234", "12.480", "500.000", "1.000.000"]);
  assert.equal(formattaLike(1234.6), "1.235", "arrotonda");
});

test("etichettaLike: 12K, 1M, oppure il numero con i punti", () => {
  assert.deepEqual([1000, 12000, 500000, 1000000, 2000000, 1500, 750, 0, 1001].map(etichettaLike), ["1K", "12K", "500K", "1M", "2M", "1.500", "750", "0", "1.001"]);
});

test("finestraScaletta: l'ultima sbloccata, l'attiva e le successive", () => {
  const scaletta = scalettaPredefinita();
  const stati = (f) => f.voci.map((v) => v.stato);
  const indici = (f) => f.voci.map((v) => v.indice);
  let f = finestraScaletta(scaletta, 0);
  assert.equal(f.inizio, 0);
  assert.deepEqual(stati(f), ["attiva", "chiusa", "chiusa", "chiusa"]);
  f = finestraScaletta(scaletta, 1);
  assert.deepEqual([f.inizio, stati(f)], [0, ["sbloccata", "attiva", "chiusa", "chiusa"]]);
  f = finestraScaletta(scaletta, 7);
  assert.equal(f.inizio, 6);
  assert.deepEqual(indici(f), [6, 7, 8, 9]);
  assert.deepEqual(stati(f), ["sbloccata", "attiva", "chiusa", "chiusa"]);
  assert.deepEqual(f.voci[1], { indice: 7, like: 12000, titolo: "", stato: "attiva" });
  f = finestraScaletta(scaletta, 36);
  assert.deepEqual([f.inizio, stati(f)], [33, ["sbloccata", "sbloccata", "sbloccata", "attiva"]]);
  f = finestraScaletta(scaletta, 37);
  assert.deepEqual([f.inizio, stati(f)], [33, ["sbloccata", "sbloccata", "sbloccata", "sbloccata"]], "con tutte sbloccate, le ultime 4");
  assert.deepEqual(indici(f), [33, 34, 35, 36]);
  f = finestraScaletta(scaletta, 35);
  assert.deepEqual([f.inizio, indici(f)], [33, [33, 34, 35, 36]], "la finestra non va oltre la fine");
});

test("finestraScaletta: scalette corte e quante diverso", () => {
  const corta = scalettaPredefinita().slice(0, 2);
  assert.equal(finestraScaletta(corta, 0, 4).voci.length, 2);
  assert.deepEqual(finestraScaletta(corta, 0, 4).voci.map((v) => v.stato), ["attiva", "chiusa"]);
  const tutte = finestraScaletta(corta, 2, 4);
  assert.deepEqual([tutte.inizio, tutte.voci.map((v) => v.stato)], [0, ["sbloccata", "sbloccata"]], "mai un inizio negativo");
  assert.deepEqual(finestraScaletta(corta, 1, 4).voci.map((v) => v.stato), ["sbloccata", "attiva"]);
  assert.equal(finestraScaletta(scalettaPredefinita(), 10, 3).voci.length, 3);
  assert.deepEqual(finestraScaletta(scalettaPredefinita(), 10, 3).voci.map((v) => v.indice), [9, 10, 11]);
});

test("testoScaletta: una riga per tappa e il giro con leggiScaletta", () => {
  const scaletta = scalettaPredefinita();
  scaletta[0].titolo = "Back in Black";
  scaletta[2].titolo = "Titolo con | barra";
  const testo = testoScaletta(scaletta);
  assert.equal(testo.split("\n").length, 37);
  assert.equal(testo.split("\n")[0], "1000 | Back in Black");
  assert.equal(testo.split("\n")[1], "2000 |", "titolo vuoto: solo «like |»");
  assert.deepEqual(leggiScaletta(testo), scaletta);
  assert.deepEqual(leggiScaletta(testoScaletta(scalettaPredefinita())), scalettaPredefinita());
});

test("titoloBrano: senza titolo è un brano a sorpresa", () => {
  assert.equal(titoloBrano(""), "Brano a sorpresa");
  assert.equal(titoloBrano(undefined), "Brano a sorpresa");
  assert.equal(titoloBrano("Billie Jean"), "Billie Jean");
});

test("SBLOCCO: i tempi della sequenza stanno insieme", () => {
  assert.ok(SBLOCCO.bannerDopoMs > SBLOCCO.urtoMs);
  assert.ok(SBLOCCO.scorriDopoMs + SBLOCCO.scorriDurataMs <= SBLOCCO.totaleMs);
  assert.ok(SBLOCCO.bannerDopoMs + SBLOCCO.bannerDurataMs > SBLOCCO.scorriDopoMs, "il banner è ancora su quando la colonna scorre");
  assert.deepEqual(SBLOCCO, { urtoMs: 0, titoloMs: 150, bannerDopoMs: 1000, bannerDurataMs: 3200, scorriDopoMs: 1800, scorriDurataMs: 700, totaleMs: 2600 });
});

const CAMPO = { larghezza: 264, altezza: 148, raggio: 7 };
const bordoAlto = (grani, raggio) => Math.min(...grani.map((g) => g.y)) - raggio;

test("clessidra: i grani a nido d'ape, dal basso, deterministici", () => {
  assert.deepEqual(posizioniGrani({ ...CAMPO, livello: 0 }), []);
  const pieno = posizioniGrani({ ...CAMPO, livello: 1 });
  assert.ok(pieno.length >= 150, `${pieno.length} grani`);
  assert.equal(pieno.length, 216, "12 righe da 18");
  for (const g of pieno) {
    assert.ok(g.x >= 7 && g.x <= 264 - 7 && g.y >= 7 && g.y <= 148 - 7, `centro fuori dai limiti: ${g.x}, ${g.y}`);
    assert.ok(Number.isInteger(g.colore) && g.colore >= 0 && g.colore < 5);
  }
  assert.deepEqual(posizioniGrani({ ...CAMPO, livello: 1 }), pieno, "stessi parametri, stesso risultato");
  assert.notDeepEqual(posizioniGrani({ ...CAMPO, livello: 1, seme: 8 }), pieno, "un altro seme mescola in modo diverso");
  assert.equal(new Set(pieno.map((g) => `${g.x}|${g.y}`)).size, pieno.length, "nessun posto occupato due volte");
  // nido d'ape: due grani non si sovrappongono mai e ogni grano della seconda riga poggia su due della prima a distanza 2·raggio
  let minima = Infinity;
  for (let i = 0; i < pieno.length; i++) for (let j = i + 1; j < pieno.length; j++) minima = Math.min(minima, Math.hypot(pieno[i].x - pieno[j].x, pieno[i].y - pieno[j].y));
  assert.ok(minima >= 14 - 0.001, `due grani si sovrappongono (distanza ${minima.toFixed(2)})`);
  const prima = pieno.filter((g) => Math.abs(g.y - 141) < 0.01);
  const seconda = pieno.filter((g) => Math.abs(g.y - (141 - 7 * Math.sqrt(3))) < 0.01);
  assert.deepEqual([prima.length, seconda.length], [18, 18]);
  for (const g of seconda) {
    const vicini = prima.filter((p) => Math.abs(Math.hypot(p.x - g.x, p.y - g.y) - 14) < 0.01);
    assert.equal(vicini.length, g.x + 7 <= 257 ? 2 : 1, `il grano ${g.x} poggia su ${vicini.length} grani`); // l'ultimo, al bordo, su uno solo
  }
});

test("clessidra: i grani posati non si spostano, il livello è la loro quantità", () => {
  const meta = posizioniGrani({ ...CAMPO, livello: 0.5 });
  const otto = posizioniGrani({ ...CAMPO, livello: 0.8 });
  assert.equal(meta.length, 108);
  assert.deepEqual(otto.slice(0, meta.length), meta, "quelli a 0,5 sono i primi di quelli a 0,8");
  assert.ok(Math.abs(bordoAlto(meta, 7) - 74) <= 13, `bordo alto ${bordoAlto(meta, 7)}`);
  for (const livello of [0.1, 0.3, 0.7, 0.9, 1]) {
    const atteso = 148 * (1 - livello);
    const trovato = bordoAlto(posizioniGrani({ ...CAMPO, livello }), 7);
    assert.ok(Math.abs(trovato - atteso) <= 14, `livello ${livello}: bordo ${trovato.toFixed(1)}, atteso ${atteso.toFixed(1)}`);
  }
  assert.deepEqual(posizioniGrani({ ...CAMPO, livello: 2 }), posizioniGrani({ ...CAMPO, livello: 1 }), "livello oltre 1: si limita a 1");
  assert.deepEqual(posizioniGrani({ ...CAMPO, livello: -1 }), [], "livello sotto 0: si limita a 0");
  assert.deepEqual(posizioniGrani({ ...CAMPO, livello: NaN }), [], "un livello che non è un numero vale 0");
  const sotto = posizioniGrani({ ...CAMPO, livello: 0.5 }).filter((g) => g.y < 74 - 7 - 13);
  assert.deepEqual(sotto, [], "nessun grano sopra la superficie");
});

test("clessidra: la sabbia ha grani piccoli e tanti, i colori seguono la tavolozza", () => {
  const sabbia = posizioniGrani({ larghezza: 264, altezza: 148, raggio: 2.5, livello: 1 });
  assert.ok(sabbia.length >= 1500, `${sabbia.length} grani`);
  for (const g of sabbia) assert.ok(g.x >= 2.5 && g.x <= 261.5 && g.y >= 2.5 && g.y <= 145.5);
  const colori = posizioniGrani({ ...CAMPO, livello: 1, colori: 3 });
  assert.deepEqual([...new Set(colori.map((g) => g.colore))].sort(), [0, 1, 2]);
  assert.deepEqual(Object.keys(STILI), ["perline", "sabbia"]);
  assert.deepEqual([STILI.perline.raggio, STILI.sabbia.raggio, STILI.perline.lucido, STILI.sabbia.lucido], [7, 2.5, true, false]);
  assert.equal(STILI.perline.colori.length, 5);
  assert.equal(STILI.sabbia.colori.length, 4);
});

// ---------- Sequenza di sblocco ----------
const dati = (voci) => voci.map((v) => [v.indice, v.stato]);

test("colonnaSblocco: la finestra di prima con la tappa già sbloccata, poi quella che scorre di un posto", () => {
  const scaletta = scalettaPredefinita();
  const c = colonnaSblocco(scaletta, 7);
  assert.deepEqual(dati(c.prima), [[6, "sbloccata"], [7, "sbloccata"], [8, "chiusa"], [9, "chiusa"]], "il modulo che si sblocca è già verde, i seguenti ancora chiusi");
  assert.deepEqual(c.prima[1], { indice: 7, like: 12000, titolo: "", stato: "sbloccata" });
  assert.deepEqual(dati(c.scorre), [[6, "sbloccata"], [7, "sbloccata"], [8, "attiva"], [9, "chiusa"]], "mentre scorre, la tappa dopo si accende");
  assert.deepEqual(c.entra, { indice: 10, like: 20000, titolo: "", stato: "chiusa" }, "entra in fondo la tappa che finora non si vedeva");
  assert.deepEqual(dati(c.dopo), [[7, "sbloccata"], [8, "attiva"], [9, "chiusa"], [10, "chiusa"]], "a fine scorrimento: l'ultima sbloccata in testa, l'attiva dopo");
  assert.deepEqual(c.dopo, finestraScaletta(scaletta, 8).voci, "è la finestra normale con le tappe raggiunte aggiornate");
});

test("colonnaSblocco: la prima tappa e le ultime, dove la finestra non scorre", () => {
  const scaletta = scalettaPredefinita();
  let c = colonnaSblocco(scaletta, 0);
  assert.deepEqual(dati(c.prima), [[0, "sbloccata"], [1, "chiusa"], [2, "chiusa"], [3, "chiusa"]]);
  assert.equal(c.entra, null, "dalla prima alla seconda tappa la finestra è la stessa");
  assert.deepEqual(dati(c.dopo), [[0, "sbloccata"], [1, "attiva"], [2, "chiusa"], [3, "chiusa"]]);
  c = colonnaSblocco(scaletta, 1);
  assert.deepEqual(c.entra?.indice, 4, "dalla seconda alla terza la finestra scorre");
  c = colonnaSblocco(scaletta, 35);
  assert.deepEqual(dati(c.scorre), [[33, "sbloccata"], [34, "sbloccata"], [35, "sbloccata"], [36, "attiva"]]);
  assert.equal(c.entra, null, "in fondo alla scaletta non c'è altro da far entrare");
  c = colonnaSblocco(scaletta, 36);
  assert.deepEqual(dati(c.prima), [[33, "sbloccata"], [34, "sbloccata"], [35, "sbloccata"], [36, "sbloccata"]], "l'ultima tappa: tutta la colonna verde");
  assert.deepEqual([c.scorre, c.dopo, c.entra], [c.prima, c.prima, null]);
});

test("colonnaSblocco: scalette corte, indici sbagliati e altri numeri di moduli", () => {
  const corta = scalettaPredefinita().slice(0, 2);
  const c = colonnaSblocco(corta, 0);
  assert.deepEqual([dati(c.prima), c.entra, dati(c.dopo)], [[[0, "sbloccata"], [1, "chiusa"]], null, [[0, "sbloccata"], [1, "attiva"]]]);
  for (const indice of [-1, 37, 1.5, NaN, "7", undefined, null]) assert.equal(colonnaSblocco(scalettaPredefinita(), indice), null, `indice ${String(indice)}`);
  assert.equal(colonnaSblocco([], 0), null);
  assert.deepEqual(colonnaSblocco(scalettaPredefinita(), 7, 3).prima.map((v) => v.indice), [6, 7, 8], "con tre moduli la finestra è di tre");
  assert.equal(colonnaSblocco(scalettaPredefinita(), 7, 3).entra?.indice, 9);
});

test("titoloSlot: le lettere girano e si fermano da sinistra, il resto non si muove", () => {
  const zero = () => 0;
  assert.equal(titoloSlot("Livin' on a Prayer", 1), "Livin' on a Prayer");
  assert.equal(titoloSlot("Livin' on a Prayer", 0, zero), "Aaaaa' aa a Aaaaaa", "senza lettere ferme: maiuscole e minuscole al loro posto, spazi e apostrofi fermi");
  assert.equal(titoloSlot("Livin' on a Prayer", 0.5, zero), "Livin' on a Aaaaaa", "metà delle 14 lettere sono già ferme: Livin' on");
  assert.equal(titoloSlot("Livin' on a Prayer", 0.99, zero).slice(0, 17), "Livin' on a Praye");
  assert.equal(titoloSlot("Brano a sorpresa", 2), "Brano a sorpresa", "oltre 1 si ferma al titolo");
  assert.equal(titoloSlot("Brano", -3, zero), "Aaaaa", "sotto 0 vale 0");
  assert.equal(titoloSlot("Brano", NaN, zero), "Aaaaa", "un valore che non è un numero vale 0");
  assert.equal(titoloSlot("", 0.5), "");
  assert.equal(titoloSlot("1999 · Prince", 0, zero), "1999 · Aaaaaa", "cifre e simboli non girano");
  for (let i = 0; i < 20; i++) {
    const testo = titoloSlot("Come Together – Beatles", 0.3);
    assert.equal(testo.length, "Come Together – Beatles".length);
    assert.match(testo, /^[A-Za-z ]+ – [A-Za-z]+$/u);
  }
  const accentato = titoloSlot("Perché", 0, zero);
  assert.equal(accentato, "Aaaaaa", "una lettera accentata gira come le altre");
});

test("livelloVoce: piena se sbloccata, vuota se chiusa, in proporzione ai Like se è quella attiva", () => {
  const voce = (indice, stato) => ({ indice, like: 1000, titolo: "", stato });
  const d = { attiva: 7, progresso: 0.7 };
  assert.equal(livelloVoce(voce(6, "sbloccata"), d), 1);
  assert.equal(livelloVoce(voce(8, "chiusa"), d), 0);
  assert.equal(livelloVoce(voce(7, "attiva"), d), 0.7);
  // durante uno sblocco la colonna può mostrare «attiva» una tappa che i Like hanno già superato (o non ancora raggiunto)
  assert.equal(livelloVoce(voce(5, "attiva"), d), 1, "già superata dai Like: piena");
  assert.equal(livelloVoce(voce(9, "attiva"), d), 0, "ancora lontana: vuota");
  assert.equal(livelloVoce(voce(36, "attiva"), { attiva: null, progresso: 1 }), 1, "tutte le tappe raggiunte: piena");
});

// ---------- Equalizzatore ----------
test("eq: matematica", () => {
  // interpolaBande: n valori 0…1 tra le 12 bande (0…100), estremi inclusi
  assert.deepEqual(interpolaBande(Array(12).fill(50), 40), Array(40).fill(0.5), "bande uguali: barre uguali");
  const zigzag = [0, 100, 0, 100, 0, 100, 0, 100, 0, 100, 0, 100];
  const barre = interpolaBande(zigzag, 40);
  assert.equal(barre.length, 40);
  assert.ok(barre.every((x) => x >= 0 && x <= 1), "sempre tra 0 e 1");
  assert.deepEqual([barre[0], barre[39]], [0, 1], "gli estremi sono la prima e l'ultima banda");
  assert.deepEqual(interpolaBande([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100], 12), [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1], "con tante barre quante le bande, sono le bande");
  const rampa = interpolaBande([0, 100], 5);
  assert.deepEqual(rampa, [0, 0.25, 0.5, 0.75, 1], "tra due bande la salita è lineare");
  assert.deepEqual(interpolaBande([40, 80], 1), [0.4], "una barra sola: la prima banda");
  assert.deepEqual(interpolaBande([], 3), [0, 0, 0], "senza bande: silenzio");
  assert.deepEqual(interpolaBande([250, -30], 2), [1, 0], "fuori scala: si limita a 0…1");

  // passoBarra: sale in fretta, scende piano
  assert.ok(passoBarra(0, 1, 0.1) > 0.9, `salita ${passoBarra(0, 1, 0.1)}`);
  assert.ok(passoBarra(1, 0, 0.1) > 0.5, `discesa ${passoBarra(1, 0, 0.1)}`);
  assert.ok(passoBarra(0, 1, 0.1) > 1 - passoBarra(1, 0, 0.1), "la salita è più rapida della discesa");
  assert.equal(passoBarra(0.4, 0.4, 0.1), 0.4, "già al bersaglio: ferma");
  assert.equal(passoBarra(0.2, 0.9, 0), 0.2, "senza tempo trascorso: ferma");
  assert.ok(Math.abs(passoBarra(0, 1, 0.04) - (1 - Math.exp(-1))) < 1e-9, "costante di tempo in salita 0,04 s");
  assert.ok(Math.abs(passoBarra(1, 0, 0.22) - Math.exp(-1)) < 1e-9, "costante di tempo in discesa 0,22 s");

  // cappuccio: segue la barra in alto e cade di 0,6 al secondo
  assert.ok(Math.abs(cappuccio(0.8, 0.2, 0.1) - 0.74) < 1e-9);
  assert.equal(cappuccio(0.8, 0.9, 0.1), 0.9);
  assert.equal(cappuccio(0.01, 0, 1), 0, "mai sotto zero");

  // respiro: lento e basso, tra 0,06 e 0,14, sfasato da una barra all'altra
  let minimo = Infinity;
  let massimo = -Infinity;
  for (let t = 0; t <= 20; t += 0.37) {
    for (let i = 0; i < 40; i++) {
      const r = respiro(t, i, 40);
      minimo = Math.min(minimo, r);
      massimo = Math.max(massimo, r);
    }
  }
  assert.ok(minimo >= 0.06 - 1e-9 && massimo <= 0.14 + 1e-9, `respiro tra ${minimo} e ${massimo}`);
  assert.ok(massimo - minimo > 0.06, "il respiro si muove davvero");
  assert.notEqual(respiro(1, 0, 40), respiro(1, 20, 40), "ogni barra ha la sua fase");
});
