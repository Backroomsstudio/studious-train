// Il tabellone ad albero con un server vero: comando `albero`, widget, spegnimento da solo e partenza da stato salvato.
import { test } from "node:test";
import assert from "node:assert/strict";
import { avviaServer } from "./aiuti-server.mjs";

const dormi = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Ogni prova ha il suo server (stato di partenza diverso) e lo ferma anche se fallisce.
async function conServer(opzioni, prova) {
  const srv = await avviaServer(opzioni);
  try {
    await prova(srv);
  } finally {
    await srv.ferma();
  }
}

// Conferma `n` tracce con totali che scendono (la prima ha il totale più alto).
async function confermaTracce(srv, n) {
  for (let i = 0; i < n; i++) {
    await srv.api("traccia", { titolo: `Titolo ${i + 1}`, artista: `Artista ${i + 1}` });
    for (const categoria of ["beat", "voce", "mix"]) await srv.api("voto", { categoria, valore: 10 - i * 0.25 });
    assert.equal((await srv.api("conferma")).ok, true);
  }
}

test("e2e: il widget albero parte spento, con durata 30 s e nessuna scadenza", () =>
  conServer({}, async (srv) => {
    const s = await srv.statoCorrente();
    assert.equal(s.visibili.albero, false);
    assert.deepEqual([s.albero.durataSecondi, s.albero.finoAlle, s.albero.disegno], [30, null, null]);
  }));

test("e2e: il comando albero con durata 31 s accende, con mostra: false spegne; durata 601 → errore", () =>
  conServer({}, async (srv) => {
    const prima = Date.now();
    const r = await srv.api("albero", { durataSecondi: 31 });
    assert.equal(r.ok, true);
    let s = await srv.statoCorrente();
    assert.equal(s.visibili.albero, true);
    assert.equal(s.albero.durataSecondi, 31);
    assert.ok(s.albero.finoAlle >= prima + 31_000 && s.albero.finoAlle <= Date.now() + 31_000, `finoAlle ${s.albero.finoAlle}`);

    assert.equal((await srv.api("albero", { mostra: false })).ok, true);
    s = await srv.statoCorrente();
    assert.deepEqual([s.visibili.albero, s.albero.finoAlle, s.albero.durataSecondi], [false, null, 31], "spento, e la durata resta per la prossima volta");

    for (const sbagliato of [{ durataSecondi: 601 }, { durataSecondi: -1 }, { durataSecondi: "tanto" }, { mostra: "sì" }, { durataSecondi: 601, mostra: false }]) {
      const no = await srv.api("albero", sbagliato);
      assert.equal(no.ok, false, JSON.stringify(sbagliato));
      assert.ok(no.errore, JSON.stringify(sbagliato));
    }
    assert.match((await srv.api("albero", { durataSecondi: 601 })).errore, /tra 0 e 600/);
    s = await srv.statoCorrente();
    assert.deepEqual([s.visibili.albero, s.albero.durataSecondi], [false, 31], "nessun errore ha cambiato qualcosa");
    // «Mostra» senza dire altro usa la durata di prima
    assert.equal((await srv.api("albero")).ok, true);
    assert.ok((await srv.statoCorrente()).albero.finoAlle > Date.now() + 29_000);
  }));

test("e2e: con albero {durataSecondi: 1, mostra: true} il widget si spegne da solo entro 2,5 s", () =>
  conServer({}, async (srv) => {
    assert.equal((await srv.api("albero", { durataSecondi: 1, mostra: true })).ok, true);
    assert.equal((await srv.statoCorrente()).visibili.albero, true, "subito dopo il comando è acceso");
    const inizio = Date.now();
    let spento = false;
    while (!spento && Date.now() - inizio < 2500) {
      await dormi(100);
      spento = (await srv.statoCorrente()).visibili.albero === false;
    }
    assert.equal(spento, true, "dopo 2,5 s è ancora acceso");
    assert.equal((await srv.statoCorrente()).albero.finoAlle, null);
  }));

test("e2e: con durata 0 il tabellone resta acceso finché non lo spegni", () =>
  conServer({}, async (srv) => {
    assert.equal((await srv.api("albero", { durataSecondi: 0, mostra: true })).ok, true);
    await dormi(1200);
    const s = await srv.statoCorrente();
    assert.deepEqual([s.visibili.albero, s.albero.finoAlle], [true, null]);
  }));

test("e2e: accendere il widget «albero» dall'elenco In onda vale come «Mostra»: si spegne da solo dopo la durata", () =>
  conServer({}, async (srv) => {
    assert.equal((await srv.api("widget", { nome: "albero", visibile: true })).ok, true);
    let s = await srv.statoCorrente();
    assert.equal(s.visibili.albero, true);
    assert.ok(s.albero.finoAlle > Date.now() + 29_000, "ha la sua scadenza di 30 s");
    assert.equal((await srv.api("widget", { nome: "albero", visibile: false })).ok, true);
    s = await srv.statoCorrente();
    assert.deepEqual([s.visibili.albero, s.albero.finoAlle], [false, null]);
  }));

test("e2e: il disegno dell'albero viene dai risultati confermati e segue la classifica", () =>
  conServer({}, async (srv) => {
    await confermaTracce(srv, 1);
    assert.equal((await srv.statoCorrente()).albero.disegno, null, "con un solo risultato non c'è un albero");
    await confermaTracce(srv, 4); // rimette gli stessi titoli: risultati nuovi (id diversi)
    const { albero } = await srv.statoCorrente();
    assert.equal(albero.disegno.dimensione, 8, "5 risultati: albero da 8");
    assert.equal(albero.disegno.turni[0].partite[0].a.posto, 1);
    await srv.api("togliRisultato", { id: albero.disegno.turni[0].partite[0].a.id });
    assert.equal((await srv.statoCorrente()).albero.disegno.dimensione, 4, "togliendo un risultato l'albero si rifà da solo");
  }));

test("e2e: «nuova serata» e «demo» spengono l'albero e tengono la durata scelta", () =>
  conServer({}, async (srv) => {
    await srv.api("albero", { durataSecondi: 45, mostra: true });
    assert.equal((await srv.api("nuovaSerata")).ok, true);
    let s = await srv.statoCorrente();
    assert.deepEqual([s.visibili.albero, s.albero.finoAlle, s.albero.durataSecondi], [false, null, 45]);
    await srv.api("albero", { mostra: true });
    assert.equal((await srv.api("demo")).ok, true);
    s = await srv.statoCorrente();
    assert.deepEqual([s.visibili.albero, s.albero.finoAlle, s.albero.durataSecondi], [false, null, 45]);
    assert.equal(s.albero.disegno.dimensione, 4, "la serata demo ha 4 risultati");
  }));

test("e2e: uno stato.json senza albero parte con i predefiniti; uno con valori rotti li ripara", async () => {
  await conServer({ stato: { premio: "Mix + Master" } }, async (srv) => {
    const s = await srv.statoCorrente();
    assert.deepEqual([s.visibili.albero, s.albero.durataSecondi, s.albero.finoAlle], [false, 30, null]);
  });
  await conServer({ stato: { albero: { durataSecondi: 9999, finoAlle: "domani" }, visibili: { premio: true } } }, async (srv) => {
    const s = await srv.statoCorrente();
    assert.deepEqual([s.visibili.albero, s.albero.durataSecondi, s.albero.finoAlle], [false, 30, null]);
  });
  await conServer({ stato: { albero: { durataSecondi: 20 } } }, async (srv) => {
    assert.equal((await srv.statoCorrente()).albero.durataSecondi, 20, "un valore buono resta");
  });
});
