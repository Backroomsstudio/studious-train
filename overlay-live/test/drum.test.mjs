import { test } from "node:test";
import assert from "node:assert/strict";
import * as D from "../lib/drum.mjs";
import { testiBase } from "../lib/testi.mjs";

const nuovo = () => ({ drum: D.drumIniziale() });
const conLike = (s, tik, extra = {}) => (Object.assign(s.drum.like, { tiktokTotale: tik, ...extra }), s);
const sblocco = (indice, like, titolo = "") => ({ nome: "sbloccoDrum", dati: { indice, like, titolo } });
const errore = (fn) => {
  try {
    fn();
  } catch (e) {
    return e.message;
  }
  return null;
};

test("scaletta predefinita: 37 tappe", () => {
  const s = D.scalettaPredefinita();
  assert.equal(s.length, 37);
  assert.deepEqual(
    s.slice(0, 16).map((t) => t.like),
    [1000, 2000, 3000, 5000, 7000, 9000, 10000, 12000, 15000, 17000, 20000, 22000, 25000, 27000, 29000, 30000],
  );
  assert.equal(s[16].like, 32000);
  assert.equal(s.at(-1).like, 500000);
  for (let i = 1; i < s.length; i++) assert.ok(s[i].like > s[i - 1].like, `la tappa ${i} cresce`);
  assert.ok(s.every((t) => t.titolo === ""));
  assert.equal(D.MAX_TAPPE, 80);
  assert.deepEqual([...D.PASSI_FISSI, ...D.PASSI_ALTI], s.map((t) => t.like));
  assert.equal(D.PASSI_FISSI.length, 16);
  D.scalettaPredefinita()[0].titolo = "x";
  assert.equal(D.scalettaPredefinita()[0].titolo, "", "ogni chiamata dà una copia nuova");
});

test("partenza: forma del Drum", () => {
  const d = D.drumIniziale();
  assert.deepEqual(d, {
    like: { tiktokTotale: null, offset: 0, extra: 0 },
    annunciati: 0,
    scaletta: D.scalettaPredefinita(),
    brano: { titolo: "", artista: "" },
    ospite: { etichetta: "Artista ospite", handle: "", icona: "instagram" },
    priorita: { prefisso: "Dona un", slot: "Rosa", sopra: "Salta la coda · scegli tu il brano", icona: "rosa" },
    eq: { sensibilita: 100, stile: "barre", senzaSegnale: true },
    riempimento: "perline",
    velocita: 80,
    testi: testiBase("drum"),
  });
  d.scaletta[0].titolo = "x";
  d.like.extra = 5;
  const altro = D.drumIniziale();
  assert.equal(altro.scaletta[0].titolo, "", "due partenze non condividono nulla");
  assert.equal(altro.like.extra, 0);
});

test("leggiScaletta: righe «like | titolo»", () => {
  assert.deepEqual(D.leggiScaletta("1000 | Back in Black\r\n2.000 | Seven Nation Army\n\n5k |\n  7k | Titolo con | barra "), [
    { like: 1000, titolo: "Back in Black" },
    { like: 2000, titolo: "Seven Nation Army" },
    { like: 5000, titolo: "" },
    { like: 7000, titolo: "Titolo con | barra" },
  ]);
  assert.equal(D.leggiScaletta("12.500")[0].like, 12500);
  assert.equal(D.leggiScaletta("5K")[0].like, 5000);
  assert.equal(D.leggiScaletta("1.000.000")[0].like, 1000000);
  assert.deepEqual(D.leggiScaletta("100"), [{ like: 100, titolo: "" }]);
});

test("leggiScaletta: errori con il numero di riga", () => {
  assert.throws(() => D.leggiScaletta("1000\n500"), /Riga 2: i like devono crescere \(500 dopo 1000\)/);
  assert.throws(() => D.leggiScaletta("1000\n1000"), /devono crescere/);
  assert.throws(() => D.leggiScaletta("abc | x"), /Riga 1/);
  assert.throws(() => D.leggiScaletta("abc | x"), /«abc» non è un numero di like \(es\. 15000, 15\.000 o 15k\)/);
  assert.throws(() => D.leggiScaletta("1.00"), /Riga 1/);
  assert.throws(() => D.leggiScaletta("1,5k"), /Riga 1/);
  assert.throws(() => D.leggiScaletta("| senza numero"), /Riga 1/);
  assert.throws(() => D.leggiScaletta("0"), /da 1 a 1\.000\.000/);
  assert.throws(() => D.leggiScaletta("1000001"), /da 1 a 1\.000\.000/);
  assert.throws(() => D.leggiScaletta(`1000 | ${"x".repeat(61)}`), /Riga 1: titolo troppo lungo \(massimo 60 caratteri\)/);
  assert.equal(D.leggiScaletta(`1000 | ${"x".repeat(60)}`)[0].titolo.length, 60);
  assert.throws(() => D.leggiScaletta(Array.from({ length: 81 }, (_, i) => String((i + 1) * 10)).join("\n")), /al massimo 80 tappe/);
  assert.equal(D.leggiScaletta(Array.from({ length: 80 }, (_, i) => String((i + 1) * 10)).join("\n")).length, 80);
  assert.throws(() => D.leggiScaletta(""), /serve almeno una tappa/);
  assert.throws(() => D.leggiScaletta("  \n "), /serve almeno una tappa/);
  assert.throws(() => D.leggiScaletta("1000\n\n500"), /Riga 3/, "il numero è quello della riga nel campo, righe vuote comprese");
  assert.throws(() => D.leggiScaletta(null), /serve un testo/);
});

test("controllaScaletta: l'elenco già fatto", () => {
  assert.deepEqual(D.controllaScaletta([{ like: 1000, titolo: " A " }, { like: 2000, titolo: "" }]), [{ like: 1000, titolo: "A" }, { like: 2000, titolo: "" }]);
  const dentro = [{ like: 1000, titolo: "A", extra: 1 }];
  const fuori = D.controllaScaletta(dentro);
  assert.deepEqual(fuori, [{ like: 1000, titolo: "A" }]);
  assert.notEqual(fuori[0], dentro[0], "una copia: nessun campo in più e nessun oggetto condiviso");
  assert.throws(() => D.controllaScaletta([]), /serve almeno una tappa/);
  assert.throws(() => D.controllaScaletta("1000"), /Scaletta/);
  assert.throws(() => D.controllaScaletta(Array.from({ length: 81 }, (_, i) => ({ like: (i + 1) * 10, titolo: "" }))), /al massimo 80 tappe/);
  assert.throws(() => D.controllaScaletta([{ like: 2000, titolo: "" }, { like: 1000, titolo: "" }]), /devono crescere \(1000 dopo 2000\)/);
  assert.throws(() => D.controllaScaletta([{ like: 1000.5, titolo: "" }]), /da 1 a 1\.000\.000/);
  assert.throws(() => D.controllaScaletta([{ like: "1000", titolo: "" }]), /da 1 a 1\.000\.000/);
  assert.throws(() => D.controllaScaletta([{ like: 1000, titolo: 5 }]), /Scaletta/);
  assert.throws(() => D.controllaScaletta([{ like: 1000, titolo: "x".repeat(61) }]), /titolo troppo lungo/);
  assert.throws(() => D.controllaScaletta([null]), /Scaletta/);
  assert.throws(() => D.controllaScaletta([{ like: 1000, titolo: "" }, "boh"]), /Scaletta/);
  assert.equal(errore(() => D.controllaScaletta([{ like: 0, titolo: "" }])), "Scaletta: i like vanno da 1 a 1.000.000", "dall'elenco non c'è il numero di riga");
});

test("contati, tappe e progresso", () => {
  const s = nuovo();
  assert.equal(D.contati(s.drum), 0);
  assert.equal(D.tappeRaggiunte(s.drum), 0);
  assert.equal(D.indiceAttiva(s.drum), 0);
  assert.equal(D.progresso(s.drum), 0);
  conLike(s, 1500);
  assert.equal(D.contati(s.drum), 1500);
  assert.equal(D.tappeRaggiunte(s.drum), 1);
  assert.equal(D.indiceAttiva(s.drum), 1);
  assert.equal(D.progresso(s.drum), 0.5);
  conLike(s, 250);
  assert.equal(D.progresso(s.drum), 0.25);
  conLike(s, 1000);
  assert.equal(D.tappeRaggiunte(s.drum), 1, "una tappa è raggiunta anche con i like esatti");
  assert.equal(D.progresso(s.drum), 0, "partendo dalla tappa raggiunta, la successiva è a zero");
  conLike(s, 1500, { offset: 500 });
  assert.equal(D.contati(s.drum), 1000);
  assert.equal(D.tappeRaggiunte(s.drum), 1);
  conLike(s, 1500, { offset: 0, extra: -9999 });
  assert.equal(D.contati(s.drum), 0);
  conLike(s, 500000, { extra: 0 });
  assert.equal(D.indiceAttiva(s.drum), null);
  assert.equal(D.progresso(s.drum), 1);
  assert.equal(D.tappeRaggiunte(s.drum), 37);
});

test("registraLike: il totale sale e non scende mai", () => {
  const s = nuovo();
  D.registraLike(s, { totale: 100 });
  assert.equal(s.drum.like.tiktokTotale, 100);
  D.registraLike(s, { totale: 90 });
  assert.equal(s.drum.like.tiktokTotale, 100);
  D.registraLike(s, { totale: 150 });
  assert.equal(s.drum.like.tiktokTotale, 150);
  D.registraLike(s, { conteggio: 5 });
  assert.equal(s.drum.like.tiktokTotale, 155);
  D.nuovaConnessioneLike(s);
  assert.equal(s.drum.like.tiktokTotale, null);
  D.registraLike(s, { conteggio: 5 });
  assert.equal(s.drum.like.tiktokTotale, null, "senza un totale noto il conteggio non basta");
});

test("registraLike: i dati rotti non cambiano nulla", () => {
  const s = conLike(nuovo(), 100);
  for (const rotto of [null, undefined, 5, "boh", [], {}, { totale: "200" }, { totale: NaN }, { totale: -3 }, { totale: Infinity }, { totale: 1e300 }, { conteggio: -2 }, { conteggio: 0 }, { conteggio: "7" }, { conteggio: NaN }]) {
    D.registraLike(s, rotto);
    assert.equal(s.drum.like.tiktokTotale, 100, `ignorato: ${JSON.stringify(rotto)}`);
  }
  D.registraLike(s, { totale: 200.9 });
  assert.equal(s.drum.like.tiktokTotale, 200, "i totali sono interi");
  D.registraLike(s, { totale: 300, conteggio: 50 });
  assert.equal(s.drum.like.tiktokTotale, 300, "con il totale il conteggio non si somma");
});

test("registraLike: live nuova", () => {
  const s = nuovo();
  Object.assign(s.drum.like, { offset: 3000, tiktokTotale: null });
  D.registraLike(s, { totale: 200 });
  assert.equal(s.drum.like.offset, 0, "totale sotto l'offset: è una live nuova");
  assert.equal(s.drum.like.tiktokTotale, 200);
  const t = nuovo();
  Object.assign(t.drum.like, { offset: 100 });
  D.registraLike(t, { totale: 150 });
  assert.equal(t.drum.like.offset, 100);
  assert.equal(t.drum.like.tiktokTotale, 150);
  const u = nuovo();
  Object.assign(u.drum.like, { offset: 100, tiktokTotale: 150 });
  D.registraLike(u, { totale: 50 });
  assert.equal(u.drum.like.offset, 100, "a collegamento in corso l'offset non si tocca");
  assert.equal(u.drum.like.tiktokTotale, 150);
});

test("impostaLike", () => {
  const s = conLike(nuovo(), 5000);
  D.impostaLike(s, { imposta: 12000 });
  assert.equal(D.contati(s.drum), 12000);
  D.impostaLike(s, { aggiungi: 100 });
  assert.equal(D.contati(s.drum), 12100);
  D.impostaLike(s, { aggiungi: -50000 });
  assert.equal(D.contati(s.drum), 0);
  s.drum.annunciati = 5;
  D.impostaLike(s, { daOra: true });
  assert.deepEqual([s.drum.like.offset, s.drum.like.extra, s.drum.annunciati, D.contati(s.drum)], [5000, 0, 0, 0]);
  assert.throws(() => D.impostaLike(s, {}), /imposta, aggiungi o daOra/);
  assert.throws(() => D.impostaLike(s, { daOra: false }), /imposta, aggiungi o daOra/);
  assert.throws(() => D.impostaLike(s, null), /Like/);
  assert.throws(() => D.impostaLike(s, { imposta: -1 }));
  assert.throws(() => D.impostaLike(s, { imposta: 20000000 }));
  assert.throws(() => D.impostaLike(s, { aggiungi: 2000000 }));
  assert.throws(() => D.impostaLike(s, { imposta: "boh" }));
  assert.throws(() => D.impostaLike(s, { daOra: "sì" }));
  assert.deepEqual([s.drum.like.offset, s.drum.like.extra, D.contati(s.drum)], [5000, 0, 0], "gli errori non cambiano nulla");
  assert.throws(() => D.impostaLike(s, { daOra: true, imposta: -1 }));
  assert.equal(s.drum.like.offset, 5000);
  D.impostaLike(conLike(s, 5400), { daOra: true, imposta: 700 });
  assert.equal(D.contati(s.drum), 700, "daOra poi imposta");
});

test("impostaLike: senza totale e dopo una correzione al ribasso", () => {
  const s = nuovo();
  D.impostaLike(s, { imposta: 2500 });
  assert.equal(D.contati(s.drum), 2500, "anche con TikTok non collegato");
  D.impostaLike(s, { aggiungi: -400 });
  assert.equal(D.contati(s.drum), 2100);
  const t = conLike(nuovo(), 5000);
  D.impostaLike(t, { aggiungi: -50000 });
  assert.equal(D.contati(t.drum), 0);
  D.impostaLike(t, { aggiungi: 100 });
  assert.equal(D.contati(t.drum), 100, "la correzione parte dal valore mostrato: nessun debito nascosto");
});

test("annunci: un evento per salto, silenzio al ribasso", () => {
  const s = nuovo();
  conLike(s, 1500);
  assert.deepEqual(D.controllaSblocchi(s), [sblocco(0, 1000)]);
  assert.equal(s.drum.annunciati, 1);
  assert.deepEqual(D.controllaSblocchi(s), []);
  conLike(s, 6000);
  assert.deepEqual(D.controllaSblocchi(s), [sblocco(3, 5000)], "un salto di più tappe annuncia solo la più alta");
  assert.equal(s.drum.annunciati, 4);
  conLike(s, 2500);
  assert.deepEqual(D.controllaSblocchi(s), [], "al ribasso nessun evento");
  assert.equal(s.drum.annunciati, 2);
  conLike(s, 3000);
  assert.deepEqual(D.controllaSblocchi(s), [sblocco(2, 3000)], "risalendo la tappa si annuncia di nuovo");
  s.drum.scaletta[4].titolo = "Seven Nation Army";
  conLike(s, 7000);
  assert.deepEqual(D.controllaSblocchi(s), [sblocco(4, 7000, "Seven Nation Army")], "il titolo scritto nella tappa arriva con l'evento");
  conLike(s, 500000);
  assert.deepEqual(D.controllaSblocchi(s), [sblocco(36, 500000)], "con tutte le tappe raggiunte l'ultima");
  assert.equal(s.drum.annunciati, 37);
  assert.deepEqual(D.controllaSblocchi(s), []);
});

test("annunci: riavvio con annunciati già pari alle tappe e live senza Like", () => {
  const s = conLike(nuovo(), 12500);
  s.drum.annunciati = 8;
  assert.deepEqual(D.controllaSblocchi(s), [], "stato salvato già allineato: nessuno sblocco ripetuto");
  const vuoto = nuovo();
  assert.deepEqual(D.controllaSblocchi(vuoto), []);
  assert.equal(vuoto.drum.annunciati, 0);
});

test("impostaScaletta", () => {
  const s = conLike(nuovo(), 6000);
  s.drum.annunciati = 4;
  D.impostaScaletta(s, { testo: "100\n1000" });
  assert.deepEqual(s.drum.scaletta, [{ like: 100, titolo: "" }, { like: 1000, titolo: "" }]);
  assert.equal(s.drum.annunciati, 2);
  assert.deepEqual(D.controllaSblocchi(s), [], "dopo il cambio della scaletta si riallinea in silenzio");
  D.impostaScaletta(s, { testo: "1000 | A\n2000 | B" });
  D.impostaScaletta(s, { predefinita: true });
  assert.equal(s.drum.scaletta.length, 37);
  assert.equal(s.drum.scaletta[0].titolo, "A");
  assert.equal(s.drum.scaletta[1].titolo, "B");
  assert.equal(s.drum.scaletta[2].titolo, "");
  assert.equal(s.drum.annunciati, 4);
  const prima = structuredClone(s.drum);
  assert.throws(() => D.impostaScaletta(s, { testo: "1000\n500" }), /Riga 2/);
  assert.deepEqual(s.drum, prima, "un errore non cambia nulla");
  assert.throws(() => D.impostaScaletta(s, {}), /testo o predefinita/);
  assert.throws(() => D.impostaScaletta(s, { testo: "1000", predefinita: true }), /testo o predefinita/);
  assert.throws(() => D.impostaScaletta(s, null), /Scaletta/);
  assert.throws(() => D.impostaScaletta(s, { testo: 5 }), /serve un testo/);
  assert.deepEqual(s.drum, prima);
});
