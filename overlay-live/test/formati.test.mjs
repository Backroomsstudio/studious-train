import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../lib/stato.mjs";

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
