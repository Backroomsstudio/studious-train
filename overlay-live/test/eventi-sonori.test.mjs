import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../lib/stato.mjs";
import * as B from "../lib/battle.mjs";
import { suoniTraccia, cambiClassifica, suoniClassifica, suoniTimer, suoniBattle, suoniTimerBattle, msTimerBattle, suonaIn } from "../public/js/eventi-sonori.js";
import { NOMI_SUONI, suona } from "../public/js/suoni.js";
import { FINE_RIVELAZIONE_MS, RITARDO_VITTORIA_MS, RULLO_VITTORIA_MS } from "../public/js/battle-logica.js";

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

// ---------- Battle ----------

const TB = 1_000_000;
const gongEv = (quando) => ({ nome: "gong", dati: { quando } });
const FANFARA = { nome: "vincitore", dati: { rullo: RULLO_VITTORIA_MS / 1000 } };

function statoBattle() {
  const stato = S.statoIniziale(config);
  B.impostaScontro(stato, { sx: { nome: "Lince" }, dx: { nome: "Nove" } });
  return stato;
}

// Porta il round alla fase «voto» con i voti scritti (8,8,8 contro 6,6,6).
function fineRound(stato) {
  B.avvia(stato, TB);
  B.passaSeTocca(stato, TB + B.CONTO_MS);
  B.termina(stato, TB + B.CONTO_MS + 1000);
  for (const id of B.GIUDICI_BATTLE) {
    B.votoGiudice(stato, { giudice: id, lato: "sx", valore: 8 });
    B.votoGiudice(stato, { giudice: id, lato: "dx", valore: 6 });
  }
}

test("battle: al primo disegno nessun suono", () => {
  assert.deepEqual(suoniBattle(null, foto(statoBattle()), [gongEv("inizio")]), []);
});

test("battle: il 3-2-1 suona tre bip a un secondo l'uno dall'altro", () => {
  const stato = statoBattle();
  const prima = foto(stato);
  B.avvia(stato, TB);
  assert.deepEqual(suoniBattle(prima, foto(stato, TB), []), [
    { nome: "conto", dati: { n: 3 }, ritardo: 0 },
    { nome: "conto", dati: { n: 2 }, ritardo: 1000 },
    { nome: "conto", dati: { n: 1 }, ritardo: 2000 },
  ]);
});

test("battle: gong e spacco al via, solo gong alla fine", () => {
  const stato = statoBattle();
  const prima = foto(stato);
  assert.deepEqual(nomi(suoniBattle(prima, foto(stato), [gongEv("inizio")])), ["gong", "spacco"]);
  assert.deepEqual(nomi(suoniBattle(prima, foto(stato), [gongEv("fine")])), ["gong"]);
});

test("battle: timer, sirena a 30 secondi e tic negli ultimi 10", () => {
  assert.deepEqual(suoniTimerBattle(31_000, 29_900), [{ nome: "allarme" }]);
  assert.deepEqual(suoniTimerBattle(29_000, 28_000), []);
  assert.deepEqual(suoniTimerBattle(11_000, 9_900), [{ nome: "tic", dati: { ultimi: false } }]);
  assert.deepEqual(suoniTimerBattle(3_500, 2_900), [{ nome: "tic", dati: { ultimi: true } }]);
  assert.deepEqual(suoniTimerBattle(5_000, 0), [], "a zero ci pensa il gong");
  assert.deepEqual(suoniTimerBattle(null, 5_000), []);

  const stato = statoBattle();
  B.avvia(stato, TB);
  B.passaSeTocca(stato, TB + B.CONTO_MS);
  const fine = stato.battle.timer.fineAlle;
  // Il timer suona dal ciclo della pagina (ogni 50 ms), non dagli aggiornamenti dello stato: con la chat ferma
  // il server non manda niente per tutto il round e la sirena a 30 secondi non arriverebbe.
  assert.deepEqual(suoniBattle(foto(stato, fine - 31_000), foto(stato, fine - 29_900), []), []);
});

test("battle: tempo rimasto per il ciclo del timer, solo mentre corre", () => {
  const stato = statoBattle();
  assert.equal(msTimerBattle(foto(stato), 0), null, "prima del via");
  B.avvia(stato, TB);
  B.passaSeTocca(stato, TB + B.CONTO_MS);
  const fine = stato.battle.timer.fineAlle;
  assert.equal(msTimerBattle(foto(stato), fine - 29_900), 29_900);
  assert.equal(msTimerBattle(foto(stato), fine + 5_000), 0, "mai negativo");
  B.timerAzione(stato, "pausa", fine - 20_000);
  assert.equal(msTimerBattle(foto(stato), fine - 10_000), null, "in pausa non suona");
  B.timerAzione(stato, "riprendi", fine - 10_000);
  B.termina(stato, fine - 5_000);
  assert.equal(msTimerBattle(foto(stato), fine), null, "a fine round");
});

test("battle: la rivelazione dei voti suona un voto per giudice e il calcolo del totale", () => {
  const stato = statoBattle();
  fineRound(stato);
  const prima = foto(stato);
  B.rivela(stato, TB + 9000);
  assert.deepEqual(suoniBattle(prima, foto(stato), []), [
    { nome: "voto", dati: { valore: 8 }, ritardo: 0 },
    { nome: "voto", dati: { valore: 8 }, ritardo: 900 },
    { nome: "voto", dati: { valore: 8 }, ritardo: 1800 },
    { nome: "calcolo", ritardo: 3600 },
    { ...FANFARA, ritardo: FINE_RIVELAZIONE_MS + RITARDO_VITTORIA_MS },
  ]);
});

test("battle: ogni vincitore di round fa suonare la fanfara, in tempo con la schermata del vincitore", () => {
  const stato = statoBattle();
  fineRound(stato);
  const prima = foto(stato);
  B.rivela(stato, TB + 9000);
  const suoni = suoniBattle(prima, foto(stato), []);
  assert.deepEqual(suoni.at(-1), { ...FANFARA, ritardo: FINE_RIVELAZIONE_MS + RITARDO_VITTORIA_MS });
  assert.equal(suoni.filter((x) => x.nome === "vincitore").length, 1, "una sola fanfara, anche se il round chiude il torneo");
});

test("battle: suoni e fanfara partono anche se la pagina non ha visto la fase «voto» (messaggi uniti ogni 50 ms)", () => {
  const stato = statoBattle();
  B.avvia(stato, TB);
  B.passaSeTocca(stato, TB + B.CONTO_MS);
  const inCorso = foto(stato); // ultimo stato visto: il round è ancora in corso
  B.termina(stato, TB + B.CONTO_MS + 1000);
  for (const id of B.GIUDICI_BATTLE) {
    B.votoGiudice(stato, { giudice: id, lato: "sx", valore: 8 });
    B.votoGiudice(stato, { giudice: id, lato: "dx", valore: 6 });
  }
  B.rivela(stato, TB + 9000);
  const suoni = suoniBattle(inCorso, foto(stato), []);
  assert.deepEqual(suoni.map((x) => x.nome), ["voto", "voto", "voto", "calcolo", "vincitore"]);
});

test("battle: con un pari merito la fanfara aspetta la proclamazione", () => {
  const stato = statoBattle();
  B.avvia(stato, TB);
  B.passaSeTocca(stato, TB + B.CONTO_MS);
  B.termina(stato, TB + B.CONTO_MS + 1000);
  for (const id of B.GIUDICI_BATTLE) for (const lato of ["sx", "dx"]) B.votoGiudice(stato, { giudice: id, lato, valore: 7 });
  const prima = foto(stato);
  B.rivela(stato, TB + 9000);
  assert.equal(stato.battle.risultato.pari, true);
  assert.equal(suoniBattle(prima, foto(stato), []).some((x) => x.nome === "vincitore"), false, "niente fanfara senza vincitore");
  const pari = foto(stato);
  B.proclamaBattle(stato, "dx");
  assert.deepEqual(suoniBattle(pari, foto(stato), []), [{ ...FANFARA, ritardo: 0 }]);
});

test("battle: «Rivedi vincitore» rifà la fanfara; il campione da solo non basta", () => {
  const stato = statoBattle();
  fineRound(stato);
  B.rivela(stato, TB + 9000);
  const fatto = foto(stato);
  assert.deepEqual(suoniBattle(fatto, fatto, [{ nome: "vittoria", dati: {} }]), [{ ...FANFARA, ritardo: 0 }]);
  const dopo = structuredClone(fatto);
  dopo.battle.tabellone.torneo.campione = { nome: "Lince", instagram: "" };
  assert.deepEqual(suoniBattle(fatto, dopo, []), [], "il campione nasce sempre con un round: la fanfara è già partita da lì");
});

test("battle: suona solo la pagina del layout in onda e gli effetti nuovi esistono", () => {
  assert.equal(suonaIn({ layout: "battle", suoni: { dove: "overlay" } }, "battle", "overlay"), true);
  assert.equal(suonaIn({ layout: "battle", suoni: { dove: "overlay" } }, "gara", "overlay"), false);
  assert.equal(suonaIn({ layout: "studio", suoni: { dove: "overlay" } }, "battle", "overlay"), false);
  for (const nome of ["gong", "conto", "spacco"]) assert.ok(NOMI_SUONI.includes(nome), nome);
  assert.doesNotThrow(() => suona("gong"), "senza audio del browser non fa niente");
});

test("battle: i pulsanti Prova della regia fanno suonare l'effetto scelto", () => {
  const stato = statoBattle();
  const prova = (dati) => [{ nome: "suono", dati }];
  assert.deepEqual(suoniBattle(foto(stato), foto(stato), prova({ nome: "gong" })), [{ nome: "gong" }]);
  assert.deepEqual(suoniBattle(foto(stato), foto(stato), prova({ nome: "conto", dati: { n: 1 } })), [{ nome: "conto", dati: { n: 1 } }]);
  assert.deepEqual(suoniBattle(null, foto(stato), prova({ nome: "gong" })), [], "mai al primo disegno");
});
