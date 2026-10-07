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

test("riconnessione a TikTok: nessuno sblocco ripetuto", () => {
  // la stessa live ripresa dopo uno stacco: il totale si rilegge dal primo evento e le tappe già annunciate restano tali
  const ripresa = conLike(nuovo(), 7000);
  ripresa.drum.annunciati = 5;
  D.nuovaConnessioneLike(ripresa);
  D.registraLike(ripresa, { totale: 7050 });
  assert.deepEqual(D.controllaSblocchi(ripresa), []);
  assert.equal(ripresa.drum.annunciati, 5);
  D.registraLike(ripresa, { totale: 9100 });
  assert.deepEqual(D.controllaSblocchi(ripresa), [sblocco(5, 9000)], "i Like arrivati durante lo stacco sbloccano la tappa più alta");
  // una live nuova: il totale riparte da zero e gli annunci si riallineano in silenzio
  const nuova = conLike(nuovo(), 7000);
  nuova.drum.annunciati = 5;
  D.nuovaConnessioneLike(nuova);
  D.registraLike(nuova, { totale: 200 });
  assert.deepEqual(D.controllaSblocchi(nuova), []);
  assert.deepEqual([nuova.drum.like.tiktokTotale, nuova.drum.annunciati], [200, 0]);
  D.registraLike(nuova, { totale: 1500 });
  assert.deepEqual(D.controllaSblocchi(nuova), [sblocco(0, 1000)], "e le tappe si sbloccano di nuovo dalla prima");
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

test("brano", () => {
  const s = conLike(nuovo(), 3500);
  s.drum.scaletta[0].titolo = "Uno";
  D.impostaBrano(s, { titolo: "Titolo", artista: "Artista" });
  assert.deepEqual(s.drum.brano, { titolo: "Titolo", artista: "Artista" });
  D.impostaBrano(s, { titolo: "  Solo titolo  " });
  assert.deepEqual(s.drum.brano, { titolo: "Solo titolo", artista: "Artista" }, "cambia solo quello che si dà");
  assert.throws(() => D.impostaBrano(s, { titolo: "x".repeat(61) }), /60/);
  assert.throws(() => D.impostaBrano(s, { titolo: "Nuovo", artista: "x".repeat(41) }), /40/);
  assert.throws(() => D.impostaBrano(s, { titolo: 5 }), /testo/);
  assert.deepEqual(s.drum.brano, { titolo: "Solo titolo", artista: "Artista" }, "un errore non lascia metà modifica");
  assert.equal(D.impostaBrano(s, { titolo: "x".repeat(60), artista: "y".repeat(40) }), undefined);
  D.impostaBrano(s, { daIndice: 0 });
  assert.deepEqual(s.drum.brano, { titolo: "Uno", artista: "" }, "dalla scaletta: il titolo della tappa, senza artista");
  assert.throws(() => D.impostaBrano(s, { daIndice: 3 }), /non è ancora sbloccato/);
  assert.throws(() => D.impostaBrano(s, { daIndice: 99 }), /non è ancora sbloccato/);
  assert.throws(() => D.impostaBrano(s, { daIndice: -1 }), /non è ancora sbloccato/);
  assert.throws(() => D.impostaBrano(s, { daIndice: 1 }), /titolo/);
  assert.throws(() => D.impostaBrano(s, { daIndice: "0" }), /indice/);
  assert.throws(() => D.impostaBrano(s, { daIndice: 0.5 }), /indice/);
  assert.deepEqual(s.drum.brano, { titolo: "Uno", artista: "" });
  D.impostaBrano(s, { daIndice: 0, artista: "Band" });
  assert.deepEqual(s.drum.brano, { titolo: "Uno", artista: "Band" }, "l'artista scritto a mano resta");
  D.impostaBrano(s, { svuota: true });
  assert.deepEqual(s.drum.brano, { titolo: "", artista: "" });
  assert.throws(() => D.impostaBrano(s, { svuota: "sì" }));
  assert.throws(() => D.impostaBrano(s, null), /Brano/);
});

test("ospite, priorità, eq, riempimento, velocità", () => {
  const s = nuovo();
  D.impostaOspite(s, { etichetta: "Ospite", handle: "@mario.drums", icona: "tiktok" });
  assert.deepEqual(s.drum.ospite, { etichetta: "Ospite", handle: "@mario.drums", icona: "tiktok" });
  D.impostaOspite(s, { handle: "  @solo.handle  " });
  assert.deepEqual(s.drum.ospite, { etichetta: "Ospite", handle: "@solo.handle", icona: "tiktok" }, "cambia solo quello che si dà");
  D.impostaOspite(s, { handle: "" });
  assert.equal(s.drum.ospite.handle, "", "senza contatto lo slot resta vuoto");
  D.impostaOspite(s, { handle: "@solo.handle" });
  const ospite = structuredClone(s.drum.ospite);
  assert.throws(() => D.impostaOspite(s, { icona: "boh" }), /icona/i);
  assert.throws(() => D.impostaOspite(s, { etichetta: "x".repeat(25) }), /24/);
  assert.throws(() => D.impostaOspite(s, { handle: "x".repeat(41) }), /40/);
  assert.throws(() => D.impostaOspite(s, { etichetta: "Nuova", icona: "boh" }));
  assert.throws(() => D.impostaOspite(s, [1]), /Ospite/);
  assert.deepEqual(s.drum.ospite, ospite, "un errore non lascia metà modifica");

  assert.deepEqual(D.ICONE_REGALO, ["rosa", "corona", "cuore", "regalo", "stella", "diamante", "logo"]);
  D.impostaPriorita(s, { prefisso: "Regala una", slot: "Corona", sopra: "Vai in cima", icona: "corona" });
  assert.deepEqual(s.drum.priorita, { prefisso: "Regala una", slot: "Corona", sopra: "Vai in cima", icona: "corona" });
  D.impostaPriorita(s, { prefisso: "", sopra: "" });
  assert.deepEqual([s.drum.priorita.prefisso, s.drum.priorita.sopra, s.drum.priorita.slot], ["", "", "Corona"], "prefisso e riga sopra possono mancare");
  const priorita = structuredClone(s.drum.priorita);
  assert.throws(() => D.impostaPriorita(s, { slot: " " }), /vuoto/);
  assert.throws(() => D.impostaPriorita(s, { icona: "instagram" }), /icona/i);
  assert.throws(() => D.impostaPriorita(s, { prefisso: "x".repeat(17) }), /16/);
  assert.throws(() => D.impostaPriorita(s, { slot: "x".repeat(21) }), /20/);
  assert.throws(() => D.impostaPriorita(s, { sopra: "x".repeat(41) }), /40/);
  assert.throws(() => D.impostaPriorita(s, { sopra: "ok", slot: "" }));
  assert.deepEqual(s.drum.priorita, priorita);

  D.impostaEq(s, { sensibilita: 150, stile: "onda", senzaSegnale: false });
  assert.deepEqual(s.drum.eq, { sensibilita: 150, stile: "onda", senzaSegnale: false });
  D.impostaEq(s, { sensibilita: "200" });
  assert.deepEqual(s.drum.eq, { sensibilita: 200, stile: "onda", senzaSegnale: false });
  D.impostaEq(s, { sensibilita: 50 });
  D.impostaEq(s, { sensibilita: 300 });
  const eq = structuredClone(s.drum.eq);
  for (const rotto of [{ sensibilita: 49 }, { sensibilita: 301 }, { stile: "boh" }, { senzaSegnale: "sì" }, { stile: "barre", sensibilita: 5 }]) {
    assert.throws(() => D.impostaEq(s, rotto), undefined, JSON.stringify(rotto));
  }
  assert.throws(() => D.impostaEq(s, { stile: "boh" }), /barre o onda/);
  assert.deepEqual(s.drum.eq, eq);

  D.impostaRiempimento(s, "sabbia");
  assert.equal(s.drum.riempimento, "sabbia");
  assert.throws(() => D.impostaRiempimento(s, "boh"), /perline o sabbia/);
  assert.throws(() => D.impostaRiempimento(s, undefined), /perline o sabbia/);
  assert.equal(s.drum.riempimento, "sabbia");

  D.impostaVelocita(s, 120);
  assert.equal(s.drum.velocita, 120);
  D.impostaVelocita(s, 40);
  D.impostaVelocita(s, 160);
  assert.throws(() => D.impostaVelocita(s, 39), /40/);
  assert.throws(() => D.impostaVelocita(s, 161), /160/);
  assert.throws(() => D.impostaVelocita(s, "veloce"));
  assert.throws(() => D.impostaVelocita(s, undefined));
  assert.equal(s.drum.velocita, 160);
});

test("fondiDrum: stato vecchio o rotto", () => {
  for (const vuoto of [undefined, null, "x", 5, [], true]) assert.deepEqual(D.fondiDrum(vuoto), D.drumIniziale());
  const a = D.fondiDrum({ scaletta: "rotta", like: { tiktokTotale: 7000, offset: 0, extra: 0 }, annunciati: 99 });
  assert.deepEqual(a.scaletta, D.scalettaPredefinita());
  assert.equal(a.like.tiktokTotale, 7000);
  assert.equal(a.annunciati, 5, "gli annunci non superano le tappe raggiunte (1k, 2k, 3k, 5k, 7k)");
  assert.deepEqual(D.fondiDrum({ eq: { sensibilita: 5000, stile: "onda" } }).eq, D.drumIniziale().eq, "un valore rotto scarta il gruppo");
  const b = D.fondiDrum({ velocita: 120, riempimento: "sabbia" });
  assert.deepEqual([b.velocita, b.riempimento], [120, "sabbia"]);
  assert.deepEqual(D.fondiDrum({ velocita: 5000, riempimento: "fango" }), D.drumIniziale());
  assert.deepEqual(D.fondiDrum({ pippo: 1, __proto__: { x: 1 } }), D.drumIniziale(), "i campi sconosciuti non entrano");
});

test("fondiDrum: ogni gruppo si controlla da solo", () => {
  const iniziale = D.drumIniziale();
  const like = (l) => D.fondiDrum({ like: l }).like;
  assert.deepEqual(like({ tiktokTotale: null, offset: 300, extra: -20 }), { tiktokTotale: null, offset: 300, extra: -20 });
  assert.deepEqual(like({ tiktokTotale: 100, offset: 0, extra: 5 }), { tiktokTotale: 100, offset: 0, extra: 5 });
  for (const rotto of [{ tiktokTotale: "x", offset: 0, extra: 0 }, { tiktokTotale: 100, offset: -5, extra: 0 }, { tiktokTotale: -1, offset: 0, extra: 0 }, { tiktokTotale: 1.5, offset: 0, extra: 0 }, { tiktokTotale: 100, offset: 0 }, { tiktokTotale: 100, offset: 0, extra: Infinity }, null, []]) {
    assert.deepEqual(like(rotto), iniziale.like, JSON.stringify(rotto));
  }
  for (const rotta of [[], [{ like: 2000, titolo: "" }, { like: 1000, titolo: "" }], [{ like: 1000 }], null, 5]) {
    assert.deepEqual(D.fondiDrum({ scaletta: rotta }).scaletta, D.scalettaPredefinita(), JSON.stringify(rotta));
  }
  assert.deepEqual(D.fondiDrum({ scaletta: [{ like: 100, titolo: " X " }] }).scaletta, [{ like: 100, titolo: "X" }]);
  assert.deepEqual(D.fondiDrum({ ospite: { handle: "@x" } }).ospite, { etichetta: "Artista ospite", handle: "@x", icona: "instagram" }, "i campi che mancano restano quelli di partenza");
  assert.deepEqual(D.fondiDrum({ ospite: { icona: "boh", handle: "@x" } }).ospite, iniziale.ospite);
  assert.deepEqual(D.fondiDrum({ priorita: { slot: "" } }).priorita, iniziale.priorita);
  assert.deepEqual(D.fondiDrum({ priorita: { slot: "Corona", icona: "corona" } }).priorita, { ...iniziale.priorita, slot: "Corona", icona: "corona" });
  assert.deepEqual(D.fondiDrum({ brano: { titolo: 5 } }).brano, iniziale.brano);
  assert.deepEqual(D.fondiDrum({ brano: { titolo: "Uno", artista: "Due" } }).brano, { titolo: "Uno", artista: "Due" });
  assert.deepEqual(D.fondiDrum({ brano: { daIndice: 0, svuota: true, titolo: "Resta" } }).brano, { titolo: "Resta", artista: "" }, "dallo stato salvato contano solo titolo e artista");
  assert.deepEqual(D.fondiDrum({ testi: { contatore: 150 } }).testi, { ...iniziale.testi, contatore: 150 });
  assert.deepEqual(D.fondiDrum({ testi: { contatore: 5000 } }).testi, iniziale.testi);
  assert.deepEqual(D.fondiDrum({ testi: { inventato: 100 } }).testi, iniziale.testi);
  assert.deepEqual(D.fondiDrum({ like: null, scaletta: null, brano: [], ospite: 5, priorita: "x", eq: null, riempimento: {}, velocita: "veloce", testi: [], annunciati: {} }), iniziale);
  const conLikeSalvati = (annunciati) => D.fondiDrum({ like: { tiktokTotale: 7000, offset: 0, extra: 0 }, annunciati }).annunciati;
  assert.equal(conLikeSalvati(3), 3, "un annuncio in ritardo resta com'è");
  assert.equal(conLikeSalvati(5), 5);
  for (const rotto of [6, 99, -1, 2.5, "5", null, undefined, NaN]) assert.equal(conLikeSalvati(rotto), 5, `riallineato: ${String(rotto)}`);
});

test("fondiDrum: dopo un riavvio non si ripete nessuno sblocco", () => {
  const s = nuovo();
  conLike(s, 9000, { offset: 1000, extra: 50 });
  D.impostaScaletta(s, { testo: "1000 | A\n2000 | B\n5000 | C\n9000 | D\n20000 | E" });
  D.impostaBrano(s, { titolo: "B", artista: "Gruppo" });
  D.impostaOspite(s, { handle: "@x", icona: "tiktok" });
  D.impostaPriorita(s, { slot: "Corona", icona: "corona" });
  D.impostaEq(s, { sensibilita: 180, stile: "onda", senzaSegnale: false });
  D.impostaRiempimento(s, "sabbia");
  D.impostaVelocita(s, 120);
  s.drum.testi.contatore = 140;
  s.drum.annunciati = D.tappeRaggiunte(s.drum);
  const copia = D.fondiDrum(structuredClone(s.drum));
  assert.deepEqual(copia, s.drum);
  assert.notEqual(copia.scaletta, s.drum.scaletta);
  assert.deepEqual(D.controllaSblocchi({ drum: copia }), []);
  assert.deepEqual(D.fondiDrum(JSON.parse(JSON.stringify(s.drum))), s.drum, "anche passando dal file JSON");
});

test("drumNuovaSerata", () => {
  const s = conLike(nuovo(), 9000, { extra: 50 });
  s.drum.annunciati = 6;
  s.drum.brano = { titolo: "X", artista: "Y" };
  s.drum.scaletta[0].titolo = "Titolo uno";
  D.impostaOspite(s, { handle: "@ospite" });
  D.impostaEq(s, { sensibilita: 150, stile: "onda", senzaSegnale: false });
  D.impostaRiempimento(s, "sabbia");
  D.impostaVelocita(s, 100);
  s.drum.testi.brano = 130;
  const prima = structuredClone(s.drum);
  const dopo = D.drumNuovaSerata(s.drum);
  assert.deepEqual(s.drum, prima, "la funzione non tocca l'originale");
  assert.equal(D.contati(dopo), 0);
  assert.equal(dopo.annunciati, 0);
  assert.deepEqual(dopo.brano, { titolo: "", artista: "" });
  assert.deepEqual(dopo.like, { tiktokTotale: 9000, offset: 9000, extra: 0 });
  assert.equal(dopo.scaletta[0].titolo, "Titolo uno");
  assert.deepEqual(dopo.eq, { sensibilita: 150, stile: "onda", senzaSegnale: false });
  assert.equal(dopo.ospite.handle, "@ospite");
  assert.deepEqual([dopo.riempimento, dopo.velocita, dopo.testi.brano], ["sabbia", 100, 130]);
  assert.deepEqual(dopo.priorita, prima.priorita);
  assert.notEqual(dopo.scaletta, s.drum.scaletta, "nessun pezzo in comune con l'originale");
  assert.notEqual(dopo.testi, s.drum.testi);
  assert.deepEqual(D.controllaSblocchi({ drum: dopo }), [], "nella serata nuova non c'è nulla da annunciare");
  assert.deepEqual(D.drumNuovaSerata(D.drumIniziale()).like, { tiktokTotale: null, offset: 0, extra: 0 });
});

test("istantaneaDrum", () => {
  const s = conLike(nuovo(), 11400);
  const i = D.istantaneaDrum(s.drum);
  assert.equal(i.contati, 11400);
  assert.equal(i.attiva, 7);
  assert.equal(i.progresso, 0.7);
  assert.deepEqual(Object.keys(s.drum), Object.keys(D.drumIniziale()), "il Drum originale non ha campi in più");
  for (const campo of Object.keys(s.drum)) assert.deepEqual(i[campo], s.drum[campo], campo);
  assert.equal(D.istantaneaDrum(conLike(nuovo(), 500000).drum).attiva, null);
  assert.equal(D.istantaneaDrum(conLike(nuovo(), 500000).drum).progresso, 1);
  i.scaletta[0].titolo = "x";
  i.like.extra = 9;
  assert.equal(s.drum.scaletta[0].titolo, "");
  assert.equal(s.drum.like.extra, 0, "è una copia");
});

test("drumDemo", () => {
  const s = conLike(nuovo(), 5, { offset: 3, extra: 9 });
  D.drumDemo(s, "vuoto");
  assert.equal(D.contati(s.drum), 0);
  assert.equal(s.drum.annunciati, 0);
  assert.deepEqual(s.drum.brano, { titolo: "", artista: "" });
  D.drumDemo(s, "meta");
  assert.deepEqual(s.drum.like, { tiktokTotale: 11400, offset: 0, extra: 0 });
  assert.equal(D.contati(s.drum), 11400);
  assert.equal(D.tappeRaggiunte(s.drum), 7);
  assert.equal(s.drum.annunciati, 7);
  assert.equal(D.indiceAttiva(s.drum), 7);
  assert.equal(D.progresso(s.drum), 0.7);
  assert.equal(s.drum.brano.titolo, "Seven Nation Army");
  assert.equal(s.drum.scaletta[6].titolo, "Another One Bites the Dust");
  assert.equal(s.drum.scaletta[11].titolo, "Master of Puppets");
  assert.equal(s.drum.scaletta[12].titolo, "", "i titoli di prova sono solo per le prime 12 tappe");
  assert.deepEqual([s.drum.ospite.handle, s.drum.ospite.icona, s.drum.ospite.etichetta], ["@lince.music", "instagram", "Artista ospite"]);
  assert.deepEqual(D.controllaSblocchi(s), []);
  D.drumDemo(s, "sblocco");
  assert.equal(D.contati(s.drum), 12000);
  assert.equal(s.drum.annunciati, 8);
  assert.deepEqual(D.controllaSblocchi(s), []);
  D.drumDemo(s, "finale");
  assert.equal(D.indiceAttiva(s.drum), null);
  assert.equal(s.drum.annunciati, 37);
  assert.deepEqual(D.controllaSblocchi(s), []);
  const prima = structuredClone(s.drum);
  assert.throws(() => D.drumDemo(s, "boh"), /Fase non valida: vuoto, meta, sblocco o finale/);
  assert.throws(() => D.drumDemo(s, undefined), /Fase non valida/);
  assert.throws(() => D.drumDemo(s, ["meta"]), /Fase non valida/);
  assert.throws(() => D.drumDemo(s, "toString"), /Fase non valida/);
  assert.deepEqual(s.drum, prima, "una fase sbagliata non cambia nulla");
  const corta = nuovo();
  D.impostaScaletta(corta, { testo: "100\n200" });
  D.drumDemo(corta, "finale");
  assert.equal(corta.drum.annunciati, 2, "con una scaletta più corta gli annunci seguono le tappe che ci sono");
  assert.equal(corta.drum.scaletta[1].titolo, "Seven Nation Army");
});
