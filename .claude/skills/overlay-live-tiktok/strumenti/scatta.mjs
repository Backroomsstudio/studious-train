// Screenshot di una pagina (overlay o regia), con comandi opzionali alla regia dopo il caricamento.
// node scatta.mjs <url> <out.png> [larghezza=1080] [altezza=1920] [attesaMs=2500] [comando ...]
//   comando: "demo", "conferma", 'voto={"categoria":"beat","valore":9}' (POST /api/<nome> sullo stesso host)
// Per mockup statici: url con ?anteprima=1&statico=1 (sfondo scuro, niente animazioni né suoni).
// Per lo sfondo trasparente (da sovrapporre a uno screenshot): senza ?anteprima.
import { apriBrowser, comando } from "./_browser.mjs";

const [url, out, w = 1080, h = 1920, attesa = 2500, ...comandi] = process.argv.slice(2);
if (!url || !out) {
  console.error("Uso: node scatta.mjs <url> <out.png> [larghezza] [altezza] [attesaMs] [comando ...]");
  process.exit(1);
}
const browser = await apriBrowser();
const pagina = await browser.newPage({ viewport: { width: +w, height: +h } });
pagina.on("pageerror", (e) => console.log("ERRORE nella pagina:", e.message));
await pagina.goto(url);
await pagina.waitForTimeout(1500);
const base = new URL(url).origin;
for (const c of comandi) {
  console.log(await comando(base, c));
  await pagina.waitForTimeout(150);
}
await pagina.waitForTimeout(+attesa);
// La regia è più alta della finestra: pagina intera. L'overlay resta 1080×1920 (trasparente senza ?anteprima).
await pagina.screenshot({ path: out, fullPage: new URL(url).pathname.startsWith("/regia"), omitBackground: true });
await browser.close();
console.log("salvato", out);
