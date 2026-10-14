// Parti pure del widget Goal: testi, posizioni di partenza e comparsa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { testiGoal, partiGoal, chiaveGoal, POSIZIONI_GOAL, posizioneGoal, goalVisibile, daFarComparire, LARGHEZZA_GOAL, ALTEZZA_GOAL } from "../public/js/goal-logica.js";
import { LAYOUT_GOAL, mancano, obiettivoAttuale } from "../lib/goal.mjs";

const goal = (like = {}, follower = {}) => ({
  like: { obiettivo: 15000, passo: 1000, totale: 13750, ...like },
  follower: { obiettivo: 50, passo: 10, totale: 38, ...follower },
  modo: "fisso",
  ogniMinuti: 5,
  durataSecondi: 15,
  posizioni: {},
});

test("testiGoal: numeri con il punto delle migliaia; totale sconosciuto → null", () => {
  assert.deepEqual(testiGoal(goal()), { like: "Mancano 1.250 like al nuovo obiettivo", follower: "Mancano 12 follower al nuovo obiettivo" });
  assert.equal(testiGoal(goal({}, { totale: null })).follower, null);
  assert.equal(testiGoal(goal({ totale: null })).like, null);
  assert.equal(testiGoal(goal({ totale: 1_234_567_890, obiettivo: 2_000_000_000, passo: 0 })).like, "Mancano 765.432.110 like al nuovo obiettivo");
  assert.equal(testiGoal(goal({ totale: 14999 })).like, "Manca 1 like al nuovo obiettivo");
  assert.deepEqual(partiGoal(goal()).like, { prefisso: "Mancano", numero: "1.250", unita: "like", suffisso: "al nuovo obiettivo" });
});

test("testiGoal: gli stessi «mancano» di lib/goal.mjs (passo, obiettivo saltato, passo 0)", () => {
  for (const [totale, obiettivo, passo] of [[0, 15000, 1000], [15000, 15000, 1000], [15999, 15000, 1000], [41234, 15000, 1000], [100, 100, 0], [7, 50, 10], [50, 50, 10]]) {
    const attesi = mancano(totale, obiettivo, passo);
    const t = testiGoal(goal({ totale, obiettivo, passo }));
    const numero = Number(t.like.replace(/\D/g, ""));
    assert.equal(numero, attesi === 0 ? 0 : attesi, `${totale}/${obiettivo}/${passo}`);
    assert.ok(obiettivoAttuale(totale, obiettivo, passo) >= totale);
  }
  assert.equal(testiGoal(goal({ totale: 100, obiettivo: 100, passo: 0 })).like, "Obiettivo raggiunto!");
});

test("passo 0 e obiettivo raggiunto: la riga dice «Obiettivo raggiunto!» (like e follower), non «Mancano 0»", () => {
  const g = goal({ totale: 20000, obiettivo: 15000, passo: 0 }, { totale: 900, obiettivo: 500, passo: 0 });
  assert.deepEqual(testiGoal(g), { like: "Obiettivo raggiunto!", follower: "Obiettivo raggiunto!" });
  const p = partiGoal(g).like;
  assert.equal(p.raggiunto, true);
  assert.equal([p.prefisso, p.numero].join(""), "", "nessun numero da mostrare");
  assert.equal(testiGoal(goal({ totale: 100, obiettivo: 15000, passo: 0 })).like, "Mancano 14.900 like al nuovo obiettivo", "prima di raggiungerlo si conta come sempre");
});

test("chiaveGoal: podcast e reaction hanno la versione orizzontale", () => {
  assert.equal(chiaveGoal("reaction", true), "reactionO");
  assert.equal(chiaveGoal("podcast", true), "podcastO");
  assert.equal(chiaveGoal("podcast", false), "podcast");
  assert.equal(chiaveGoal("drum", true), "drum", "il drum non ha l'orizzontale");
  assert.equal(chiaveGoal("gara", false), "gara");
});

test("posizioneGoal: ogni layout ha una posizione di partenza dentro la tela; quella salvata vince; il widget resta dentro la tela", () => {
  assert.deepEqual(Object.keys(POSIZIONI_GOAL).sort(), [...LAYOUT_GOAL].sort());
  for (const chiave of LAYOUT_GOAL) {
    const orizzontale = chiave.endsWith("O");
    const [W, H] = orizzontale ? [1920, 1080] : [1080, 1920];
    const { x, y, scala } = posizioneGoal(goal(), chiave);
    assert.ok(x >= 0 && y >= 0 && x + LARGHEZZA_GOAL * scala <= W && y + ALTEZZA_GOAL * scala <= H, `${chiave} dentro la tela`);
  }
  assert.deepEqual(posizioneGoal(goal(), "reactionO"), { x: 1584, y: 40, scala: 0.75 });
  assert.deepEqual(posizioneGoal(goal(), "gara"), { x: 564, y: 712, scala: 1 });
  const salvata = { ...goal(), posizioni: { gara: { x: 100, y: 200, scala: 150 } } };
  assert.deepEqual(posizioneGoal(salvata, "gara"), { x: 100, y: 200, scala: 1.5 });
  assert.deepEqual(posizioneGoal({ ...goal(), posizioni: { gara: { x: 300 } } }, "gara"), { x: 300, y: 712, scala: 1 }, "i campi mancanti restano quelli di partenza");
  const bordo = posizioneGoal({ ...goal(), posizioni: { gara: { x: 1900, y: 1900, scala: 200 } } }, "gara");
  assert.ok(bordo.x + LARGHEZZA_GOAL * bordo.scala <= 1080 && bordo.y + ALTEZZA_GOAL * bordo.scala <= 1920);
  assert.deepEqual(posizioneGoal(null, "gara"), { x: 564, y: 712, scala: 1 });
});

test("goalVisibile: fisso → acceso; a comparsa → durataSecondi ogni ogniMinuti e «mostra ora»; spento → mai", () => {
  const fisso = { modo: "fisso", ogniMinuti: 5, durataSecondi: 15 };
  assert.equal(goalVisibile(fisso, true, 1000, null, null), true);
  assert.equal(goalVisibile(fisso, false, 1000, null, null), false);
  const comparsa = { modo: "comparsa", ogniMinuti: 5, durataSecondi: 15 };
  assert.equal(goalVisibile(comparsa, false, 1000, 0, null), false, "spento: mai");
  assert.equal(goalVisibile(comparsa, true, 14_999, 0, null), true);
  assert.equal(goalVisibile(comparsa, true, 15_000, 0, null), false);
  assert.equal(goalVisibile(comparsa, true, 100_000, null, null), false, "mai comparso");
  assert.equal(goalVisibile(comparsa, true, 100_000, 0, 95_000), true, "«mostra ora» dalla regia");
  assert.equal(goalVisibile(comparsa, true, 111_000, 0, 95_000), false);
  assert.equal(daFarComparire(comparsa, 299_999, 0), false);
  assert.equal(daFarComparire(comparsa, 300_000, 0), true);
  assert.equal(daFarComparire(comparsa, 0, null), true, "la prima comparsa è subito");
  assert.equal(daFarComparire(fisso, 999_999, 0), false, "fisso: niente comparse");
});
