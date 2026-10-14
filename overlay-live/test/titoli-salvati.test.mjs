// Studio Production: titoli salvati; Podcast: dicitura «Ospite»; limiti più larghi dei titoli.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "../lib/formati.mjs";
import { vociFascia } from "../public/js/formati-logica.js";
import { senzaPremioIniziale } from "../lib/stato.mjs";
import { avviaServer } from "./aiuti-server.mjs";

const nuova = () => ({ produzione: F.produzioneIniziale() });

test("produzione: salvati vuoti di partenza; salva con nome, usa riempie le tre righe e lascia il preset, togli toglie", () => {
  const s = nuova();
  assert.deepEqual(s.produzione.salvati, []);
  F.impostaProduzione(s, { preset: "sessione", titolo: { sopra: "Sopra A", testo: "Titolo A", sotto: "Sotto A" } });
  F.impostaProduzione(s, { salva: { nome: "Puntata A" } });
  assert.equal(s.produzione.salvati.length, 1);
  const a = s.produzione.salvati[0];
  assert.deepEqual([a.nome, a.sopra, a.testo, a.sotto, a.accento, a.icona], ["Puntata A", "Sopra A", "Titolo A", "Sotto A", "magenta", "cuffie"], "con accento e icona del preset in onda");
  assert.equal(typeof a.id, "string");
  F.impostaProduzione(s, { preset: "mix", titolo: { sopra: "x", testo: "y", sotto: "z" } });
  F.impostaProduzione(s, { usa: a.id });
  assert.deepEqual([s.produzione.titolo.sopra, s.produzione.titolo.testo, s.produzione.titolo.sotto, s.produzione.titolo.preset], ["Sopra A", "Titolo A", "Sotto A", "mix"], "usa non cambia il preset");
  F.impostaProduzione(s, { togli: a.id });
  assert.deepEqual(s.produzione.salvati, []);
});

test("produzione: salva con nome vuoto o già usato → errore; il settimo → errore; usa/togli di un id che non c'è → errore; niente cambia", () => {
  const s = nuova();
  assert.throws(() => F.impostaProduzione(s, { salva: { nome: "  " } }), /vuot/);
  assert.throws(() => F.impostaProduzione(s, { salva: { nome: "x".repeat(25) } }), /24/);
  assert.throws(() => F.impostaProduzione(s, { salva: "Nome" }), /nome/i);
  for (let i = 1; i <= 6; i++) F.impostaProduzione(s, { salva: { nome: `Titolo ${i}` } });
  const prima = structuredClone(s.produzione);
  assert.throws(() => F.impostaProduzione(s, { salva: { nome: "Settimo" } }), /6/);
  assert.throws(() => F.impostaProduzione(s, { salva: { nome: "titolo 2" } }), /già/);
  assert.throws(() => F.impostaProduzione(s, { usa: "non-esiste" }), /non trovato|non esiste|c'è/i);
  assert.throws(() => F.impostaProduzione(s, { togli: "non-esiste" }), /non trovato|non esiste|c'è/i);
  assert.throws(() => F.impostaProduzione(s, { velocita: 100, salva: { nome: "Settimo" } }));
  assert.deepEqual(s.produzione, prima, "un errore non cambia niente");
  F.impostaProduzione(s, { togli: s.produzione.salvati[0].id });
  F.impostaProduzione(s, { salva: { nome: "Settimo" } });
  assert.equal(s.produzione.salvati.length, 6);
});

test("limiti dei titoli: produzione 40/36/60, podcast 40 e 60", () => {
  const s = nuova();
  F.impostaProduzione(s, { titolo: { sopra: "x".repeat(40), testo: "y".repeat(36), sotto: "z".repeat(60) } });
  assert.throws(() => F.impostaProduzione(s, { titolo: { sopra: "x".repeat(41) } }), /40/);
  assert.throws(() => F.impostaProduzione(s, { titolo: { testo: "x".repeat(37) } }), /36/);
  assert.throws(() => F.impostaProduzione(s, { titolo: { sotto: "x".repeat(61) } }), /60/);
  const p = { podcast: F.podcastIniziale() };
  F.impostaPodcast(p, { titolo: { testo: "x".repeat(40), sotto: "y".repeat(60) } });
  assert.throws(() => F.impostaPodcast(p, { titolo: { testo: "x".repeat(41) } }), /40/);
  assert.throws(() => F.impostaPodcast(p, { titolo: { sotto: "x".repeat(61) } }), /60/);
});

test("podcast: etichette.ospite modificabile (40 caratteri, non vuota), usata dalla fascia", () => {
  const p = { podcast: F.podcastIniziale() };
  assert.deepEqual(p.podcast.etichette, { ospite: "Ospite" });
  F.impostaPodcast(p, { ospiti: [{ nome: "Lince", handle: "@lince" }], etichette: { ospite: "In studio con noi" } });
  const voci = vociFascia({ senzaPremio: senzaPremioIniziale(), podcast: p.podcast, layout: "podcast", visibili: {} }, "podcast");
  assert.ok(voci.some((v) => v.etichetta === "In studio con noi"), "la fascia usa la dicitura scelta");
  const prima = structuredClone(p.podcast);
  assert.throws(() => F.impostaPodcast(p, { etichette: { ospite: "x".repeat(41) } }), /40/);
  assert.throws(() => F.impostaPodcast(p, { etichette: { ospite: " " } }), /vuot/);
  assert.throws(() => F.impostaPodcast(p, { etichette: { altra: "x" } }), /sconosciut/);
  assert.deepEqual(p.podcast, prima);
});

test("stati vecchi senza salvati o etichette partono completi; quelli rotti tengono i campi buoni", () => {
  assert.deepEqual(F.fondiProduzione({ velocita: 100 }).salvati, []);
  assert.deepEqual(F.fondiPodcast({ velocita: 100 }).etichette, { ospite: "Ospite" });
  assert.deepEqual(F.fondiProduzione({ salvati: "no" }).salvati, []);
  const s = nuova();
  F.impostaProduzione(s, { salva: { nome: "Buono" } });
  const ok = F.fondiProduzione({ salvati: [...s.produzione.salvati, { id: "x" }, 5, { id: s.produzione.salvati[0].id, nome: "Doppio", sopra: "", testo: "T", sotto: "", accento: "oro", icona: null }] });
  assert.deepEqual(ok.salvati.map((x) => x.nome), ["Buono"], "voci rotte o con lo stesso id escono");
  assert.equal(F.fondiPodcast({ etichette: { ospite: "x".repeat(50) } }).etichette.ospite, "Ospite");
  assert.equal(F.fondiPodcast({ etichette: { ospite: "Ospiti" } }).etichette.ospite, "Ospiti");
});

test("e2e: salva un titolo, riavvia il server con lo stato salvato, usa", async () => {
  const srv = await avviaServer();
  let cartella;
  try {
    await srv.api("layout", { nome: "produzione" });
    await srv.api("produzione", { titolo: { sopra: "Sopra", testo: "Il mio titolo", sotto: "Sotto" } });
    assert.equal((await srv.api("produzione", { salva: { nome: "Mio" } })).ok, true);
    const id = (await srv.statoCorrente()).produzione.salvati[0].id;
    await srv.api("produzione", { titolo: { testo: "Altro" } });
    assert.equal((await srv.api("produzione", { usa: id })).ok, true);
    assert.equal((await srv.statoCorrente()).produzione.titolo.testo, "Il mio titolo");
    assert.equal((await srv.api("produzione", { usa: "boh" })).ok, false);
    assert.equal((await srv.api("podcast", { etichette: { ospite: "Con noi" } })).ok, true);
    assert.equal((await srv.statoCorrente()).podcast.etichette.ospite, "Con noi");
  } finally {
    await srv.ferma();
  }
});
