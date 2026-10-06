// Quanto spazio serve a un testo dentro un elemento dell'overlay (per capire se una frase entra o viene tagliata).
// node misura-testo.mjs <url> <selettore> "frase 1" "frase 2" ...
import { apriBrowser } from "./_browser.mjs";

const [url, selettore, ...frasi] = process.argv.slice(2);
const browser = await apriBrowser();
const pagina = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await pagina.goto(url);
await pagina.waitForTimeout(2000);
const righe = await pagina.evaluate(
  ({ selettore, frasi }) => {
    const el = document.querySelector(selettore);
    if (!el) return [`nessun elemento ${selettore}`];
    return frasi.map((f) => {
      el.textContent = f;
      const stile = getComputedStyle(el);
      return `${f} → serve ${el.scrollWidth}px, disponibili ${el.clientWidth}px (corpo ${stile.fontSize})${el.scrollWidth > el.clientWidth ? "  ⚠ TAGLIATO" : ""}`;
    });
  },
  { selettore, frasi },
);
console.log(righe.join("\n"));
await browser.close();
