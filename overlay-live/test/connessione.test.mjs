// connessione.js gira nel browser: qui WebSocket e location sono finti, per provare i messaggi audio.
import { test } from "node:test";
import assert from "node:assert/strict";

class FalsoWebSocket {
  static OPEN = 1;
  static istanze = [];
  readyState = 0;
  inviati = [];
  #ascoltatori = {};

  constructor(indirizzo) {
    this.indirizzo = indirizzo;
    FalsoWebSocket.istanze.push(this);
  }

  addEventListener(tipo, fn) {
    (this.#ascoltatori[tipo] ??= []).push(fn);
  }

  send(dati) {
    this.inviati.push(JSON.parse(dati));
  }

  apri() {
    this.readyState = FalsoWebSocket.OPEN;
    for (const fn of this.#ascoltatori.open ?? []) fn({});
  }

  ricevi(msg) {
    for (const fn of this.#ascoltatori.message ?? []) fn({ data: JSON.stringify(msg) });
  }
}

globalThis.WebSocket = FalsoWebSocket;
globalThis.location = { protocol: "http:", host: "localhost:4747" };
const { collega } = await import("../public/js/connessione.js");

const bande = Array.from({ length: 12 }, (_, i) => i * 8);
const ultimo = () => FalsoWebSocket.istanze.at(-1);

test("connessione: i messaggi audio vanno a suAudio, lo stato a suStato", () => {
  const stati = [];
  const audio = [];
  collega({ suStato: (s, e) => stati.push([s.ora, e]), suAudio: (m) => audio.push(m) });
  const ws = ultimo();
  assert.equal(ws.indirizzo, "ws://localhost:4747/ws");
  ws.apri();
  ws.ricevi({ tipo: "audio", b: bande, c: 40 });
  ws.ricevi({ tipo: "stato", stato: { ora: 123 }, eventi: [{ nome: "x", dati: {} }] });
  ws.ricevi({ tipo: "audio", b: bande, c: 0 });
  assert.deepEqual(audio, [{ tipo: "audio", b: bande, c: 40 }, { tipo: "audio", b: bande, c: 0 }]);
  assert.deepEqual(stati, [[123, [{ nome: "x", dati: {} }]]]);
});

test("connessione: senza suAudio i messaggi audio si ignorano", () => {
  const stati = [];
  collega({ suStato: (s) => stati.push(s.ora) });
  const ws = ultimo();
  ws.apri();
  assert.doesNotThrow(() => ws.ricevi({ tipo: "audio", b: bande, c: 1 }));
  ws.ricevi({ tipo: "stato", stato: { ora: 5 }, eventi: [] });
  assert.deepEqual(stati, [5]);
});

test("connessione: audio(b, c) manda i livelli con il PIN, solo a socket aperto", () => {
  const connessione = collega({ suStato() {}, pin: () => "1234" });
  const ws = ultimo();
  connessione.audio(bande, 7);
  assert.deepEqual(ws.inviati, [], "a socket non ancora aperto non parte nulla");
  ws.apri();
  connessione.audio(bande, 7);
  connessione.audio(bande, 0);
  assert.deepEqual(ws.inviati, [
    { tipo: "audio", b: bande, c: 7, pin: "1234" },
    { tipo: "audio", b: bande, c: 0, pin: "1234" },
  ]);
  ws.readyState = 3;
  connessione.audio(bande, 1);
  assert.equal(ws.inviati.length, 2, "a socket chiuso non parte nulla");
});

test("connessione: senza PIN il messaggio audio ha il PIN vuoto e i comandi restano come prima", async () => {
  const connessione = collega({ suStato() {} });
  const ws = ultimo();
  ws.apri();
  connessione.audio(bande, 3);
  assert.equal(ws.inviati[0].pin, "");
  const esito = connessione.comando("layout", { nome: "drum" });
  assert.deepEqual(ws.inviati[1], { tipo: "comando", id: 1, nome: "layout", args: { nome: "drum" }, pin: "" });
  ws.ricevi({ tipo: "esito", id: 1, ok: true, dati: null });
  assert.deepEqual(await esito, { tipo: "esito", id: 1, ok: true, dati: null });
});
