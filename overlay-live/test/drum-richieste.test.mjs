// Drum: regalo che salta la coda (coda dei regali), striscia e scaletta a tappe con un server vero.
import { test } from "node:test";
import assert from "node:assert/strict";
import { avviaServer } from "./aiuti-server.mjs";

async function conServer(opzioni, prova) {
  const srv = await avviaServer(opzioni);
  try {
    await prova(srv);
  } finally {
    await srv.ferma();
  }
}

test("e2e: con lo slot «Rosa» e il regalo vuoto, regaloEvento Rosa crea una richiesta Drum (solo con il Drum in onda); con regalo «5655» conta per ID", () =>
  conServer({}, async (srv) => {
    await srv.api("regaloEvento", { nome: "Rosa", utente: "prima" });
    assert.equal((await srv.statoCorrente()).drum.richieste.coda.length, 0, "con un altro layout in onda non si accoda");
    await srv.api("layout", { nome: "drum" });
    await srv.api("regaloEvento", { nome: "rosa", utente: "mario" });
    await srv.api("regaloEvento", { nome: "Leone", utente: "lucia" });
    let coda = (await srv.statoCorrente()).drum.richieste.coda;
    assert.deepEqual(coda.map((r) => [r.utente, r.nome]), [["mario", "rosa"]]);
    assert.equal((await srv.api("drumPriorita", { regalo: "5655" })).ok, true);
    await srv.api("regaloEvento", { nome: "Rosa", utente: "anna" });
    assert.equal((await srv.statoCorrente()).drum.richieste.coda.length, 1, "scelto per ID: il nome non basta più");
    await srv.api("regaloEvento", { nome: "Rose", id: 5655, utente: "anna" });
    coda = (await srv.statoCorrente()).drum.richieste.coda;
    assert.deepEqual(coda.map((r) => r.utente), ["mario", "anna"]);
    // «Fatta» e «Scarta» (nel Drum «In onda» non c'è brano da scrivere)
    assert.equal((await srv.api("richiesta", { formato: "drum", azione: "fatta", id: coda[0].id })).ok, true);
    assert.equal((await srv.api("richiesta", { formato: "drum", azione: "scarta", id: coda[1].id })).ok, true);
    assert.deepEqual((await srv.statoCorrente()).drum.richieste.coda.map((r) => r.stato), ["fatta"]);
    assert.equal((await srv.api("richiesta", { formato: "boh", azione: "fatta", id: coda[0].id })).ok, false);
  }));

test("e2e: drumStriscia con i limiti 39 e 161 dà errore, 40 e 160 vanno; il widget drumStriscia parte acceso", () =>
  conServer({}, async (srv) => {
    assert.equal((await srv.statoCorrente()).visibili.drumStriscia, true);
    assert.equal((await srv.api("drumStriscia", { velocita: 40 })).ok, true);
    assert.equal((await srv.api("drumStriscia", { velocita: 160 })).ok, true);
    assert.equal((await srv.api("drumStriscia", { velocita: 39 })).ok, false);
    assert.equal((await srv.api("drumStriscia", { velocita: 161 })).ok, false);
    assert.equal((await srv.statoCorrente()).drum.striscia.velocita, 160);
  }));

test("e2e: drumScaletta { tappe } come il testo; un errore dà il numero della tappa; nuova serata svuota la coda e tiene striscia e regalo", () =>
  conServer({}, async (srv) => {
    assert.equal((await srv.api("drumScaletta", { tappe: [{ like: 1000, titolo: "Uno" }, { like: 2500, titolo: "" }] })).ok, true);
    assert.deepEqual((await srv.statoCorrente()).drum.scaletta, [{ like: 1000, titolo: "Uno" }, { like: 2500, titolo: "" }]);
    const r = await srv.api("drumScaletta", { tappe: [{ like: 1000, titolo: "Uno" }, { like: 900, titolo: "Due" }] });
    assert.equal(r.ok, false);
    assert.match(r.errore, /Tappa 2/);
    await srv.api("layout", { nome: "drum" });
    await srv.api("drumStriscia", { velocita: 120 });
    await srv.api("drumPriorita", { regalo: "Corona" });
    await srv.api("regaloEvento", { nome: "Corona", utente: "mario" });
    assert.equal((await srv.statoCorrente()).drum.richieste.coda.length, 1);
    assert.equal((await srv.api("nuovaSerata")).ok, true);
    const d = (await srv.statoCorrente()).drum;
    assert.deepEqual([d.richieste.coda.length, d.striscia.velocita, d.priorita.regalo], [0, 120, "Corona"]);
  }));
