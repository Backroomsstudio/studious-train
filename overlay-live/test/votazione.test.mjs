// Votazione della gara: intervallo dei voti (chat e giudici), pesi, etichette. Funzioni pure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leggiVoto } from "../lib/chat.mjs";
import { normalizzaVoto } from "../lib/validazione.mjs";
import * as S from "../lib/stato.mjs";

const GARA = { min: 4, max: 10 };

test("leggiVoto 4–10 accetta 4, 4.5, 10, «9/10», «7,5» e «!voto 8»", () => {
  const casi = { "4": 4, "4.5": 4.5, "10": 10, "9/10": 9, "7,5": 7.5, "!voto 8": 8, " 6 ": 6, "!v 4": 4 };
  for (const [testo, atteso] of Object.entries(casi)) assert.equal(leggiVoto(testo, GARA), atteso, `"${testo}"`);
});

test("leggiVoto 4–10 ignora 3, 3.9, 10.5, «!voto 3», «0» e gli altri fuori intervallo", () => {
  for (const testo of ["3", "3.9", "10.5", "!voto 3", "0", "0.5", "3/10", "11"]) assert.equal(leggiVoto(testo, GARA), null, `"${testo}"`);
});

test("leggiVoto senza opzioni resta 0–10 (Battle e vecchi usi)", () => {
  assert.equal(leggiVoto("0"), 0);
  assert.equal(leggiVoto("3"), 3);
  assert.equal(leggiVoto("10"), 10);
  assert.equal(leggiVoto("10.5"), null);
  assert.equal(leggiVoto("non è un voto", GARA), null);
});

test("normalizzaVoto 4–10: 3.9 e 10.1 lanciano «Il voto deve essere tra 4 e 10», 4 e 10 passano", () => {
  assert.throws(() => normalizzaVoto(3.9, GARA), /Il voto deve essere tra 4 e 10/);
  assert.throws(() => normalizzaVoto("3", GARA), /tra 4 e 10/);
  assert.throws(() => normalizzaVoto(10.1, GARA), /tra 4 e 10/);
  assert.equal(normalizzaVoto(4, GARA), 4);
  assert.equal(normalizzaVoto(10, GARA), 10);
  assert.equal(normalizzaVoto("9,5", GARA), 9.5);
});

test("normalizzaVoto: vuoto vale «nessun voto» e senza opzioni resta 0–10", () => {
  for (const vuoto of ["", null, undefined]) assert.equal(normalizzaVoto(vuoto, GARA), null);
  assert.equal(normalizzaVoto(0), 0);
  assert.equal(normalizzaVoto("7,25"), 7.3);
  assert.throws(() => normalizzaVoto(11), /Il voto deve essere tra 0 e 10/);
  assert.throws(() => normalizzaVoto(-1), /tra 0 e 10/);
});

// ---------- Votazione della gara: pesi, intervallo ed etichette (stato.votazione) ----------

const config = { giudici: { beat: "A", voce: "B", mix: "C" }, topN: 3, premio: "Mix" };
const PREDEFINITA = { pesi: { beat: 3, voce: 3, mix: 3, chat: 1 }, min: 4, max: 10, etichette: { beat: "Beat", voce: "Voce", mix: "Mix", chat: "Chat" } };

test("votazione iniziale: pesi 3/3/3/1, 4–10, etichette di partenza", () => {
  assert.deepEqual(S.votazioneIniziale({}), PREDEFINITA);
  assert.deepEqual(S.statoIniziale(config).votazione, PREDEFINITA);
  assert.deepEqual(S.istantanea(S.statoIniziale(config), config, 0).votazione, PREDEFINITA);
});

test("votazione iniziale dal config: pesi, votoMin, votoMax ed etichette; i valori rotti restano quelli di partenza", () => {
  const v = S.votazioneIniziale({ pesi: { beat: 2, voce: 2, mix: 2, chat: 0 }, votoMin: 5, votoMax: 9, etichette: { beat: "Strumentale", chat: "Pubblico" } });
  assert.deepEqual(v, { pesi: { beat: 2, voce: 2, mix: 2, chat: 0 }, min: 5, max: 9, etichette: { beat: "Strumentale", voce: "Voce", mix: "Mix", chat: "Pubblico" } });
  const rotta = S.votazioneIniziale({ pesi: { beat: "tanto", voce: -1 }, votoMin: 12, votoMax: "dieci", etichette: { mix: "", voce: "una voce lunghissima" } });
  assert.deepEqual(rotta, PREDEFINITA);
});

test("punteggi 30/30/30/10: voti 8, 8, 8 e chat 4 → totale 7,6", () => {
  const stato = S.statoIniziale(config);
  for (const categoria of S.CATEGORIE) S.impostaVoto(stato, { categoria, valore: 8 });
  assert.equal(S.punteggi(stato.corrente, stato.votazione.pesi).totale, 8, "senza voti dalla chat pesano solo i giudici");
  S.apriVotoChat(stato, 0, 0);
  S.votoChat(stato, { piattaforma: "tiktok", utente: "a" }, 4, 1);
  const p = S.punteggi(stato.corrente, stato.votazione.pesi);
  assert.deepEqual([p.chat, p.totale], [4, 7.6]);
  assert.equal(S.istantanea(stato, config, 5).corrente.punteggi.totale, 7.6, "anche quello che vede la pagina");
  assert.equal(S.conferma(stato, config, 5).risultato.totale, 7.6, "e quello che entra in classifica");
});

test("conferma e istantanea leggono i pesi della votazione, non quelli del config", () => {
  const stato = S.statoIniziale({ ...config, pesi: { beat: 1, voce: 1, mix: 1, chat: 1 } });
  S.impostaVotazione(stato, { pesi: { beat: 1, voce: 0, mix: 0, chat: 0 } });
  S.impostaVoto(stato, { categoria: "beat", valore: 9 });
  S.impostaVoto(stato, { categoria: "voce", valore: 5 });
  assert.equal(S.conferma(stato, { ...config, pesi: { beat: 1, voce: 1, mix: 1, chat: 1 } }, 1).risultato.totale, 9);
  assert.equal(S.istantanea(stato, config, 1).corrente.punteggi.totale, 9);
});

test("impostaVoto usa l'intervallo della votazione: 3 → errore, 4 ok", () => {
  const stato = S.statoIniziale(config);
  assert.throws(() => S.impostaVoto(stato, { categoria: "beat", valore: 3 }), /Il voto deve essere tra 4 e 10/);
  assert.equal(stato.corrente.voti.beat, null);
  S.impostaVoto(stato, { categoria: "beat", valore: 4 });
  assert.equal(stato.corrente.voti.beat, 4);
  S.impostaVotazione(stato, { min: 0 });
  S.impostaVoto(stato, { categoria: "voce", valore: 3 });
  assert.equal(stato.corrente.voti.voce, 3);
  assert.throws(() => S.impostaVoto(stato, { categoria: "voce", valore: 10.5 }), /tra 0 e 10/);
});

test("impostaVotazione: pesi, intervallo ed etichette validi", () => {
  const stato = S.statoIniziale(config);
  S.impostaVotazione(stato, { pesi: { beat: 2, voce: 2, mix: 2, chat: 4 }, min: 5, max: 9, etichette: { beat: "Strumentale", chat: "Pubblico" } });
  assert.deepEqual(stato.votazione, { pesi: { beat: 2, voce: 2, mix: 2, chat: 4 }, min: 5, max: 9, etichette: { beat: "Strumentale", voce: "Voce", mix: "Mix", chat: "Pubblico" } });
  // cambia solo quello che si nomina
  S.impostaVotazione(stato, { pesi: { chat: 0 } });
  assert.deepEqual(stato.votazione.pesi, { beat: 2, voce: 2, mix: 2, chat: 0 });
  S.impostaVotazione(stato, {});
  assert.deepEqual([stato.votazione.min, stato.votazione.max, stato.votazione.etichette.chat], [5, 9, "Pubblico"]);
  // i pesi sono interi: un testo di cifre vale, un decimale si arrotonda; le etichette si ripuliscono dagli spazi
  S.impostaVotazione(stato, { pesi: { beat: "5", voce: 2.6 }, etichette: { mix: "  Master  " } });
  assert.deepEqual([stato.votazione.pesi.beat, stato.votazione.pesi.voce, stato.votazione.etichette.mix], [5, 3, "Master"]);
  // 12 caratteri sono il massimo; 0 e 100 sono i pesi estremi
  S.impostaVotazione(stato, { pesi: { mix: 100, chat: 0 }, etichette: { voce: "123456789012" } });
  assert.deepEqual([stato.votazione.pesi.mix, stato.votazione.etichette.voce], [100, "123456789012"]);
});

test("impostaVotazione: errori in italiano e niente cambia se un valore è sbagliato", () => {
  const stato = S.statoIniziale(config);
  const prima = structuredClone(stato.votazione);
  const casi = [
    [{ min: 10 }, /Il voto minimo deve essere più basso del massimo/],
    [{ max: 4 }, /Il voto minimo deve essere più basso del massimo/],
    [{ min: 6, max: 6 }, /più basso del massimo/],
    [{ min: 11 }, /Voto minimo: tra 0 e 10/],
    [{ max: -1 }, /Voto massimo: tra 0 e 10/],
    [{ min: "" }, /Voto minimo: tra 0 e 10/],
    [{ pesi: { beat: 0, voce: 0, mix: 0, chat: 0 } }, /Almeno un peso deve essere maggiore di zero/],
    [{ pesi: { beat: 101 } }, /Peso «Beat»: tra 0 e 100/],
    [{ pesi: { voce: -1 } }, /Peso «Voce»: tra 0 e 100/],
    [{ pesi: { beat: "tanto" } }, /Peso «Beat»: tra 0 e 100/],
    [{ pesi: { colore: 3 } }, /Peso sconosciuto/],
    [{ pesi: "tutti uguali" }, /Pesi: servono i pesi/],
    [{ etichette: { beat: "" } }, /non può essere vuoto/],
    [{ etichette: { beat: "   " } }, /non può essere vuoto/],
    [{ etichette: { beat: "1234567890123" } }, /al massimo 12 caratteri/],
    [{ etichette: { beat: 7 } }, /serve un testo/],
    [{ etichette: { colore: "Rosso" } }, /Etichetta sconosciuta/],
    [{ etichette: ["Beat"] }, /Etichette: servono le diciture/],
    // un valore buono insieme a uno sbagliato: non cambia nemmeno quello buono
    [{ pesi: { beat: 5 }, min: 11 }, /Voto minimo/],
    [{ etichette: { beat: "Strumentale" }, pesi: { mix: 200 } }, /Peso «Mix»/],
    [{ min: 5, etichette: { chat: "" } }, /non può essere vuoto/],
  ];
  for (const [modifiche, atteso] of casi) {
    assert.throws(() => S.impostaVotazione(stato, modifiche), atteso, JSON.stringify(modifiche));
    assert.deepEqual(stato.votazione, prima, `niente cambia: ${JSON.stringify(modifiche)}`);
  }
  // l'ultimo peso acceso non si spegne, nemmeno in due comandi separati
  S.impostaVotazione(stato, { pesi: { beat: 0, voce: 0, mix: 0 } });
  assert.throws(() => S.impostaVotazione(stato, { pesi: { chat: 0 } }), /Almeno un peso/);
  assert.equal(stato.votazione.pesi.chat, 1);
});

test("fondiVotazione: stato senza votazione o con valori rotti → predefiniti campo per campo", () => {
  for (const vuoto of [undefined, null, "rotto", 7, [], [1, 2]]) assert.deepEqual(S.fondiVotazione(vuoto, config), PREDEFINITA, String(vuoto));
  const salvato = { pesi: { beat: 2, voce: "x", mix: 101 }, min: 6, max: 3, etichette: { beat: "Strumentale", voce: "", mix: 5 } };
  assert.deepEqual(S.fondiVotazione(salvato, config), { pesi: { beat: 2, voce: 3, mix: 3, chat: 1 }, min: 6, max: 10, etichette: { beat: "Strumentale", voce: "Voce", mix: "Mix", chat: "Chat" } });
  // i campi che mancano ripartono dal config
  const daConfig = { pesi: { beat: 2, voce: 2, mix: 2, chat: 2 }, votoMin: 5 };
  assert.deepEqual(S.fondiVotazione({ max: 9 }, daConfig), { pesi: { beat: 2, voce: 2, mix: 2, chat: 2 }, min: 5, max: 9, etichette: PREDEFINITA.etichette });
  // un salvataggio con tutti i pesi a zero tiene l'ultimo valore buono, non resta senza pesi
  const senzaPesi = S.fondiVotazione({ pesi: { beat: 0, voce: 0, mix: 0, chat: 0 } }, config);
  assert.ok(Object.values(senzaPesi.pesi).some((p) => p > 0), JSON.stringify(senzaPesi.pesi));
});
