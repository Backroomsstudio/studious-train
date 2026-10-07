// Parti pure delle pagine dei quattro layout nuovi (voci della fascia social, simboli, dimensione dei testi).
import { test } from "node:test";
import assert from "node:assert/strict";
import { vociFascia, velocitaFascia, ETICHETTE_TESTI, scalaTesto, NOMI_ICONE, NOMI_ICONE_REGALO, STILE_PRESET, stileTitolo, TITOLO_REACTION_PREDEFINITO } from "../public/js/formati-logica.js";
import { ID_SIMBOLI, svgSimboli } from "../public/js/simboli.js";
import { senzaPremioIniziale } from "../lib/stato.mjs";
import { ICONE } from "../lib/validazione.mjs";
import { ICONE_REGALO } from "../lib/drum.mjs";
import { FORMATI_TESTI } from "../lib/testi.mjs";
import { PRESET_TITOLI, reactionIniziale } from "../lib/formati.mjs";

const stato = ({ social = senzaPremioIniziale(), ospite = { etichetta: "Artista ospite", handle: "@lince.music", icona: "tiktok" }, ospiti = [] } = {}) => ({
  senzaPremio: social,
  drum: { ospite },
  podcast: { ospiti },
});
const sintesi = (v) => ({ tipo: v.tipo, etichetta: v.etichetta, testo: v.testo, icone: v.icone, oro: v.oro });

test("vociFascia: il Drum mette l'artista ospite dopo il primo social", () => {
  const voci = vociFascia(stato(), "drum");
  assert.equal(voci.length, 6);
  assert.deepEqual(sintesi(voci[1]), { tipo: "social", etichetta: "Artista ospite", testo: "@lince.music", icone: ["tiktok"], oro: false });
  assert.deepEqual(voci.filter((_, i) => i !== 1).map((v) => v.testo), senzaPremioIniziale().voci.map((v) => v.testo), "gli altri sono i social, nel loro ordine");
  assert.equal(vociFascia(stato({ ospite: { etichetta: "Artista ospite", handle: "", icona: "tiktok" } }), "drum").length, 5, "senza contatto non c'è lo slot");
  const doppia = vociFascia(stato({ ospite: { etichetta: "Chi suona", handle: "@x", icona: "instagram+tiktok" } }), "drum")[1];
  assert.deepEqual([doppia.icone, doppia.etichetta], [["instagram", "tiktok"], "Chi suona"]);
  const prima = vociFascia(stato(), "drum")[1].chiave;
  assert.notEqual(vociFascia(stato({ ospite: { etichetta: "Artista ospite", handle: "@altro", icona: "tiktok" } }), "drum")[1].chiave, prima, "se cambia il contatto cambia la chiave");
  assert.notEqual(vociFascia(stato({ ospite: { etichetta: "Artista ospite", handle: "@lince.music", icona: "instagram" } }), "drum")[1].chiave, prima, "e se cambia l'icona");
  assert.notEqual(vociFascia(stato({ ospite: { etichetta: "Chi suona", handle: "@lince.music", icona: "tiktok" } }), "drum")[1].chiave, prima, "e se cambia l'etichetta");
});

test("vociFascia: il Podcast ha una voce per ospite, produzione e reaction solo i social", () => {
  const ospiti = [{ nome: "Lince", handle: "@lince.music", icona: "instagram" }, { nome: "Nove", handle: "", icona: "tiktok" }];
  const voci = vociFascia(stato({ ospiti }), "podcast");
  assert.equal(voci.length, 7);
  assert.deepEqual(sintesi(voci[1]), { tipo: "social", etichetta: "Ospite", testo: "Lince · @lince.music", icone: ["instagram"], oro: false });
  assert.deepEqual(sintesi(voci[2]), { tipo: "social", etichetta: "Ospite", testo: "Nove", icone: ["tiktok"], oro: false });
  assert.notEqual(voci[1].chiave, voci[2].chiave);
  assert.equal(vociFascia(stato({ ospiti: [] }), "podcast").length, 5);
  assert.equal(vociFascia(stato({ ospiti }), "produzione").length, 5);
  assert.equal(vociFascia(stato({ ospiti }), "reaction").length, 5);
  assert.deepEqual(vociFascia(stato(), "produzione").map((v) => v.testo), senzaPremioIniziale().voci.map((v) => v.testo));
  const cambiata = vociFascia(stato({ ospiti: [{ ...ospiti[0], handle: "@nuovo" }, ospiti[1]] }), "podcast");
  assert.notEqual(cambiata[1].chiave, voci[1].chiave, "se cambia il contatto cambia la chiave");
  assert.equal(cambiata[2].chiave, voci[2].chiave, "quella degli altri ospiti no");
});

test("vociFascia: con i social spenti restano solo gli ospiti", () => {
  const spenti = senzaPremioIniziale();
  for (const v of spenti.voci) v.attiva = false;
  assert.deepEqual(vociFascia(stato({ social: spenti }), "drum").map((v) => v.testo), ["@lince.music"]);
  assert.deepEqual(vociFascia(stato({ social: spenti, ospiti: [{ nome: "Lince", handle: "", icona: "instagram" }] }), "podcast").map((v) => v.testo), ["Lince"]);
  assert.deepEqual(vociFascia(stato({ social: spenti }), "produzione"), []);
});

test("velocitaFascia: quella del layout, 80 se manca", () => {
  assert.equal(velocitaFascia({ drum: { velocita: 120 } }, "drum"), 120);
  assert.equal(velocitaFascia({ podcast: { velocita: 45 } }, "podcast"), 45);
  assert.equal(velocitaFascia({}, "drum"), 80);
  assert.equal(velocitaFascia({ drum: {} }, "drum"), 80);
});

test("simboli: ogni icona usata dalle pagine e dalla regia c'è", () => {
  for (const icona of ICONE.filter((i) => !["instagram+tiktok", "logo"].includes(i))) assert.ok(ID_SIMBOLI.includes(`ic-${icona}`), `ic-${icona}`);
  for (const icona of ICONE_REGALO.filter((i) => i !== "logo")) assert.ok(ID_SIMBOLI.includes(`ic-${icona}`), `ic-${icona}`);
  for (const id of ["ic-lucchetto", "ic-spunta", "ic-play", "ic-cappello", "ic-manopole", "ic-cuore", "ic-cuffie", "punta", "g-cromo", "g-oro"]) assert.ok(ID_SIMBOLI.includes(id), id);
  assert.equal(new Set(ID_SIMBOLI).size, ID_SIMBOLI.length, "nessun id doppio");
  const svg = svgSimboli();
  for (const id of ID_SIMBOLI) assert.ok(svg.includes(`id="${id}"`), id);
  assert.match(svg, /^<svg[^>]*aria-hidden="true"/);
  assert.equal((svg.match(/<symbol /g) ?? []).length + (svg.match(/<linearGradient /g) ?? []).length, ID_SIMBOLI.length, "ogni id ha il suo disegno");
});

test("ETICHETTE_TESTI: le stesse di FORMATI_TESTI", () => {
  assert.deepEqual(ETICHETTE_TESTI, FORMATI_TESTI);
});

test("scalaTesto: percentuale diventa moltiplicatore", () => {
  assert.equal(scalaTesto({ timer: 125 }, "timer"), 1.25);
  assert.equal(scalaTesto({}, "timer"), 1);
  assert.equal(scalaTesto(undefined, "timer"), 1);
  assert.equal(scalaTesto({ contatore: 60 }, "contatore"), 0.6);
});

test("NOMI_ICONE e NOMI_ICONE_REGALO: un nome per ogni icona che il server accetta, nello stesso ordine", () => {
  assert.deepEqual(Object.keys(NOMI_ICONE), ICONE);
  assert.deepEqual(Object.keys(NOMI_ICONE_REGALO), ICONE_REGALO);
  for (const nome of [...Object.values(NOMI_ICONE), ...Object.values(NOMI_ICONE_REGALO)]) assert.ok(typeof nome === "string" && nome.trim().length > 0, `nome vuoto: «${nome}»`);
});

test("STILE_PRESET e stileTitolo: accento e icona della targa", () => {
  assert.deepEqual(Object.keys(STILE_PRESET), Object.keys(PRESET_TITOLI));
  for (const [nome, stile] of Object.entries(STILE_PRESET)) {
    assert.equal(stile.accento, PRESET_TITOLI[nome].accento, `accento di ${nome}`);
    assert.equal(stile.icona, PRESET_TITOLI[nome].icona, `icona di ${nome}`);
    assert.ok(ID_SIMBOLI.includes(`ic-${stile.icona}`), `ic-${stile.icona} c'è`);
  }
  assert.deepEqual(stileTitolo("produzione", { preset: "mix" }), { accento: "ciano", icona: "manopole" });
  assert.deepEqual(stileTitolo("produzione", { preset: "sessione" }), { accento: "magenta", icona: "cuffie" });
  assert.deepEqual(stileTitolo("produzione", { preset: "boh" }), STILE_PRESET.cooking, "un preset sconosciuto: quello di partenza");
  assert.deepEqual(stileTitolo("produzione", undefined), STILE_PRESET.cooking);
  assert.deepEqual(stileTitolo("produzione", { preset: "toString" }), STILE_PRESET.cooking, "nomi della catena dei prototipi non sono preset");
  assert.deepEqual(stileTitolo("reaction", { preset: "mix" }), { accento: "magenta", icona: null }, "la reaction è sempre magenta, senza icona");
});

test("TITOLO_REACTION_PREDEFINITO: lo stesso titolo con cui parte la reaction", () => {
  assert.deepEqual(TITOLO_REACTION_PREDEFINITO, reactionIniziale().titolo);
  assert.equal(TITOLO_REACTION_PREDEFINITO.testo, "REACTION RELEASE DELLA SETTIMANA");
});
