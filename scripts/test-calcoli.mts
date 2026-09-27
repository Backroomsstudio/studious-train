// Test dei calcoli (senza rete): npm run sistema:test
import assert from "node:assert/strict";
import { configDa } from "../netlify/functions/_lib/config.mts";
import { leggiData, nomeRegistro, oggi } from "../netlify/functions/_lib/date.mts";
import { normTel, proporziona, simile, testo } from "../netlify/functions/_lib/match.mts";
import { righeDaProdotto, type Prodotto } from "../netlify/functions/_lib/registro.mts";
import { cerca, contattiDa, servizioVendite } from "../netlify/functions/_lib/crm.mts";

const cfg = configDa([]);
const pacchetto = (etichetta: string, pezzi: number, euro: number): Prodotto =>
  ({ linea: "pacchetto", etichetta, pezzi, servizio: null, quantita: 0, importo: euro * 100 });
const importi = (p: Prodotto) => righeDaProdotto(p, cfg).map((r) => r.importo / 100);

assert.deepEqual(importi(pacchetto("ZINCO", 1, 180)), [56, 60, 64]);
assert.deepEqual(importi(pacchetto("SMERALDO", 2, 280)), [87.11, 93.33, 99.56]);
assert.deepEqual(importi(pacchetto("ZAFFIRO", 3, 370)), [115.11, 123.33, 131.56]);

const zaffiro = righeDaProdotto(pacchetto("ZAFFIRO", 3, 370), cfg);
assert.equal(zaffiro[0].servizio, "Sessione Registrazione 1h");
assert.equal(zaffiro[1].servizio, "Sessione Beat in Presenza (1h30)");
assert.equal(zaffiro[2].servizio, "Mix Master");
assert.equal(zaffiro[0].descrizione, "ZAFFIRO 3 pezzi — quota sessioni (3)");

// Proposta Diego: ZAFFIRO + Blocco 10 sessioni = 965,00 € su 4 righe.
const blocco: Prodotto = { linea: "blocco", etichetta: "Blocco 10 sessioni", pezzi: 0, servizio: "sessione", quantita: 10, importo: 59500 };
const diego = [...righeDaProdotto(pacchetto("ZAFFIRO", 3, 370), cfg), ...righeDaProdotto(blocco, cfg)];
assert.equal(diego.length, 4);
assert.equal(diego.reduce((a, r) => a + r.importo, 0), 96500);

// Rimborso proporzionale: la somma torna esatta.
assert.deepEqual(proporziona([5600, 6000, 6400], 18000), [5600, 6000, 6400]);
assert.equal(proporziona([11511, 12333, 13156, 59500], 10000).reduce((a, b) => a + b, 0), 10000);

assert.equal(normTel("+39 333 123 4567"), "393331234567");
assert.equal(normTel("333 1234567"), "393331234567");
assert.equal(normTel("0039 3331234567"), "393331234567");
assert.equal(simile("CRONO - Sessione Rec", "crono"), true);
assert.equal(simile("ad", "adamo"), false);
assert.equal(testo("=HYPERLINK(1)"), "'=HYPERLINK(1)");

assert.equal(nomeRegistro(oggi("2026-10-03")), "Registro Ott26");
assert.equal(leggiData(46292)?.toISODate(), "2026-09-27");
assert.equal(leggiData("27/09/2026")?.toISODate(), "2026-09-27");

const contatti = contattiDa([
  ["C0001", "Mario", "3 · In dialogo"],
  ["C0002", "Diego", "7 · Cliente", ...Array(17).fill(""), "Diego Giacintucci", "", "", "+39 333 000 1111", "diego@example.com"],
  ["C0003", "Luca B"],
  ["C0004", "luca b"],
]);
assert.equal(cerca(contatti, { crmId: "c0002", nome: "x" }).trovato?.id, "C0002");
assert.equal(cerca(contatti, { telefono: "3330001111", nome: "x" }).trovato?.id, "C0002");
assert.equal(cerca(contatti, { email: "DIEGO@example.com", nome: "x" }).trovato?.id, "C0002");
assert.equal(cerca(contatti, { nome: "diego giacintucci" }).trovato?.id, "C0002");
assert.deepEqual(cerca(contatti, { nome: "Luca B" }).doppioni, ["C0003", "C0004"]);

const lista = ["Pacchetto Zinco", "Pacchetto Zaffiro", "Blocco sessioni", "Altro"];
assert.equal(servizioVendite({ linea: "pacchetto", etichetta: "ZAFFIRO", servizio: null }, lista), "Pacchetto Zaffiro");
assert.equal(servizioVendite({ linea: "blocco", etichetta: "Blocco 10 sessioni", servizio: "sessione" }, lista), "Blocco sessioni");
assert.equal(servizioVendite({ linea: "blocco", etichetta: "Blocco 3 beat", servizio: "beat" }, lista), "Altro");

console.log("Tutti i test dei calcoli sono passati ✔");
