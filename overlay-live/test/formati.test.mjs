import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../lib/stato.mjs";
import * as F from "../lib/formati.mjs";
import { testiBase } from "../lib/testi.mjs";

const config = { giudici: { beat: "A", voce: "B", mix: "C" }, pesi: { beat: 1, voce: 1, mix: 1, chat: 1 }, topN: 3, premio: "Mix" };

test("layout: otto, i quattro nuovi si scelgono", () => {
  const stato = S.statoIniziale(config);
  assert.deepEqual(S.LAYOUT, ["gara", "senzaPremio", "studio", "battle", "drum", "produzione", "podcast", "reaction"]);
  for (const nome of ["drum", "produzione", "podcast", "reaction"]) {
    S.impostaLayout(stato, nome);
    assert.equal(stato.layout, nome);
  }
  assert.throws(() => S.impostaLayout(stato, "boh"), /drum.*produzione.*podcast.*reaction/);
});

test("widget: i tredici nuovi, accesi tranne linea e tematiche", () => {
  const nuovi = ["drumCornice", "drumTraguardi", "drumBrano", "drumPriorita", "drumBarra", "prTitolo", "prBarra", "reTitolo", "reBarra", "poTitolo", "poLinea", "poTematiche", "poBarra"];
  const stato = S.statoIniziale(config);
  for (const w of nuovi) assert.ok(S.WIDGET.includes(w), w);
  for (const w of nuovi.filter((x) => !["poLinea", "poTematiche"].includes(x))) assert.equal(stato.visibili[w], true, w);
  assert.deepEqual([stato.visibili.poLinea, stato.visibili.poTematiche, stato.visibili.bracket], [false, false, false]);
  assert.deepEqual(S.WIDGET_SPENTI, ["bracket", "poLinea", "poTematiche"]);
});

const nuovaProduzione = () => ({ produzione: F.produzioneIniziale() });
const nuovaReaction = () => ({ reaction: F.reactionIniziale() });

test("produzione: partenza e preset", () => {
  const p = F.produzioneIniziale();
  assert.deepEqual(p.titolo, { preset: "cooking", sopra: "Backrooms Studio · Live", testo: "Cooking Beats", sotto: "Un beat da zero, in diretta" });
  assert.equal(p.velocita, 80);
  assert.deepEqual(p.testi, testiBase("produzione"));
  assert.deepEqual(Object.keys(F.PRESET_TITOLI), ["cooking", "sessione", "mix"]);
  assert.deepEqual(F.PRESET_TITOLI.cooking, { sopra: "Backrooms Studio · Live", testo: "Cooking Beats", sotto: "Un beat da zero, in diretta", accento: "oro", icona: "cappello" });
  assert.deepEqual(F.PRESET_TITOLI.sessione, { sopra: "Backrooms Studio · Live", testo: "Sessione Beat", sotto: "In studio con il producer", accento: "magenta", icona: "cuffie" });
  assert.deepEqual(F.PRESET_TITOLI.mix, { sopra: "Backrooms Studio · Live", testo: "Mix & Master", sotto: "Mix e master in diretta", accento: "ciano", icona: "manopole" });
  p.titolo.testo = "x";
  assert.equal(F.produzioneIniziale().titolo.testo, "Cooking Beats", "due partenze non condividono nulla");
  assert.equal(F.PRESET_TITOLI.cooking.testo, "Cooking Beats");

  const s = nuovaProduzione();
  F.impostaProduzione(s, { preset: "mix" });
  assert.deepEqual(s.produzione.titolo, { preset: "mix", sopra: "Backrooms Studio · Live", testo: "Mix & Master", sotto: "Mix e master in diretta" });
  F.impostaProduzione(s, { preset: "sessione", titolo: { testo: "Sessione 12" } });
  assert.deepEqual(s.produzione.titolo, { preset: "sessione", sopra: "Backrooms Studio · Live", testo: "Sessione 12", sotto: "In studio con il producer" });
  F.impostaProduzione(s, { titolo: { testo: "Altro titolo" } });
  assert.deepEqual([s.produzione.titolo.preset, s.produzione.titolo.testo, s.produzione.titolo.sotto], ["sessione", "Altro titolo", "In studio con il producer"], "un titolo scritto a mano non cambia lo stile");
  assert.throws(() => F.impostaProduzione(s, { preset: "boh" }), /Preset sconosciuto: cooking, sessione o mix/);
  assert.throws(() => F.impostaProduzione(s, { preset: ["mix"] }), /Preset sconosciuto/);
  assert.throws(() => F.impostaProduzione(s, { preset: "toString" }), /Preset sconosciuto/);
  assert.equal(s.produzione.titolo.preset, "sessione");
});

test("produzione: limiti e tempo reale", () => {
  const s = nuovaProduzione();
  const prima = structuredClone(s.produzione);
  assert.throws(() => F.impostaProduzione(s, { titolo: { testo: "" } }), /vuoto/);
  assert.throws(() => F.impostaProduzione(s, { titolo: { testo: "x".repeat(29) } }), /28/);
  assert.throws(() => F.impostaProduzione(s, { titolo: { sopra: "x".repeat(33) } }), /32/);
  assert.throws(() => F.impostaProduzione(s, { titolo: { sotto: "x".repeat(49) } }), /48/);
  assert.throws(() => F.impostaProduzione(s, { velocita: 39 }), /40/);
  assert.throws(() => F.impostaProduzione(s, { velocita: 161 }), /160/);
  assert.throws(() => F.impostaProduzione(s, { titolo: { testo: "Nuovo" }, velocita: 5 }));
  assert.throws(() => F.impostaProduzione(s, { preset: "mix", titolo: { sotto: "x".repeat(49) } }));
  assert.throws(() => F.impostaProduzione(s, { titolo: "Cooking" }), /Titolo/);
  assert.throws(() => F.impostaProduzione(s, null), /Produzione/);
  assert.deepEqual(s.produzione, prima, "un errore lascia lo stato com'era");
  F.impostaProduzione(s, { titolo: { testo: "x".repeat(28), sopra: "y".repeat(32), sotto: "z".repeat(48) } });
  assert.deepEqual([s.produzione.titolo.testo.length, s.produzione.titolo.sopra.length, s.produzione.titolo.sotto.length], [28, 32, 48]);
  F.impostaProduzione(s, { titolo: { sotto: "" } });
  assert.equal(s.produzione.titolo.sotto, "", "il sotto si svuota");
  assert.equal(s.produzione.titolo.testo.length, 28, "il resto non cambia");
  F.impostaProduzione(s, { titolo: { testo: "  Con spazi  " } });
  assert.equal(s.produzione.titolo.testo, "Con spazi");
  for (const v of [40, 160, "120"]) F.impostaProduzione(s, { velocita: v });
  assert.equal(s.produzione.velocita, 120);
  assert.deepEqual(s.produzione.testi, testiBase("produzione"), "le dimensioni dei testi non cambiano da qui");
});

test("reaction: partenza e limiti", () => {
  const r = F.reactionIniziale();
  assert.equal(r.titolo.testo, "REACTION RELEASE DELLA SETTIMANA");
  assert.deepEqual(r, { titolo: { sopra: "Ogni giovedì · ore 01:00", testo: "REACTION RELEASE DELLA SETTIMANA", sotto: "" }, velocita: 80, testi: testiBase("reaction") });
  const s = nuovaReaction();
  F.impostaReaction(s, { titolo: { testo: "x".repeat(60) } });
  assert.equal(s.reaction.titolo.testo.length, 60);
  const prima = structuredClone(s.reaction);
  assert.throws(() => F.impostaReaction(s, { titolo: { testo: "x".repeat(61) } }), /60/);
  assert.throws(() => F.impostaReaction(s, { titolo: { sopra: "x".repeat(41) } }), /40/);
  assert.throws(() => F.impostaReaction(s, { titolo: { sotto: "x".repeat(61) } }), /60/);
  assert.throws(() => F.impostaReaction(s, { titolo: { testo: " " } }), /vuoto/);
  assert.throws(() => F.impostaReaction(s, { velocita: 39 }), /40/);
  assert.throws(() => F.impostaReaction(s, { velocita: 161 }), /160/);
  assert.throws(() => F.impostaReaction(s, { titolo: { sopra: "ok" }, velocita: "veloce" }));
  assert.throws(() => F.impostaReaction(s, []), /Reaction/);
  assert.deepEqual(s.reaction, prima, "un errore lascia lo stato com'era");
  F.impostaReaction(s, { titolo: { sopra: "" } });
  assert.equal(s.reaction.titolo.sopra, "", "il sopra si svuota");
  F.impostaReaction(s, { titolo: { sopra: "y".repeat(40), sotto: "z".repeat(60) }, velocita: 100 });
  assert.deepEqual([s.reaction.titolo.sopra.length, s.reaction.titolo.sotto.length, s.reaction.velocita], [40, 60, 100]);
  assert.deepEqual(Object.keys(s.reaction.titolo), ["sopra", "testo", "sotto"], "nessun preset");
});

test("formati: stato salvato rotto", () => {
  assert.deepEqual(F.fondiProduzione(undefined), F.produzioneIniziale());
  assert.deepEqual(F.fondiReaction("x"), F.reactionIniziale());
  for (const v of [null, 5, [], true]) {
    assert.deepEqual(F.fondiProduzione(v), F.produzioneIniziale());
    assert.deepEqual(F.fondiReaction(v), F.reactionIniziale());
  }
  const p = F.fondiProduzione({ titolo: { preset: "mix", testo: 42 }, velocita: 120 });
  assert.deepEqual([p.titolo.preset, p.titolo.testo, p.velocita], ["mix", "Cooking Beats", 120], "il campo rotto torna al predefinito, gli altri restano");
  assert.equal(p.titolo.sotto, "Un beat da zero, in diretta", "dallo stato salvato il preset è solo lo stile: i testi non si riempiono");
  assert.deepEqual(F.fondiReaction({ titolo: { testo: "Titolo X" } }), { ...F.reactionIniziale(), titolo: { ...F.reactionIniziale().titolo, testo: "Titolo X" } });

  for (const rotto of ["boh", ["mix"], 3, null, "toString"]) assert.equal(F.fondiProduzione({ titolo: { preset: rotto } }).titolo.preset, "cooking", JSON.stringify(rotto));
  assert.deepEqual(F.fondiProduzione({ titolo: "x", velocita: "veloce", testi: "no" }), F.produzioneIniziale());
  assert.equal(F.fondiProduzione({ velocita: 5000 }).velocita, 80);
  assert.equal(F.fondiReaction({ velocita: 39 }).velocita, 80);
  assert.deepEqual(F.fondiProduzione({ testi: { titolo: 150 } }).testi, { ...testiBase("produzione"), titolo: 150 });
  assert.deepEqual(F.fondiReaction({ testi: { titolo: 999 } }).testi, testiBase("reaction"));
  assert.deepEqual(F.fondiReaction({ testi: { inventato: 100 } }).testi, testiBase("reaction"));
  assert.deepEqual(F.fondiProduzione({ titolo: { sopra: "x".repeat(33), sotto: "Va bene" } }).titolo, { ...F.produzioneIniziale().titolo, sotto: "Va bene" }, "un campo rotto non scarta gli altri");
  assert.equal(F.fondiReaction({ titolo: { testo: "x".repeat(40) } }).titolo.testo.length, 40, "ogni formato ha i suoi limiti");
  assert.equal(F.fondiProduzione({ titolo: { testo: "x".repeat(40) } }).titolo.testo, "Cooking Beats");
  assert.deepEqual(F.fondiReaction({ pippo: 1, titolo: { pippo: 2 } }), F.reactionIniziale(), "i campi sconosciuti non entrano");

  const mia = nuovaProduzione();
  F.impostaProduzione(mia, { preset: "sessione", titolo: { testo: "Sessione 3" }, velocita: 100 });
  mia.produzione.testi.titolo = 150;
  assert.deepEqual(F.fondiProduzione(JSON.parse(JSON.stringify(mia.produzione))), mia.produzione, "andata e ritorno dal file JSON");
  const sua = nuovaReaction();
  F.impostaReaction(sua, { titolo: { sopra: "", sotto: "Con i giudici" }, velocita: 60 });
  sua.reaction.testi.sotto = 80;
  assert.deepEqual(F.fondiReaction(structuredClone(sua.reaction)), sua.reaction);
});
