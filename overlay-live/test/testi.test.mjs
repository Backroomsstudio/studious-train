import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMATI_TESTI, TESTO_MIN, TESTO_MAX, testiBase, controllaTesti, impostaTesti } from "../lib/testi.mjs";

test("testi: ogni formato ha i suoi gruppi, tutti al 100%", () => {
  assert.deepEqual(Object.keys(FORMATI_TESTI), ["drum", "produzione", "reaction", "podcast"]);
  assert.deepEqual(Object.keys(FORMATI_TESTI.drum), ["contatore", "traguardi", "brano", "priorita", "sblocco"]);
  assert.deepEqual(Object.keys(FORMATI_TESTI.produzione), ["sopra", "titolo", "sotto"]);
  assert.deepEqual(Object.keys(FORMATI_TESTI.reaction), ["sopra", "titolo", "sotto"]);
  assert.deepEqual(Object.keys(FORMATI_TESTI.podcast), ["targa", "tematiche"]);
  assert.deepEqual(testiBase("podcast"), { targa: 100, tematiche: 100 });
  assert.deepEqual([TESTO_MIN, TESTO_MAX], [60, 200]);
});

test("testi: i valori si controllano", () => {
  assert.deepEqual(controllaTesti("drum", { contatore: 140, brano: "120" }), { contatore: 140, traguardi: 100, brano: 120, priorita: 100, sblocco: 100 });
  assert.throws(() => controllaTesti("drum", { contatore: 59 }), /60/);
  assert.throws(() => controllaTesti("drum", { contatore: 201 }), /200/);
  assert.throws(() => controllaTesti("drum", { inventato: 100 }), /sconosciuto/i);
  assert.throws(() => controllaTesti("boh", {}), /formato/i);
  assert.throws(() => controllaTesti(["drum"], {}), /Formato sconosciuto/, "il formato dev'essere un testo, non un elenco");
  assert.throws(() => controllaTesti("toString", {}), /Formato sconosciuto/);
  assert.throws(() => controllaTesti("drum", null), /forma/i);
});

test("testi: impostaTesti cambia solo quelli dati", () => {
  const stato = { drum: { testi: testiBase("drum") } };
  impostaTesti(stato, "drum", { traguardi: 150 });
  assert.equal(stato.drum.testi.traguardi, 150);
  assert.equal(stato.drum.testi.contatore, 100);
  assert.throws(() => impostaTesti(stato, "drum", { sblocco: 120, brano: 5 }));
  assert.equal(stato.drum.testi.sblocco, 100, "un errore non lascia metà modifica");
  impostaTesti(stato, "drum", { azzera: true });
  assert.deepEqual(stato.drum.testi, testiBase("drum"));
  assert.throws(() => impostaTesti(stato, "reaction", { titolo: 100 }), /senza testi/i);
  assert.throws(() => impostaTesti(stato, "boh", {}), /Formato sconosciuto/, "formato inesistente: prima si controlla il nome");
});
