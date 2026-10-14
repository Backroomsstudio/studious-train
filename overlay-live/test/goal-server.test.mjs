// Goal, follow e regali visti con un server vero: comandi `goal`, `goalMostra`, `followEvento`, `regaloEvento`, `likeEvento`.
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

test("e2e: il Goal parte con i predefiniti e il widget goal acceso", () =>
  conServer({}, async (srv) => {
    const s = await srv.statoCorrente();
    assert.equal(s.visibili.goal, true);
    assert.deepEqual([s.goal.like.obiettivo, s.goal.like.passo, s.goal.follower.obiettivo, s.goal.follower.totale, s.goal.modo], [15000, 1000, 50, null, "fisso"]);
    assert.deepEqual(s.regaliVisti, []);
  }));

test("e2e: goal cambia obiettivo e passo e i like di likeEvento fanno quadrare i «mancano»", () =>
  conServer({}, async (srv) => {
    assert.equal((await srv.api("goal", { like: { obiettivo: 20000, passo: 5000 } })).ok, true);
    assert.equal((await srv.api("likeEvento", { totale: 18000 })).ok, true);
    const s = await srv.statoCorrente();
    assert.deepEqual([s.goal.like.obiettivo, s.goal.like.passo], [20000, 5000]);
    assert.equal(typeof s.goal.like.totale, "number");
  }));

test("e2e: followEvento somma uno, un totale più alto lo imposta, uno più basso no", () =>
  conServer({}, async (srv) => {
    assert.equal((await srv.api("goal", { follower: { imposta: 1000 } })).ok, true);
    await srv.api("followEvento", { utente: "mario" });
    assert.equal((await srv.statoCorrente()).goal.follower.totale, 1001);
    await srv.api("followEvento", { utente: "lucia", totale: 1250 });
    assert.equal((await srv.statoCorrente()).goal.follower.totale, 1250);
    await srv.api("followEvento", { utente: "anna", totale: 900 });
    assert.equal((await srv.statoCorrente()).goal.follower.totale, 1251, "un totale più basso non vale: conta come un follow in più");
  }));

test("e2e: regaloEvento finisce nei regali visti, il più recente in cima", () =>
  conServer({}, async (srv) => {
    assert.equal((await srv.api("regaloEvento", { nome: "Rose", id: 5655, utente: "mario", quantita: 3 })).ok, true);
    assert.equal((await srv.api("regaloEvento", { nome: "Leone", utente: "lucia" })).ok, true);
    const { regaliVisti } = await srv.statoCorrente();
    assert.deepEqual(regaliVisti.map((v) => [v.nome, v.utente]), [["Leone", "lucia"], ["Rose", "mario"]]);
    assert.equal((await srv.api("regaloEvento", { utente: "x" })).ok, false, "serve il nome o l'ID");
  }));

test("e2e: un errore non cambia niente (obiettivo 0, posizione fuori tela)", () =>
  conServer({}, async (srv) => {
    const prima = (await srv.statoCorrente()).goal;
    assert.ok(prima, "il Goal c'è nello stato");
    const r = await srv.api("goal", { like: { obiettivo: 0 } });
    assert.equal(r.ok, false);
    assert.equal((await srv.api("goal", { follower: { obiettivo: 99 }, posizione: { layout: "gara", x: 5000 } })).ok, false);
    assert.deepEqual((await srv.statoCorrente()).goal, prima);
  }));

test("e2e: goalMostra emette l'evento goalMostra", () =>
  conServer({}, async (srv) => {
    const ws = await srv.apriWs();
    assert.equal((await srv.api("goalMostra")).ok, true);
    await new Promise((ok) => setTimeout(ok, 150));
    assert.ok(ws.eventi.some((e) => e.nome === "goalMostra"));
    ws.chiudi();
  }));

test("e2e: nuova serata e demo conservano obiettivi, posizioni e regali visti", () =>
  conServer({}, async (srv) => {
    await srv.api("goal", { like: { obiettivo: 25000 }, follower: { imposta: 400 }, posizione: { layout: "gara", x: 100, y: 200, scala: 120 } });
    await srv.api("regaloEvento", { nome: "Rose", utente: "mario" });
    for (const comando of ["nuovaSerata", "demo"]) {
      assert.equal((await srv.api(comando)).ok, true);
      const s = await srv.statoCorrente();
      assert.equal(s.goal.like.obiettivo, 25000, comando);
      assert.equal(s.goal.follower.totale, 400, comando);
      assert.deepEqual(s.goal.posizioni.gara, { x: 100, y: 200, scala: 120 }, comando);
      assert.equal(s.regaliVisti.length, 1, comando);
    }
  }));

test("e2e: uno stato salvato senza goal (o con valori rotti) riparte con i predefiniti, tenendo i campi buoni", () =>
  conServer({ stato: { goal: { like: { obiettivo: "tanti", passo: 500 }, modo: "comparsa" }, regaliVisti: "no" } }, async (srv) => {
    const s = await srv.statoCorrente();
    assert.deepEqual([s.goal.like.obiettivo, s.goal.like.passo, s.goal.modo], [15000, 500, "comparsa"]);
    assert.deepEqual(s.regaliVisti, []);
  }));

test("e2e: uno stato salvato vecchio, senza goal, riparte con i predefiniti", () =>
  conServer({ stato: { layout: "gara" } }, async (srv) => {
    const s = await srv.statoCorrente();
    assert.equal(s.goal.like.obiettivo, 15000);
    assert.equal(s.visibili.goal, true);
  }));
