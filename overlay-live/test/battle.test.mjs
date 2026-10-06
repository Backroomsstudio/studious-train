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
