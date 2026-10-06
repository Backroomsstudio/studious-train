import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../lib/stato.mjs";

const config = { giudici: { beat: "A", voce: "B", mix: "C" }, pesi: { beat: 1, voce: 1, mix: 1, chat: 1 }, topN: 3, premio: "Mix" };

function confermaTraccia(stato, titolo, voto, ora) {
  stato.corrente = S.tracciaVuota({ titolo, artista: `artista ${titolo}` });
  for (const categoria of S.CATEGORIE) S.impostaVoto(stato, { categoria, valore: voto });
  return S.conferma(stato, config, ora);
}

test("il totale è la media pesata e salta le categorie senza voto", () => {
  const stato = S.statoIniziale(config);
  S.impostaVoto(stato, { categoria: "beat", valore: 8 });
  S.impostaVoto(stato, { categoria: "voce", valore: "9,5" });
  let p = S.punteggi(stato.corrente, config.pesi);
  assert.deepEqual([p.beat, p.voce, p.mix, p.chat], [8, 9.5, null, null]);
  assert.equal(p.totale, 8.75);

  // Con la chat la media è sulle quattro voci: la chat pesa il 25%.
  S.impostaVoto(stato, { categoria: "mix", valore: 6.5 });
  S.apriVotoChat(stato, 0, 0);
  S.votoChat(stato, { piattaforma: "tiktok", utente: "a" }, 10, 1);
  S.votoChat(stato, { piattaforma: "tiktok", utente: "b" }, 6, 1);
  p = S.punteggi(stato.corrente, config.pesi);
  assert.equal(p.chat, 8);
  assert.equal(p.totale, (8 + 9.5 + 6.5 + 8) / 4);
});

test("voti fuori scala o categorie inesistenti vengono rifiutati", () => {
  const stato = S.statoIniziale(config);
  assert.throws(() => S.impostaVoto(stato, { categoria: "beat", valore: 11 }));
  assert.throws(() => S.impostaVoto(stato, { categoria: "chat", valore: 5 }));
  assert.throws(() => S.impostaVoto(stato, { categoria: "__proto__", valore: 5 }));
});

test("una traccia che entra in top spinge fuori l'ultima", () => {
  const stato = S.statoIniziale(config);
  confermaTraccia(stato, "uno", 9, 1);
  confermaTraccia(stato, "due", 7, 2);
  const terza = confermaTraccia(stato, "tre", 6, 3);
  assert.deepEqual([terza.posizione, terza.inTop, terza.entrata], [3, true, true]);

  const quarta = confermaTraccia(stato, "quattro", 8, 4);
  assert.equal(quarta.posizione, 2);
  assert.equal(quarta.entrata, true);
  assert.equal(stato.risultati.find((r) => r.id === quarta.uscito).titolo, "tre");
  assert.deepEqual(S.classifica(stato.risultati, 3).map((r) => r.titolo), ["uno", "quattro", "due"]);

  const fuori = confermaTraccia(stato, "cinque", 5, 5);
  assert.deepEqual([fuori.posizione, fuori.inTop, fuori.entrata], [5, false, false]);
});

test("riconfermare la stessa traccia aggiorna il risultato senza duplicarlo", () => {
  const stato = S.statoIniziale(config);
  confermaTraccia(stato, "uno", 6, 1);
  S.impostaVoto(stato, { categoria: "beat", valore: 10 });
  assert.equal(stato.corrente.confermato, false);
  const esito = S.conferma(stato, config, 99);
  assert.equal(stato.risultati.length, 1);
  assert.equal(esito.risultato.confermatoAlle, 1);
  assert.equal(esito.entrata, false);
  assert.equal(esito.risultato.totale, 7.33);
});

test("chat: un voto per utente, conta l'ultimo, solo a votazione aperta", () => {
  const stato = S.statoIniziale(config);
  const mario = { piattaforma: "tiktok", utente: "Mario" };
  assert.equal(S.votoChat(stato, mario, 8, 0), false);

  S.apriVotoChat(stato, 60, 0);
  assert.equal(S.votoChat(stato, mario, 8, 1000), true);
  assert.equal(S.votoChat(stato, { ...mario, utente: "mario" }, 4, 2000), true);
  assert.equal(S.votoChat(stato, { piattaforma: "tiktok", utente: "luca" }, 10, 3000), true);
  assert.equal(S.punteggi(stato.corrente, config.pesi).chatVoti, 2);
  assert.equal(S.punteggi(stato.corrente, config.pesi).chat, 7);

  assert.equal(S.votoChat(stato, { piattaforma: "tiktok", utente: "anna" }, 9, 61_000), false);
  assert.equal(S.chiudiChatSeScaduta(stato, 61_000), true);
  assert.equal(stato.corrente.chat.aperta, false);
});

test("countdown: la pausa conserva il tempo e alla scadenza vince il primo", () => {
  const stato = S.statoIniziale(config);
  confermaTraccia(stato, "uno", 7, 1);
  confermaTraccia(stato, "due", 9, 2);

  S.countdown(stato, { azione: "avvia", minuti: 180 }, 0);
  S.countdown(stato, { azione: "pausa" }, 60_000);
  assert.equal(stato.countdown.rimanenteMs, 179 * 60_000);
  assert.equal(S.scadenzaCountdown(stato, 10_800_000), undefined);

  S.countdown(stato, { azione: "riprendi" }, 100_000);
  S.countdown(stato, { azione: "aggiungi", minuti: -5 }, 100_000);
  const fine = 100_000 + 179 * 60_000 - 5 * 60_000;
  assert.equal(stato.countdown.fineAlle, fine);
  assert.equal(S.scadenzaCountdown(stato, fine - 1), undefined);

  const { vincitore } = S.scadenzaCountdown(stato, fine);
  assert.equal(vincitore.titolo, "due");
  assert.equal(vincitore.premio, "Mix");
  assert.equal(stato.countdown.scaduto, true);
});

test("pareggio in testa: si apre lo spareggio e il vincitore lo scelgono i giudici", () => {
  const stato = S.statoIniziale(config);
  confermaTraccia(stato, "uno", 8, 1);
  confermaTraccia(stato, "due", 8, 2);
  confermaTraccia(stato, "tre", 6, 3);
  S.countdown(stato, { azione: "avvia", minuti: 1 }, 0);

  const esito = S.scadenzaCountdown(stato, 60_000);
  assert.deepEqual(esito.spareggio.candidati.map((r) => r.titolo), ["uno", "due"]);
  assert.equal(stato.vincitore, null);
  assert.equal(stato.countdown.scaduto, true);

  const scelto = stato.risultati.find((r) => r.titolo === "due");
  const { vincitore } = S.proclama(stato, 70_000, scelto.id);
  assert.equal(vincitore.titolo, "due");
  assert.equal(stato.spareggio, null);
  assert.throws(() => S.proclama(stato, 70_000, "inesistente"));
});

test("countdown scaduto con classifica vuota: nessun vincitore", () => {
  const stato = S.statoIniziale(config);
  S.countdown(stato, { azione: "avvia", minuti: 1 }, 0);
  assert.equal(S.scadenzaCountdown(stato, 60_000), null);
  assert.equal(stato.vincitore, null);
});

test("traccia da Nero: va sul tabellone, ma aspetta se ci sono voti da confermare", () => {
  const stato = S.statoIniziale(config);
  const prima = { neroId: "n1", titolo: "Notti a Vicenza", artista: "Lince", tier: "skip" };
  stato.coda.push({ id: "c1", titolo: "Notti a Vicenza", artista: "Lince", tier: "skip", ricevutoAlle: 1 });
  assert.equal(S.tracciaDaNero(stato, prima), true);
  assert.deepEqual([stato.corrente.titolo, stato.corrente.artista, stato.corrente.tier], ["Notti a Vicenza", "Lince", "skip"]);
  assert.equal(stato.coda.length, 0);

  // Stessa traccia (o nessuna in riproduzione): il tabellone resta com'è, voti compresi.
  S.impostaVoto(stato, { categoria: "beat", valore: 8 });
  assert.equal(S.tracciaDaNero(stato, prima), false);
  assert.equal(S.tracciaDaNero(stato, null), false);
  assert.equal(stato.corrente.voti.beat, 8);

  // Nuova traccia con voti non confermati: aspetta, e «Prossima» la porta sul tabellone.
  S.tracciaDaNero(stato, { neroId: "n2", titolo: "Asfalto", artista: "Dama", tier: "standard" });
  assert.equal(stato.corrente.titolo, "Notti a Vicenza");
  assert.equal(stato.neroInArrivo.titolo, "Asfalto");
  S.prossima(stato);
  assert.deepEqual([stato.corrente.titolo, stato.corrente.voti.beat, stato.neroInArrivo], ["Asfalto", null, null]);

  // Dopo la conferma la traccia successiva passa subito.
  S.impostaVoto(stato, { categoria: "voce", valore: 7 });
  S.conferma(stato, config, 5);
  S.tracciaDaNero(stato, { neroId: "n3", titolo: "Neon Blu", artista: "Rizzo", tier: "throne" });
  assert.equal(stato.corrente.titolo, "Neon Blu");

  // Con la traccia automatica spenta, Nero non tocca il tabellone.
  stato.neroAutomatico = false;
  S.tracciaDaNero(stato, { neroId: "n4", titolo: "Satellite", artista: "Mira", tier: "standard" });
  assert.equal(stato.corrente.titolo, "Neon Blu");
});

test("la coda segue le priorità di Nero: throne, super skip, skip, standard", () => {
  const coda = [
    { id: "s", tier: "standard", ricevutoAlle: 1 },
    { id: "k2", tier: "skip", ricevutoAlle: 5 },
    { id: "t", tier: "throne", ricevutoAlle: 9 },
    { id: "k1", tier: "skip", ricevutoAlle: 2 },
  ];
  assert.deepEqual(S.ordinaCoda(coda).map((v) => v.id), ["t", "k1", "k2", "s"]);
});
