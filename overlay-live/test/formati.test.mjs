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
  // spenti anche il tabellone ad albero della gara (si accende dalla regia)
  assert.deepEqual([stato.visibili.albero, S.WIDGET_SPENTI], [false, ["bracket", "albero", "poLinea", "poTematiche"]]);
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

const nuovoPodcast = () => ({ podcast: F.podcastIniziale() });
const ospite = (n) => ({ nome: `Ospite ${n}`, handle: `@ospite${n}`, icona: "tiktok" });
const voci = (n) => Array.from({ length: n }, (_, i) => `Tema ${i + 1}`);

test("podcast: partenza", () => {
  const p = F.podcastIniziale();
  assert.deepEqual(p, {
    titolo: { testo: "Back Rooms Podcast", sotto: "" },
    ospiti: [],
    tematiche: { titolo: "Tematiche di oggi", elenco: [], attiva: 0, lato: "sx" },
    velocita: 80,
    testi: testiBase("podcast"),
  });
  p.tematiche.elenco.push("x");
  p.ospiti.push("x");
  assert.deepEqual([F.podcastIniziale().tematiche.elenco, F.podcastIniziale().ospiti], [[], []], "due partenze non condividono nulla");
});

test("podcast: ospiti e titolo", () => {
  const s = nuovoPodcast();
  F.impostaPodcast(s, { ospiti: [1, 2, 3, 4].map(ospite) });
  assert.equal(s.podcast.ospiti.length, 4);
  assert.deepEqual(s.podcast.ospiti[0], { nome: "Ospite 1", handle: "@ospite1", icona: "tiktok" });
  const prima = structuredClone(s.podcast);
  assert.throws(() => F.impostaPodcast(s, { ospiti: [1, 2, 3, 4, 5].map(ospite) }), /4/);
  assert.throws(() => F.impostaPodcast(s, { ospiti: [{ handle: "@x" }] }), /nome/i);
  assert.throws(() => F.impostaPodcast(s, { ospiti: [{ nome: "x".repeat(25) }] }), /24/);
  assert.throws(() => F.impostaPodcast(s, { ospiti: [{ nome: "A", handle: "x".repeat(41) }] }), /40/);
  assert.throws(() => F.impostaPodcast(s, { ospiti: [{ nome: "A", icona: "boh" }] }), /icona/i);
  assert.throws(() => F.impostaPodcast(s, { ospiti: "rotto" }), /Ospiti/);
  assert.throws(() => F.impostaPodcast(s, { ospiti: [null] }), /Ospite 1/);
  assert.throws(() => F.impostaPodcast(s, { titolo: { testo: "" } }), /vuoto/);
  assert.throws(() => F.impostaPodcast(s, { titolo: { testo: "x".repeat(33) } }), /32/);
  assert.throws(() => F.impostaPodcast(s, { titolo: { sotto: "x".repeat(49) } }), /48/);
  assert.throws(() => F.impostaPodcast(s, { titolo: { testo: "Nuovo" }, velocita: 5 }));
  assert.throws(() => F.impostaPodcast(s, null), /Podcast/);
  assert.deepEqual(s.podcast, prima, "un errore lascia lo stato com'era");
  F.impostaPodcast(s, { ospiti: [{ nome: "  Mario  " }] });
  assert.deepEqual(s.podcast.ospiti, [{ nome: "Mario", handle: "", icona: "instagram" }], "senza icona è instagram");
  F.impostaPodcast(s, { ospiti: [] });
  assert.deepEqual(s.podcast.ospiti, []);
  F.impostaPodcast(s, { titolo: { sotto: "Puntata 12" } });
  assert.deepEqual(s.podcast.titolo, { testo: "Back Rooms Podcast", sotto: "Puntata 12" });
  F.impostaPodcast(s, { titolo: { testo: "x".repeat(32), sopra: "non esiste" } });
  assert.deepEqual(Object.keys(s.podcast.titolo), ["testo", "sotto"], "il titolo ha solo testo e sotto");
  for (const v of [40, 160, "120"]) F.impostaPodcast(s, { velocita: v });
  assert.equal(s.podcast.velocita, 120);
  assert.throws(() => F.impostaPodcast(s, { velocita: 39 }), /40/);
  assert.throws(() => F.impostaPodcast(s, { velocita: 161 }), /160/);
});

test("podcast: tematiche", () => {
  const s = nuovoPodcast();
  F.impostaPodcast(s, { tematiche: { elenco: voci(8) } });
  assert.equal(s.podcast.tematiche.elenco.length, 8);
  const prima = structuredClone(s.podcast);
  assert.throws(() => F.impostaPodcast(s, { tematiche: { elenco: voci(9) } }), /8/);
  assert.throws(() => F.impostaPodcast(s, { tematiche: { elenco: ["ok", ""] } }), /vuoto/);
  assert.throws(() => F.impostaPodcast(s, { tematiche: { elenco: ["x".repeat(49)] } }), /48/);
  assert.throws(() => F.impostaPodcast(s, { tematiche: { elenco: "rotto" } }), /elenco/i);
  assert.throws(() => F.impostaPodcast(s, { tematiche: { elenco: [5] } }), /testo/);
  assert.throws(() => F.impostaPodcast(s, { tematiche: { lato: "alto" } }), /sx o dx/);
  assert.throws(() => F.impostaPodcast(s, { tematiche: { titolo: "" } }), /vuoto/);
  assert.throws(() => F.impostaPodcast(s, { tematiche: { titolo: "x".repeat(33) } }), /32/);
  assert.throws(() => F.impostaPodcast(s, { tematiche: { attiva: 1.5 } }), /intero/);
  assert.throws(() => F.impostaPodcast(s, { tematiche: { attiva: "2" } }), /intero/);
  assert.throws(() => F.impostaPodcast(s, { tematiche: "tutte" }), /Tematiche/);
  assert.throws(() => F.impostaPodcast(s, { tematiche: { lato: "dx", elenco: voci(9) } }));
  assert.deepEqual(s.podcast, prima, "un errore lascia lo stato com'era");
  F.impostaPodcast(s, { tematiche: { elenco: voci(3), attiva: 9 } });
  assert.equal(s.podcast.tematiche.attiva, 2, "l'attiva resta nell'elenco");
  F.impostaPodcast(s, { tematiche: { elenco: voci(5), attiva: 4 } });
  assert.equal(s.podcast.tematiche.attiva, 4);
  F.impostaPodcast(s, { tematiche: { elenco: voci(2) } });
  assert.equal(s.podcast.tematiche.attiva, 1, "accorciando l'elenco l'attiva lo segue");
  F.impostaPodcast(s, { tematiche: { attiva: -3 } });
  assert.equal(s.podcast.tematiche.attiva, 0);
  F.impostaPodcast(s, { tematiche: { elenco: [], attiva: 5 } });
  assert.deepEqual([s.podcast.tematiche.elenco, s.podcast.tematiche.attiva], [[], 0], "con l'elenco vuoto l'attiva è 0");
  F.impostaPodcast(s, { tematiche: { titolo: "  Oggi parliamo di  ", lato: "dx" } });
  assert.deepEqual(s.podcast.tematiche, { titolo: "Oggi parliamo di", elenco: [], attiva: 0, lato: "dx" }, "cambia solo quello che si dà");
  F.impostaPodcast(s, { tematiche: { elenco: ["  Uno  ", "x".repeat(48)] } });
  assert.equal(s.podcast.tematiche.elenco[0], "Uno");
  assert.equal(s.podcast.tematiche.elenco[1].length, 48);
});

test("podcast: spostaTematica", () => {
  const s = nuovoPodcast();
  assert.throws(() => F.spostaTematica(s, { avanti: true }), /Non ci sono tematiche/);
  assert.throws(() => F.spostaTematica(s, {}), /Non ci sono tematiche/);
  F.impostaPodcast(s, { tematiche: { elenco: ["A", "B", "C"] } });
  const attiva = () => s.podcast.tematiche.attiva;
  F.spostaTematica(s, { avanti: true });
  assert.equal(attiva(), 1);
  F.spostaTematica(s, { avanti: true });
  assert.equal(attiva(), 2);
  F.spostaTematica(s, { avanti: true });
  assert.equal(attiva(), 2, "in fondo si resta in fondo, senza giri");
  F.spostaTematica(s, { indietro: true });
  assert.equal(attiva(), 1);
  F.spostaTematica(s, { indice: 0 });
  assert.equal(attiva(), 0);
  F.spostaTematica(s, { indietro: true });
  assert.equal(attiva(), 0, "in cima si resta in cima");
  for (const rotto of [3, -1, 1.5, "1", null, 99]) assert.throws(() => F.spostaTematica(s, { indice: rotto }), /inesistente/, String(rotto));
  assert.throws(() => F.spostaTematica(s, {}), /avanti, indietro o indice/);
  assert.throws(() => F.spostaTematica(s, { avanti: false }), /avanti, indietro o indice/);
  assert.throws(() => F.spostaTematica(s, { avanti: true, indietro: true }), /avanti, indietro o indice/);
  assert.throws(() => F.spostaTematica(s, { avanti: true, indice: 2 }), /avanti, indietro o indice/);
  assert.throws(() => F.spostaTematica(s, null), /Tematica/);
  assert.equal(attiva(), 0, "gli errori non spostano nulla");
  F.spostaTematica(s, { indice: 2 });
  assert.equal(attiva(), 2);
});

test("podcast: nuova serata e stato salvato rotto", () => {
  const s = nuovoPodcast();
  F.impostaPodcast(s, { titolo: { sotto: "Ep. 5" }, ospiti: [ospite(1)], tematiche: { elenco: ["A", "B", "C"], attiva: 2, lato: "dx" }, velocita: 100 });
  const prima = structuredClone(s.podcast);
  const dopo = F.podcastNuovaSerata(s.podcast);
  assert.deepEqual(s.podcast, prima, "non tocca l'originale");
  assert.equal(dopo.tematiche.attiva, 0);
  assert.deepEqual(dopo.tematiche, { ...prima.tematiche, attiva: 0 });
  assert.deepEqual([dopo.titolo, dopo.ospiti, dopo.velocita, dopo.testi], [prima.titolo, prima.ospiti, prima.velocita, prima.testi]);
  assert.notEqual(dopo.ospiti, s.podcast.ospiti, "nessun pezzo in comune con l'originale");
  assert.notEqual(dopo.tematiche.elenco, s.podcast.tematiche.elenco);

  const f = F.fondiPodcast({ tematiche: { elenco: ["A", "B"], attiva: 7, lato: "dx" }, ospiti: "rotto" });
  assert.deepEqual(f.tematiche, { titolo: "Tematiche di oggi", elenco: ["A", "B"], attiva: 1, lato: "dx" });
  assert.deepEqual(f.ospiti, []);
  assert.deepEqual(F.fondiPodcast(undefined), F.podcastIniziale());
  for (const v of [null, "x", 5, [], true]) assert.deepEqual(F.fondiPodcast(v), F.podcastIniziale());
  const g = F.fondiPodcast({ tematiche: { lato: "alto", elenco: ["A"], titolo: 5, attiva: "x" } });
  assert.deepEqual(g.tematiche, { titolo: "Tematiche di oggi", elenco: ["A"], attiva: 0, lato: "sx" }, "ogni campo rotto torna al suo predefinito");
  assert.deepEqual(F.fondiPodcast({ tematiche: "x" }), F.podcastIniziale());
  assert.deepEqual(F.fondiPodcast({ tematiche: { elenco: ["A", "B"], attiva: -2 } }).tematiche.attiva, 0);
  const h = F.fondiPodcast({ titolo: { testo: 5, sotto: "Ep. 1" }, velocita: 9999, ospiti: [ospite(1), { nome: "" }] });
  assert.deepEqual([h.titolo, h.velocita, h.ospiti], [{ testo: "Back Rooms Podcast", sotto: "Ep. 1" }, 80, []], "gli elenchi si tengono interi o si scartano");
  assert.deepEqual(F.fondiPodcast({ ospiti: [ospite(1), ospite(2)] }).ospiti, [ospite(1), ospite(2)]);
  assert.deepEqual(F.fondiPodcast({ testi: { targa: 150 } }).testi, { targa: 150, tematiche: 100 });
  assert.deepEqual(F.fondiPodcast({ testi: { boh: 1 } }).testi, testiBase("podcast"));
  assert.deepEqual(F.fondiPodcast({ pippo: 1, titolo: { pippo: 2 }, tematiche: { pippo: 3 } }), F.podcastIniziale(), "i campi sconosciuti non entrano");
  s.podcast.testi.targa = 130;
  assert.deepEqual(F.fondiPodcast(JSON.parse(JSON.stringify(s.podcast))), s.podcast, "andata e ritorno dal file JSON");
});
