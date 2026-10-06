import { test } from "node:test";
import assert from "node:assert/strict";
import {
  percentuali,
  SOGLIA_URGENTE_MS,
  timerUrgente,
  rimanenteBattleMs,
  numeroConto,
  RIVELAZIONE,
  FINE_RIVELAZIONE_MS,
  sequenzaRivelazione,
  popupConsentito,
  richiestePopup,
  popupAutomaticoDovuto,
} from "../public/js/battle-logica.js";

test("percentuali: interi che sommano sempre 100", () => {
  assert.deepEqual(percentuali({ sx: 0.75, dx: 0.25 }), { sx: 75, dx: 25 });
  assert.deepEqual(percentuali({ sx: 1 / 3, dx: 2 / 3 }), { sx: 33, dx: 67 });
  assert.deepEqual(percentuali({ sx: 0.5, dx: 0.5 }), { sx: 50, dx: 50 });
});

test("timer urgente: rosso e lampeggiante negli ultimi 30 secondi", () => {
  assert.equal(SOGLIA_URGENTE_MS, 30_000);
  assert.equal(timerUrgente(30_000), true);
  assert.equal(timerUrgente(1), true);
  assert.equal(timerUrgente(30_001), false);
  assert.equal(timerUrgente(0), false);
});

test("tempo rimasto: in corso, in pausa, prima del via, scaduto", () => {
  const timer = (t) => ({ timer: { durataSecondi: 90, fineAlle: null, rimanenteMs: null, scaduto: false, ...t } });
  assert.equal(rimanenteBattleMs(timer({ fineAlle: 10_000 }), 4_000), 6_000);
  assert.equal(rimanenteBattleMs(timer({ fineAlle: 10_000 }), 99_000), 0, "mai negativo");
  assert.equal(rimanenteBattleMs(timer({ rimanenteMs: 80_000 }), 4_000), 80_000);
  assert.equal(rimanenteBattleMs(timer({}), 4_000), 90_000);
  assert.equal(rimanenteBattleMs(timer({ scaduto: true }), 4_000), 0);
});

test("conto: il numero grande del 3-2-1", () => {
  assert.equal(numeroConto(3000, 0), 3);
  assert.equal(numeroConto(2999, 0), 3);
  assert.equal(numeroConto(2000, 0), 2);
  assert.equal(numeroConto(1000, 0), 1);
  assert.equal(numeroConto(1, 0), 1);
  assert.equal(numeroConto(0, 5), 0);
  assert.equal(numeroConto(60_000, 0), 3, "mai oltre 3");
  assert.equal(numeroConto(null, 0), 0);
});

test("rivelazione: i cinque passi in sequenza", () => {
  const risultato = {
    totali: { sx: 7.88, dx: 5.13 },
    parziali: { luca: { sx: 8, dx: 6 }, freya: { sx: 8, dx: 6 }, daniele: { sx: 8, dx: 6 }, chat: { sx: 7.5, dx: 2.5 } },
  };
  const passi = sequenzaRivelazione(risultato);
  assert.deepEqual(passi.map((p) => p.chiave), ["luca", "freya", "daniele", "chat", "totale"]);
  assert.deepEqual(passi.map((p) => p.dopoMs), [0, 900, 1800, 2700, 3600]);
  assert.deepEqual(passi[3], { chiave: "chat", sx: 7.5, dx: 2.5, dopoMs: 2700 });
  assert.deepEqual(passi[4], { chiave: "totale", sx: 7.88, dx: 5.13, dopoMs: 3600 });
  assert.deepEqual(RIVELAZIONE, { passoMs: 900, conteggioMs: 700, conteggioTotaleMs: 1500 });
  assert.equal(FINE_RIVELAZIONE_MS, 5100);
});

test("pop-up: compaiono solo in attesa e durante il battle, e se il widget è acceso", () => {
  const stato = (fase, visibili = {}) => ({ battle: { fase }, visibili: { popupBattle: true, ...visibili } });
  for (const fase of ["attesa", "battle"]) assert.equal(popupConsentito(stato(fase).battle, stato(fase).visibili), true, fase);
  for (const fase of ["countdown", "voto", "risultato"]) assert.equal(popupConsentito(stato(fase).battle, stato(fase).visibili), false, fase);
  assert.equal(popupConsentito(stato("attesa").battle, { popupBattle: false }), false);
});

test("pop-up chiesti dalla regia: uno per evento, mai al primo disegno o in fase vietata", () => {
  const dopo = { battle: { fase: "attesa" }, visibili: { popupBattle: true } };
  const eventi = [{ nome: "popupBattle", dati: { id: "rime" } }, { nome: "gong", dati: {} }, { nome: "popupBattle", dati: {} }];
  assert.deepEqual(richiestePopup({}, dopo, eventi), ["rime", null]);
  assert.deepEqual(richiestePopup(null, dopo, eventi), []);
  assert.deepEqual(richiestePopup({}, { ...dopo, battle: { fase: "voto" } }, eventi), []);
  assert.deepEqual(richiestePopup({}, dopo, []), []);
});

test("pop-up automatico: dovuto solo dopo l'intervallo, se consentito e non già aperto", () => {
  const base = { ogniMinuti: 4, ultimaAlle: 0, ora: 240_000, aperto: false, consentito: true };
  assert.equal(popupAutomaticoDovuto(base), true);
  assert.equal(popupAutomaticoDovuto({ ...base, ora: 239_999 }), false);
  assert.equal(popupAutomaticoDovuto({ ...base, ogniMinuti: 0 }), false, "0 = solo a mano");
  assert.equal(popupAutomaticoDovuto({ ...base, aperto: true }), false);
  assert.equal(popupAutomaticoDovuto({ ...base, consentito: false }), false);
});
