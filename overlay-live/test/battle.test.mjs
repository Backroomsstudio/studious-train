import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../lib/stato.mjs";
import * as B from "../lib/battle.mjs";

const config = { giudici: { beat: "A", voce: "B", mix: "C" }, pesi: { beat: 1, voce: 1, mix: 1, chat: 1 }, topN: 3, premio: "Mix" };
const nuovo = () => S.statoIniziale(config);

// Scrive i voti dei tre giudici (Luca, Freya, Daniele) per un lato.
function votiGiudici(stato, lato, [luca, freya, daniele]) {
  const valori = { luca, freya, daniele };
  for (const g of stato.battle.giudici) g.voti[lato] = valori[g.id];
}

// Apre la chat e fa votare `sx` utenti per il lato sinistro e `dx` per il destro.
function votiChat(stato, sx, dx) {
  stato.battle.chat.aperta = true;
  for (let i = 0; i < sx; i++) B.votoChatBattle(stato, { piattaforma: "tiktok", utente: `s${i}` }, "sx", 0);
  for (let i = 0; i < dx; i++) B.votoChatBattle(stato, { piattaforma: "tiktok", utente: `d${i}` }, "dx", 0);
}

test("partenza: stato battle di default", () => {
  const stato = nuovo();
  assert.deepEqual(stato.battle, B.battleIniziale());
  const b = stato.battle;
  assert.equal(b.fase, "attesa");
  assert.equal(b.round, 1);
  assert.equal(b.timer.durataSecondi, 90);
  assert.equal(b.modalita.scelta, "stileLibero");
  assert.deepEqual(b.modalita.elenco.map((m) => m.id), ["stileLibero", "treQuarti", "tematica", "anni90", "beatAScelta", "situazione", "custom"]);
  assert.deepEqual(b.giudici.map((g) => g.nome), ["Luca", "Freya", "Daniele"]);
  assert.equal(b.tabellone.punti.target, 30);
  assert.equal(S.LAYOUT.length, 4);
  assert.equal(S.LAYOUT[3], "battle");
  assert.equal(stato.visibili.bracket, false);
  assert.equal(stato.visibili.barreVita, true);
  assert.equal(S.istantanea(stato, config, 0).battle.chat.voti, 0);
});

test("chat: lettore dei comandi", () => {
  const casi = { "1": "sx", " 2 ": "dx", SX: "sx", "!dx": "dx", "!1": "sx", "12": null, "1 vs 2": null, "3": null, uno: null, "": null };
  for (const [testo, atteso] of Object.entries(casi)) assert.equal(B.leggiVotoBattle(testo), atteso, `"${testo}"`);
  assert.equal(B.leggiVotoBattle(null), null);
  assert.equal(B.leggiVotoBattle(undefined), null);
});

test("chat: un voto per utente e solo a chat aperta", () => {
  const stato = nuovo();
  const mario = { piattaforma: "tiktok", utente: "Mario" };
  assert.equal(B.votoChatBattle(stato, mario, "sx", 0), false);
  stato.battle.chat.aperta = true;
  assert.equal(B.votoChatBattle(stato, mario, "sx", 0), true);
  assert.equal(B.votoChatBattle(stato, { ...mario, utente: "MARIO" }, "dx", 1), true);
  assert.equal(Object.keys(stato.battle.chat.voti).length, 1);
  assert.equal(stato.battle.chat.voti["tiktok:mario"], "dx");
  assert.equal(B.votoChatBattle(stato, { piattaforma: "tiktok", utente: "" }, "sx", 2), false);
  assert.equal(B.votoChatBattle(stato, mario, null, 3), false);
});

test("quota: senza voti 50/50, altrimenti la quota dei voti", () => {
  const stato = nuovo();
  assert.deepEqual(B.quota(stato.battle.chat), { sx: 0.5, dx: 0.5, voti: 0 });
  votiChat(stato, 3, 1);
  assert.deepEqual(B.quota(stato.battle.chat), { sx: 0.75, dx: 0.25, voti: 4 });
});

test("risultato: media di giudici e chat", () => {
  const stato = nuovo();
  votiGiudici(stato, "sx", [8, 8, 8]);
  votiGiudici(stato, "dx", [6, 6, 6]);
  votiChat(stato, 3, 1);
  const r = B.calcolaRisultato(stato.battle);
  assert.deepEqual(r.totali, { sx: 7.88, dx: 5.13 });
  assert.equal(r.vincitore, "sx");
  assert.equal(r.pari, false);
  assert.deepEqual(r.parziali.chat, { sx: 7.5, dx: 2.5 });
  assert.deepEqual(r.parziali.luca, { sx: 8, dx: 6 });
});

test("risultato: mancano i voti di un giudice", () => {
  const stato = nuovo();
  votiGiudici(stato, "sx", [8, null, 8]);
  votiGiudici(stato, "dx", [6, 6, 6]);
  assert.throws(() => B.calcolaRisultato(stato.battle), /Mancano i voti di Freya/);
});

test("risultato: pari merito", () => {
  const stato = nuovo();
  votiGiudici(stato, "sx", [8, 7, 9]);
  votiGiudici(stato, "dx", [7, 8, 9]);
  votiChat(stato, 1, 1);
  const r = B.calcolaRisultato(stato.battle);
  assert.equal(r.pari, true);
  assert.equal(r.vincitore, null);
  assert.deepEqual(r.totali, { sx: 7.25, dx: 7.25 });
});

test("istantanea: la mappa dei voti della chat non viaggia, restano i conteggi e la quota", () => {
  const stato = nuovo();
  votiChat(stato, 3, 1);
  const foto = S.istantanea(stato, config, 0).battle;
  assert.deepEqual(foto.chat, { aperta: true, sx: 3, dx: 1, voti: 4 });
  assert.deepEqual(foto.quota, { sx: 0.75, dx: 0.25, voti: 4 });
  assert.equal(Object.keys(stato.battle.chat.voti).length, 4, "lo stato originale non cambia");
});

test("fondiBattle: stato vecchio o rotto", () => {
  assert.deepEqual(B.fondiBattle(undefined), B.battleIniziale());
  assert.deepEqual(B.fondiBattle("x"), B.battleIniziale());
  const rotto = B.fondiBattle({ fase: "boh", round: -3, timer: { durataSecondi: 99999 }, sx: { nome: 42 } });
  assert.equal(rotto.fase, "attesa");
  assert.equal(rotto.round, 1);
  assert.equal(rotto.timer.durataSecondi, 90);
  assert.equal(rotto.sx.nome, "");
  const buono = B.fondiBattle({ round: 4, timer: { durataSecondi: 120 } });
  assert.equal(buono.round, 4);
  assert.equal(buono.timer.durataSecondi, 120);
});

test("fondiBattle: uno stato in corso valido resta com'è", () => {
  const stato = nuovo();
  stato.battle.fase = "battle";
  stato.battle.round = 3;
  stato.battle.sx = { nome: "Lince", instagram: "lince.music" };
  stato.battle.timer.fineAlle = 123456;
  votiChat(stato, 2, 1);
  votiGiudici(stato, "sx", [8, 7, 9]);
  const dopo = B.fondiBattle(JSON.parse(JSON.stringify(stato.battle)));
  assert.deepEqual(dopo, stato.battle);
});

// ---------- Impostazioni dalla regia ----------

test("scontro: nomi e Instagram puliti", () => {
  const stato = nuovo();
  B.impostaScontro(stato, { sx: { nome: "  Lince ", instagram: "https://www.instagram.com/lince.music/?hl=it" }, dx: { nome: "Nove" } });
  assert.deepEqual(stato.battle.sx, { nome: "Lince", instagram: "lince.music" });
  assert.deepEqual(stato.battle.dx, { nome: "Nove", instagram: "" });
  B.impostaScontro(stato, { dx: { instagram: "@nove.mc" } });
  assert.deepEqual(stato.battle.dx, { nome: "Nove", instagram: "nove.mc" }, "cambia solo il campo scritto");
});

test("scontro: errori e atomicità", () => {
  const stato = nuovo();
  assert.throws(() => B.impostaScontro(stato, { sx: { nome: "x".repeat(25) } }), /24 caratteri/);
  assert.throws(() => B.impostaScontro(stato, { sx: { nome: "Kappa" }, dx: { instagram: "non valido!" } }));
  assert.equal(stato.battle.sx.nome, "", "una parte sbagliata: non cambia niente");
  stato.battle.fase = "battle";
  assert.throws(() => B.impostaScontro(stato, { sx: { nome: "Lince" } }), /Cambia i nomi/);
});

test("modalità: scelta e testo", () => {
  const stato = nuovo();
  B.impostaModalita(stato, { scelta: "tematica", testo: "Vicenza di notte" });
  assert.equal(stato.battle.modalita.scelta, "tematica");
  assert.equal(stato.battle.modalita.elenco.find((m) => m.id === "tematica").testo, "Vicenza di notte");
  assert.throws(() => B.impostaModalita(stato, { scelta: "stileLibero", testo: "x" }), /non ha testo/);
  assert.throws(() => B.impostaModalita(stato, { scelta: "custom" }), /spenta|non trovata/);
  assert.throws(() => B.impostaModalita(stato, { scelta: "boh" }), /non trovata/);

  const undici = Array.from({ length: 11 }, (_, i) => ({ id: `m${i}`, nome: `M${i}`, conTesto: false, attiva: true }));
  assert.throws(() => B.impostaModalita(stato, { elenco: undici }), /10/);

  const elenco = [...stato.battle.modalita.elenco, { nome: "Rime baciate", conTesto: false, attiva: true }];
  B.impostaModalita(stato, { elenco });
  const nuova = stato.battle.modalita.elenco.at(-1);
  assert.ok(nuova.id, "la voce nuova riceve un id");
  B.impostaModalita(stato, { scelta: nuova.id });
  assert.equal(stato.battle.modalita.scelta, nuova.id);
});

test("modalità: la voce in onda non si può spegnere o togliere", () => {
  const stato = nuovo();
  const spenta = stato.battle.modalita.elenco.map((m) => (m.id === "stileLibero" ? { ...m, attiva: false } : m));
  assert.throws(() => B.impostaModalita(stato, { elenco: spenta }), /in onda/);
  assert.equal(stato.battle.modalita.elenco[0].attiva, true);
});

test("timer, giudici e pop-up", () => {
  const stato = nuovo();
  B.impostaTimer(stato, { durataSecondi: "120" });
  assert.equal(stato.battle.timer.durataSecondi, 120);
  for (const valore of [9, 601]) assert.throws(() => B.impostaTimer(stato, { durataSecondi: valore }), /tra 10 e 600/);

  B.impostaGiudici(stato, { luca: "Luca C." });
  assert.deepEqual(stato.battle.giudici.map((g) => g.nome), ["Luca C.", "Freya", "Daniele"]);
  assert.throws(() => B.impostaGiudici(stato, { freya: "" }), /vuoto/);
  assert.throws(() => B.impostaGiudici(stato, { luca: "Gigi", daniele: "x".repeat(25) }));
  assert.equal(stato.battle.giudici[0].nome, "Luca C.", "atomico");

  const popup = stato.battle.popup.elenco;
  const nove = Array.from({ length: 9 }, (_, i) => ({ icona: "dm", titolo: `P${i}`, sopra: "", sotto: "" }));
  assert.throws(() => B.impostaPopup(stato, { elenco: nove }), /8/);
  assert.throws(() => B.impostaPopup(stato, { ogniMinuti: 31 }));
  assert.throws(() => B.impostaPopup(stato, { durata: 3 }));
  B.impostaPopup(stato, { ogniMinuti: 0, durata: 12 });
  assert.deepEqual([stato.battle.popup.ogniMinuti, stato.battle.popup.durata], [0, 12]);
  assert.deepEqual(stato.battle.popup.elenco, popup);
});

test("nuova serata conserva la configurazione", () => {
  const stato = nuovo();
  B.impostaGiudici(stato, { luca: "Luca C." });
  B.impostaModalita(stato, { scelta: "tematica", testo: "Vicenza di notte" });
  B.impostaTimer(stato, { durataSecondi: 120 });
  B.impostaPopup(stato, { ogniMinuti: 7 });
  B.impostaScontro(stato, { sx: { nome: "Lince" }, dx: { nome: "Nove" } });
  stato.battle.round = 5;
  stato.battle.giudici[0].voti.sx = 8;
  votiChat(stato, 2, 1);
  const n = B.battleNuovaSerata(stato.battle);
  assert.equal(n.round, 1);
  assert.equal(n.fase, "attesa");
  assert.deepEqual(n.chat, { aperta: false, voti: {} });
  assert.equal(n.sx.nome, "");
  assert.equal(n.giudici[0].voti.sx, null);
  assert.equal(n.giudici[0].nome, "Luca C.");
  assert.deepEqual(n.modalita, stato.battle.modalita);
  assert.equal(n.timer.durataSecondi, 120);
  assert.equal(n.popup.ogniMinuti, 7);
});

// ---------- Fasi del round ----------

const T = 1_000_000;
const gong = (quando) => ({ nome: "gong", dati: { quando } });

function pronto(stato) {
  B.impostaScontro(stato, { sx: { nome: "Lince" }, dx: { nome: "Nove" } });
}

// Porta il round fino alla fase «voto»: nomi, 3-2-1, battle e fine anticipata.
function giocaFinoAlVoto(stato, t = T) {
  pronto(stato);
  B.avvia(stato, t);
  B.passaSeTocca(stato, t + B.CONTO_MS);
  B.termina(stato, t + B.CONTO_MS + 1000);
}

// Scrive i voti dei tre giudici per entrambi i lati dalla regia.
function scriviVoti(stato, sx, dx) {
  for (const [i, id] of B.GIUDICI_BATTLE.entries()) {
    B.votoGiudice(stato, { giudice: id, lato: "sx", valore: sx[i] });
    B.votoGiudice(stato, { giudice: id, lato: "dx", valore: dx[i] });
  }
}

test("avvia: servono i nomi e parte il 3-2-1", () => {
  const stato = nuovo();
  assert.throws(() => B.avvia(stato, T), /Mancano i nomi/);
  B.impostaScontro(stato, { sx: { nome: "lince" }, dx: { nome: "Lince" } });
  assert.throws(() => B.avvia(stato, T), /nomi diversi/);
  B.impostaScontro(stato, { dx: { nome: "Nove" } });
  stato.visibili.bracket = true;
  B.avvia(stato, T);
  assert.equal(stato.battle.fase, "countdown");
  assert.equal(stato.battle.conto.finoAlle, T + 3000);
  assert.equal(stato.visibili.bracket, false);
  assert.throws(() => B.avvia(stato, T + 1), /già avviato/);
});

test("passaSeTocca: fine del conto → battle, gong d'inizio, chat aperta", () => {
  const stato = nuovo();
  pronto(stato);
  B.avvia(stato, T);
  assert.deepEqual(B.passaSeTocca(stato, T + 2999), []);
  assert.equal(stato.battle.fase, "countdown");
  assert.deepEqual(B.passaSeTocca(stato, T + 3000), [gong("inizio")]);
  assert.equal(stato.battle.fase, "battle");
  assert.equal(stato.battle.chat.aperta, true);
  assert.equal(stato.battle.timer.fineAlle, T + 3000 + 90_000);
  assert.equal(stato.battle.conto.finoAlle, null);
});

test("scadenza del timer → voto, chat chiusa, gong di fine, una volta sola", () => {
  const stato = nuovo();
  pronto(stato);
  B.avvia(stato, T);
  B.passaSeTocca(stato, T + 3000);
  assert.equal(B.votoChatBattle(stato, { piattaforma: "tiktok", utente: "a" }, "sx", T + 4000), true);
  const fine = stato.battle.timer.fineAlle;
  assert.deepEqual(B.passaSeTocca(stato, fine - 1), []);
  assert.deepEqual(B.passaSeTocca(stato, fine), [gong("fine")]);
  assert.equal(stato.battle.fase, "voto");
  assert.equal(stato.battle.chat.aperta, false);
  assert.equal(stato.battle.timer.scaduto, true);
  assert.equal(B.votoChatBattle(stato, { piattaforma: "tiktok", utente: "tardi" }, "dx", fine + 1), false, "voti dopo il gong non contano");
  assert.deepEqual(B.passaSeTocca(stato, fine + 1000), []);
});

test("pausa e ripresa del timer", () => {
  const stato = nuovo();
  pronto(stato);
  assert.throws(() => B.timerAzione(stato, "pausa", T), /battle/);
  B.avvia(stato, T);
  const t0 = T + B.CONTO_MS;
  B.passaSeTocca(stato, t0);
  assert.equal(stato.battle.timer.fineAlle, t0 + 90_000);
  B.timerAzione(stato, "pausa", t0 + 10_000);
  assert.deepEqual([stato.battle.timer.rimanenteMs, stato.battle.timer.fineAlle], [80_000, null]);
  assert.deepEqual(B.passaSeTocca(stato, t0 + 200_000), [], "in pausa il timer non scade");
  B.timerAzione(stato, "riprendi", t0 + 50_000);
  assert.equal(stato.battle.timer.fineAlle, t0 + 130_000);
  assert.throws(() => B.timerAzione(stato, "salta", t0), /non valida/);
});

test("termina: dal battle al voto; fuori dal battle errore", () => {
  const stato = nuovo();
  assert.throws(() => B.termina(stato, T), /non è in corso/);
  pronto(stato);
  B.avvia(stato, T);
  B.passaSeTocca(stato, T + 3000);
  assert.deepEqual(B.termina(stato, T + 5000), [gong("fine")]);
  assert.equal(stato.battle.fase, "voto");
});

test("riavvio del server a metà round: un solo gong, niente scadenze immediate", () => {
  const stato = nuovo();
  pronto(stato);
  B.avvia(stato, T);
  B.passaSeTocca(stato, T + 3000);
  const fine = stato.battle.timer.fineAlle;
  assert.deepEqual(B.passaSeTocca(stato, fine + 3_600_000), [gong("fine")]);
  assert.deepEqual(B.passaSeTocca(stato, fine + 3_600_001), []);

  const altro = nuovo();
  pronto(altro);
  B.avvia(altro, T);
  assert.deepEqual(B.passaSeTocca(altro, T + 3_600_000), [gong("inizio")]);
  assert.equal(altro.battle.timer.fineAlle, T + 3_600_000 + 90_000, "il timer riparte da ora, non scade subito");
});

test("voti dei giudici: solo a fine round, un decimale, virgola, cancellazione", () => {
  const stato = nuovo();
  pronto(stato);
  B.avvia(stato, T);
  B.passaSeTocca(stato, T + 3000);
  assert.throws(() => B.votoGiudice(stato, { giudice: "luca", lato: "sx", valore: 7 }), /a fine round/);
  B.termina(stato, T + 5000);
  B.votoGiudice(stato, { giudice: "luca", lato: "sx", valore: "7,5" });
  assert.equal(stato.battle.giudici[0].voti.sx, 7.5);
  assert.throws(() => B.votoGiudice(stato, { giudice: "luca", lato: "sx", valore: 11 }), /tra 0 e 10/);
  assert.throws(() => B.votoGiudice(stato, { giudice: "gigi", lato: "sx", valore: 7 }), /sconosciuto/);
  assert.throws(() => B.votoGiudice(stato, { giudice: "luca", lato: "su", valore: 7 }), /sx o dx/);
  B.votoGiudice(stato, { giudice: "luca", lato: "sx", valore: "" });
  assert.equal(stato.battle.giudici[0].voti.sx, null);
});

test("rivela: calcola e registra il round una volta sola", () => {
  const stato = nuovo();
  pronto(stato);
  B.avvia(stato, T);
  B.passaSeTocca(stato, T + 3000);
  for (let i = 0; i < 3; i++) B.votoChatBattle(stato, { piattaforma: "tiktok", utente: `s${i}` }, "sx", T + 4000);
  B.votoChatBattle(stato, { piattaforma: "tiktok", utente: "d0" }, "dx", T + 4000);
  B.termina(stato, T + 5000);
  B.votoGiudice(stato, { giudice: "luca", lato: "sx", valore: 8 });
  assert.throws(() => B.rivela(stato, T + 6000), /Mancano i voti/);
  assert.equal(stato.battle.fase, "voto", "con voti mancanti la fase non cambia");
  scriviVoti(stato, [8, 8, 8], [6, 6, 6]);
  assert.deepEqual(B.rivela(stato, T + 7000), { vincitore: "sx", pari: false });
  const b = stato.battle;
  assert.equal(b.fase, "risultato");
  assert.deepEqual(b.risultato.totali, { sx: 7.88, dx: 5.13 });
  assert.equal(b.risultato.registrato, true);
  assert.equal(b.risultato.rivelatoAlle, T + 7000);
  assert.throws(() => B.rivela(stato, T + 8000), /fine round/);
});

test("rivela: con un voto di Freya mancante l'errore nomina Freya", () => {
  const stato = nuovo();
  giocaFinoAlVoto(stato);
  B.votoGiudice(stato, { giudice: "luca", lato: "sx", valore: 8 });
  B.votoGiudice(stato, { giudice: "luca", lato: "dx", valore: 6 });
  assert.throws(() => B.rivela(stato, T + 9000), /Mancano i voti di Freya/);
});

test("pari merito: il round resta aperto finché la regia non proclama", () => {
  const stato = nuovo();
  pronto(stato);
  B.avvia(stato, T);
  B.passaSeTocca(stato, T + 3000);
  B.votoChatBattle(stato, { piattaforma: "tiktok", utente: "s" }, "sx", T + 4000);
  B.votoChatBattle(stato, { piattaforma: "tiktok", utente: "d" }, "dx", T + 4000);
  B.termina(stato, T + 5000);
  scriviVoti(stato, [8, 7, 9], [7, 8, 9]);
  assert.deepEqual(B.rivela(stato, T + 6000), { vincitore: null, pari: true });
  assert.equal(stato.battle.risultato.registrato, false);
  assert.throws(() => B.prossimo(stato), /Proclama prima/);
  B.proclamaBattle(stato, "dx");
  assert.equal(stato.battle.risultato.vincitore, "dx");
  assert.equal(stato.battle.risultato.registrato, true);
  assert.throws(() => B.proclamaBattle(stato, "sx"), /pari merito/);
});

test("proclama: solo con un pari merito", () => {
  const stato = nuovo();
  giocaFinoAlVoto(stato);
  scriviVoti(stato, [8, 8, 8], [6, 6, 6]);
  B.rivela(stato, T + 6000);
  assert.throws(() => B.proclamaBattle(stato, "dx"), /pari merito/);
});

test("prossimo: nuovo round pulito, durata del timer invariata", () => {
  const stato = nuovo();
  B.impostaTimer(stato, { durataSecondi: 120 });
  giocaFinoAlVoto(stato);
  assert.throws(() => B.prossimo(stato), /non è finito/);
  scriviVoti(stato, [8, 8, 8], [6, 6, 6]);
  B.rivela(stato, T + 6000);
  B.prossimo(stato);
  const b = stato.battle;
  assert.equal(b.fase, "attesa");
  assert.equal(b.round, 2);
  assert.deepEqual([b.sx.nome, b.dx.nome], ["", ""]);
  assert.deepEqual(b.chat, { aperta: false, voti: {} });
  assert.ok(b.giudici.every((g) => g.voti.sx === null && g.voti.dx === null));
  assert.equal(b.risultato, null);
  assert.equal(b.timer.fineAlle, null);
  assert.equal(b.timer.durataSecondi, 120);
  assert.equal(b.partitaId, null);
});

test("reset: scarta il round in corso e tiene nomi e numero del round", () => {
  const stato = nuovo();
  giocaFinoAlVoto(stato);
  B.votoGiudice(stato, { giudice: "luca", lato: "sx", valore: 8 });
  B.reset(stato);
  const b = stato.battle;
  assert.equal(b.fase, "attesa");
  assert.equal(b.round, 1);
  assert.deepEqual([b.sx.nome, b.dx.nome], ["Lince", "Nove"]);
  assert.equal(b.giudici[0].voti.sx, null);
  assert.deepEqual(b.chat, { aperta: false, voti: {} });

  giocaFinoAlVoto(stato, T + 100_000);
  scriviVoti(stato, [8, 8, 8], [6, 6, 6]);
  B.rivela(stato, T + 200_000);
  assert.throws(() => B.reset(stato), /già registrato/);
});
