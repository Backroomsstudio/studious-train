import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../lib/stato.mjs";
import { suoniTraccia, cambiClassifica, suoniClassifica, suoniTimer } from "../public/js/eventi-sonori.js";

const config = { giudici: { beat: "A", voce: "B", mix: "C" }, pesi: { beat: 1, voce: 1, mix: 1, chat: 1 }, topN: 3, premio: "Mix" };
const foto = (stato, ora = 0) => structuredClone(S.istantanea(stato, config, ora));
const nomi = (suoni) => suoni.map((s) => s.nome);

test("il voto di un giudice suona con la sua nota; se i voti sono nascosti fa solo il click", () => {
  const stato = S.statoIniziale(config);
  const prima = foto(stato);
  S.impostaVoto(stato, { categoria: "beat", valore: 8 });
  assert.deepEqual(suoniTraccia(prima, foto(stato)), [{ nome: "voto", dati: { valore: 8 } }]);

  stato.nascondiVoti = true;
  const nascosto = foto(stato);
  S.impostaVoto(stato, { categoria: "voce", valore: 6 });
  assert.deepEqual(nomi(suoniTraccia(nascosto, foto(stato))), ["bloccato"]);
});

test("apertura del voto chat e raffica di voti: al massimo 4 pop sfalsati", () => {
  const stato = S.statoIniziale(config);
  const prima = foto(stato);
  S.apriVotoChat(stato, 0, 0);
  assert.deepEqual(nomi(suoniTraccia(prima, foto(stato))), ["chatApre"]);

  const aperta = foto(stato);
  for (let i = 0; i < 10; i++) S.votoChat(stato, { piattaforma: "tiktok", utente: `u${i}` }, 7, 1);
  const suoni = suoniTraccia(aperta, foto(stato));
  assert.deepEqual(nomi(suoni), ["chatVoto", "chatVoto", "chatVoto", "chatVoto"]);
  assert.deepEqual(suoni.map((s) => s.ritardo), [0, 70, 140, 210]);
});

test("la conferma suona il calcolo del punteggio, non i singoli voti", () => {
  const stato = S.statoIniziale(config);
  stato.nascondiVoti = true;
  for (const categoria of S.CATEGORIE) S.impostaVoto(stato, { categoria, valore: 9 });
  const prima = foto(stato);
  const risultato = S.conferma(stato, config, 1);
  assert.deepEqual(nomi(suoniTraccia(prima, foto(stato), [{ nome: "classifica", dati: risultato }])), ["calcolo"]);
});

test("nuova traccia, premio cambiato, vincitore e prova dalla regia", () => {
  const stato = S.statoIniziale(config);
  let prima = foto(stato);
  stato.corrente = S.tracciaVuota({ titolo: "Nuova" });
  stato.premio = "Beat";
  assert.deepEqual(nomi(suoniTraccia(prima, foto(stato))), ["premio", "nuovaTraccia"]);

  for (const categoria of S.CATEGORIE) S.impostaVoto(stato, { categoria, valore: 8 });
  S.conferma(stato, config, 1);
  prima = foto(stato);
  S.proclama(stato, 2);
  assert.deepEqual(nomi(suoniTraccia(prima, foto(stato))), ["vincitore"]);

  assert.deepEqual(nomi(suoniTraccia(prima, prima, [{ nome: "suono", dati: { nome: "primo" } }])), ["primo"]);
  assert.deepEqual(suoniTraccia(null, prima), [], "al primo disegno non suona niente");
});

test("classifica: nuovo primo, entrate, scalate e uscite", () => {
  const r = (id) => ({ id });
  const prima = [r("a"), r("b"), r("c")];

  let cambi = cambiClassifica(prima, [r("d"), r("a"), r("b")]);
  assert.equal(cambi.nuovoPrimo, "d");
  assert.deepEqual(cambi.entrate, [{ id: "d", posizione: 1 }]);
  assert.deepEqual(cambi.uscite, ["c"]);
  assert.deepEqual(nomi(suoniClassifica(cambi)), ["primo", "esce"]);

  cambi = cambiClassifica(prima, [r("a"), r("x"), r("b")]);
  assert.deepEqual(nomi(suoniClassifica(cambi)), ["entrata", "esce"]);

  cambi = cambiClassifica(prima, [r("a"), r("c"), r("b")]);
  assert.deepEqual(cambi.salite, [{ id: "c", posizione: 2, posti: 1 }]);
  assert.deepEqual(suoniClassifica(cambi), [{ nome: "sale", dati: { posti: 1 } }]);

  assert.deepEqual(suoniClassifica(cambiClassifica(prima, prima)), []);
});

test("countdown: sirena a 30 minuti e a 1 minuto, tic negli ultimi 10 secondi", () => {
  const min = 60_000;
  assert.deepEqual(nomi(suoniTimer(30 * min + 200, 30 * min - 50)), ["allarme"]);
  assert.deepEqual(nomi(suoniTimer(60_100, 59_900)), ["allarme"]);
  assert.deepEqual(suoniTimer(10_100, 9_900), [{ nome: "tic", dati: { ultimi: false } }]);
  assert.deepEqual(suoniTimer(3_100, 2_900), [{ nome: "tic", dati: { ultimi: true } }]);
  assert.deepEqual(suoniTimer(9_900, 9_700), [], "un solo tic per secondo");
  assert.deepEqual(suoniTimer(null, 5_000), [], "countdown appena caricato");
  assert.deepEqual(suoniTimer(20 * min, 25 * min), [], "minuti aggiunti dalla regia");
});
