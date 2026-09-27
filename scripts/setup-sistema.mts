// Crea nel foglio Backrooms_Sistema i tab con le intestazioni e le chiavi di Config mancanti.
// Uso: npm run sistema:setup  (legge .env). Si può rilanciare: non cancella niente.
import { CONFIG_DEFAULT } from "../netlify/functions/_lib/config.mts";
import { accoda, leggi, modificaStruttura, nomiFogli, scrivi } from "../netlify/functions/_lib/sheets.mts";
import { TABS, sistema } from "../netlify/functions/_lib/sistema.mts";

const id = sistema();
const presenti = await nomiFogli(id);
const nuovi = Object.keys(TABS).filter((t) => !presenti.includes(t));
if (nuovi.length) await modificaStruttura(id, nuovi.map((title) => ({ addSheet: { properties: { title } } })));
await scrivi(id, Object.entries(TABS).map(([t, h]) => ({ range: `${t}!A1`, values: [h] })));

const [chiavi] = await leggi(id, ["Config!A2:A"]);
const esistenti = new Set(chiavi.map((r) => String(r[0])));
const mancanti = CONFIG_DEFAULT.filter(([k]) => !esistenti.has(k));
await accoda(id, "Config!A:C", mancanti);

console.log(`Tab creati: ${nuovi.join(", ") || "nessuno (c'erano già)"}`);
console.log(`Chiavi di Config aggiunte: ${mancanti.length}`);
