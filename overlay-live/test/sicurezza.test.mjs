// Modalità sicura TikTok: niente link, URL, account di altre piattaforme né inviti a uscire da TikTok sullo schermo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applicaSicurezza, pulisciTesto, LINK_BIO } from "../public/js/sicurezza.js";
import * as Z from "../lib/sicurezza.mjs";
import { statoIniziale } from "../lib/stato.mjs";
import { istantanea } from "../lib/stato.mjs";
import { avviaServer } from "./aiuti-server.mjs";

test("pulisciTesto: gli indirizzi diventano «link in bio», gli account spariscono, i separatori restano in ordine", () => {
  assert.equal(pulisciTesto("nero.fan/backrooms"), LINK_BIO);
  assert.equal(pulisciTesto("Manda la tua traccia su nero.fan/backrooms"), `Manda la tua traccia: ${LINK_BIO}`);
  assert.equal(pulisciTesto("backroomsstudio.it · @backrooms.studios"), LINK_BIO);
  assert.equal(pulisciTesto("Registrazione, mix e master · backroomsstudio.it"), `Registrazione, mix e master · ${LINK_BIO}`);
  assert.equal(pulisciTesto("per prenotare la tua sessione · @backrooms.studios"), "per prenotare la tua sessione");
  assert.equal(pulisciTesto("https://www.instagram.com/lince.music/"), LINK_BIO);
  assert.equal(pulisciTesto("Cooking Beats"), "Cooking Beats", "un testo normale non cambia");
  assert.equal(pulisciTesto("Back Rooms Podcast · Puntata 12"), "Back Rooms Podcast · Puntata 12");
  assert.equal(pulisciTesto(42), 42, "i non-testi passano");
});

const grezzo = () => {
  const s = istantanea(statoIniziale({ topN: 5, premio: "x", giudici: { beat: "a", voce: "b", mix: "c" }, durataCountdownMinuti: 180, nero: {} }), { topN: 5, durataCountdownMinuti: 180 }, 0);
  return structuredClone({ ...s, sicurezza: { attiva: true, calmo: false, nascondiPagamenti: false } });
};

test("applicaSicurezza: tolti Twitch, Kick e gli altri social dalla barra; TikTok e Nero restano senza indirizzi", () => {
  const s = grezzo();
  s.senzaPremio.voci = [
    { id: "nero", attiva: true, icona: "nero", etichetta: "Manda la tua traccia", testo: "nero.fan/backrooms" },
    { id: "social", attiva: true, icona: "instagram+tiktok", etichetta: "Seguici", testo: "@backrooms.studios" },
    { id: "twitch", attiva: true, icona: "twitch", etichetta: "Twitch", testo: "@backrooms_studio" },
    { id: "kick", attiva: true, icona: "kick", etichetta: "Kick", testo: "@backrooms_studio" },
    { id: "wa", attiva: true, icona: "whatsapp", etichetta: "WhatsApp", testo: "+39 333 1234567" },
    { id: "sito", attiva: true, icona: "microfono", etichetta: "Registra da noi", testo: "backroomsstudio.it" },
  ];
  const p = applicaSicurezza(s);
  assert.deepEqual(p.senzaPremio.voci.map((v) => v.id), ["nero", "social", "sito"]);
  const per = Object.fromEntries(p.senzaPremio.voci.map((v) => [v.id, v]));
  assert.equal(per.nero.testo, LINK_BIO);
  assert.equal(per.social.icona, "tiktok", "l'icona Instagram sparisce");
  assert.equal(per.social.testo, "su TikTok", "senza account resta la dicitura");
  assert.equal(per.sito.testo, LINK_BIO);
  assert.equal(s.senzaPremio.voci.length, 6, "l'originale non si tocca");
});

test("applicaSicurezza: link del banner, invito, spot, comparse e Instagram dell'artista", () => {
  const s = grezzo();
  s.invito = "La traccia più votata vince | Manda la tua traccia su nero.fan/backrooms";
  s.senzaPremio.link = "nero.fan/backrooms";
  s.senzaPremio.spot.sotto = "Registrazione, mix e master · backroomsstudio.it";
  s.studio.comparse = [{ id: "a", attiva: true, icona: "dm", sopra: "Vuoi una sessione?", titolo: "Scrivici in DM", sotto: "per prenotare · @backrooms.studios" }];
  s.corrente.instagram = "lince.music";
  s.risultati = [{ id: "r", titolo: "t", artista: "a", instagram: "lince.music" }];
  s.drum.ospite = { etichetta: "Artista ospite", handle: "@lince.music", icona: "instagram" };
  s.podcast.ospiti = [{ nome: "Lince", handle: "@lince.music", icona: "instagram" }];
  const p = applicaSicurezza(s);
  // Solo i valori: il nome del campo «instagram» resta, vuoto.
  const valori = [];
  JSON.stringify(p, (k, v) => (typeof v === "string" && valori.push(v), v));
  const trovato = valori.find((v) => /nero\.fan|backroomsstudio\.it|@backrooms|@lince|lince\.music|instagram/i.test(v));
  assert.equal(trovato, undefined, `resta un riferimento: ${trovato}`);
  assert.equal(p.invito, `La traccia più votata vince | Manda la tua traccia: ${LINK_BIO}`);
  assert.equal(p.corrente.instagram, "");
  assert.equal(p.podcast.ospiti[0].nome, "Lince");
  assert.equal(p.podcast.ospiti[0].handle, "");
});

test("applicaSicurezza: spenta lascia tutto com'è; i pagamenti si nascondono solo se richiesto", () => {
  const s = grezzo();
  s.senzaPremio.link = "nero.fan/backrooms";
  s.corrente.tier = "throne";
  s.sicurezza.attiva = false;
  assert.deepEqual(applicaSicurezza(s), s);
  s.sicurezza.attiva = true;
  assert.equal(applicaSicurezza(s).corrente.tier, "throne", "i pagamenti restano finché non si chiede");
  s.sicurezza.nascondiPagamenti = true;
  assert.equal(applicaSicurezza(s).corrente.tier, "standard");
});

test("applicaSicurezza: stati senza la sezione sicurezza (server vecchio) restano com'erano", () => {
  const s = grezzo();
  delete s.sicurezza;
  assert.deepEqual(applicaSicurezza(s), s);
});

test("stato: sicurezza di partenza (attiva, movimento normale, pagamenti visibili); imposta valida su una copia; fondi ripara", () => {
  const stato = { sicurezza: Z.sicurezzaIniziale() };
  assert.deepEqual(stato.sicurezza, { attiva: true, calmo: false, nascondiPagamenti: false });
  Z.impostaSicurezza(stato, { calmo: true });
  assert.deepEqual(stato.sicurezza, { attiva: true, calmo: true, nascondiPagamenti: false });
  const prima = structuredClone(stato.sicurezza);
  assert.throws(() => Z.impostaSicurezza(stato, { attiva: "no" }), /sicura/i);
  assert.throws(() => Z.impostaSicurezza(stato, { calmo: false, nascondiPagamenti: 5 }));
  assert.deepEqual(stato.sicurezza, prima, "un errore non cambia niente");
  assert.deepEqual(Z.fondiSicurezza(undefined), Z.sicurezzaIniziale());
  assert.deepEqual(Z.fondiSicurezza({ attiva: false, calmo: "boh", extra: 1 }), { attiva: false, calmo: false, nascondiPagamenti: false });
});

test("e2e: comando sicurezza, istantanea e persistenza dello stato", async () => {
  const srv = await avviaServer();
  try {
    assert.deepEqual((await srv.statoCorrente()).sicurezza, { attiva: true, calmo: false, nascondiPagamenti: false });
    assert.equal((await srv.api("sicurezza", { calmo: true, nascondiPagamenti: true })).ok, true);
    assert.deepEqual((await srv.statoCorrente()).sicurezza, { attiva: true, calmo: true, nascondiPagamenti: true });
    assert.equal((await srv.api("sicurezza", { attiva: 1 })).ok, false);
    await srv.api("nuovaSerata");
    assert.equal((await srv.statoCorrente()).sicurezza.calmo, true, "nuova serata non cambia la scelta");
  } finally {
    await srv.ferma();
  }
});
