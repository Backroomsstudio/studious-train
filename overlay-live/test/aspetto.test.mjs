// Controlli sull'aspetto degli overlay: font di sistema e, più avanti, palette neutra.
// Leggono i file veri di public/: nessun server, nessun browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// Fogli, pagine e script degli overlay. La regia (regia.css, regia.html, regia*.js) non è un overlay e resta fuori.
export function fileOverlay() {
  const elenco = [];
  for (const [sotto, estensione] of [["css", ".css"], ["", ".html"], ["js", ".js"]]) {
    const cartella = join(PUBLIC, sotto);
    for (const nome of readdirSync(cartella).sort()) {
      if (!nome.endsWith(estensione) || nome.startsWith("regia")) continue;
      elenco.push({ file: `public/${sotto ? `${sotto}/` : ""}${nome}`, testo: readFileSync(join(cartella, nome), "utf8") });
    }
  }
  return elenco;
}

// Toglie i commenti lasciando intatte le righe, così i messaggi citano la riga giusta.
function senzaCommenti(file, testo) {
  const cancella = (m) => m.replace(/[^\n]/g, " ");
  if (file.endsWith(".css")) return testo.replace(/\/\*[\s\S]*?\*\//g, cancella);
  if (file.endsWith(".html")) return testo.replace(/<!--[\s\S]*?-->/g, cancella);
  return testo
    .replace(/\/\*[\s\S]*?\*\//g, cancella)
    .replace(/(^|[^:"'\\])\/\/[^\n]*/gm, (m, prima) => prima + cancella(m.slice(prima.length)));
}

const FAMIGLIE = /\b(Barlow|Grenze|UnifrakturCook|Georgia|Arial|Helvetica|Segoe|Inter|sans-serif|serif|monospace|system-ui)\b/;
const SOLO_VARIABILE = /^var\(--font-[a-z]+\)$/;

test("gli overlay non usano font con nome proprio", () => {
  const problemi = [];
  for (const { file, testo } of fileOverlay()) {
    senzaCommenti(file, testo)
      .split("\n")
      .forEach((riga, i) => {
        const dove = `${file}:${i + 1}`;
        for (const m of riga.matchAll(/(?<![-\w])font-family\s*:\s*([^;}]+)/gi)) {
          if (!SOLO_VARIABILE.test(m[1].trim())) problemi.push(`${dove} font-family: ${m[1].trim()}`);
        }
        for (const m of riga.matchAll(/(?<![-\w])font\s*:\s*([^;}]+)/gi)) {
          if (/["']/.test(m[1]) || FAMIGLIE.test(m[1])) problemi.push(`${dove} font: ${m[1].trim()}`);
        }
        // canvas: ctx.font = "… Nome" (le parti ${…} prese dal foglio di stile, come in pagina.js, vanno bene)
        if (/\.font\s*=/.test(riga) && FAMIGLIE.test(riga.replace(/\$\{[^}]*\}/g, ""))) problemi.push(`${dove} ${riga.trim()}`);
      });
  }
  assert.deepEqual(problemi, [], `font con nome proprio negli overlay:\n${problemi.join("\n")}`);
});

test("le pagine overlay caricano Inter e non Barlow né Grenze", () => {
  const pagine = fileOverlay().filter(({ file }) => file.endsWith(".html"));
  assert.equal(pagine.length, 8, "le pagine overlay sono otto");
  const problemi = [];
  for (const { file, testo } of pagine) {
    const pulito = senzaCommenti(file, testo);
    if (!/fonts\.googleapis\.com\/css2\?[^"']*family=Inter/.test(pulito)) problemi.push(`${file}: non carica Inter`);
    if (/Barlow|Grenze/.test(pulito)) problemi.push(`${file}: carica ancora Barlow o Grenze`);
  }
  assert.deepEqual(problemi, [], problemi.join("\n"));
});

test("base.css definisce lo stack di sistema e le variabili che lo usano", () => {
  const base = readFileSync(join(PUBLIC, "css", "base.css"), "utf8");
  const stack = base.match(/--font-sistema\s*:\s*([^;]+);/)?.[1] ?? "";
  for (const voce of ["-apple-system", '"SF Pro Display"', "Inter"]) assert.ok(stack.includes(voce), `lo stack deve contenere ${voce}: «${stack.trim()}»`);
  assert.match(stack.trim(), /sans-serif$/);
  for (const nome of ["--font-dati", "--font-gotico", "--font-premio"]) {
    assert.match(base, new RegExp(`${nome}\\s*:\\s*var\\(--font-sistema\\)\\s*;`), `${nome} deve valere var(--font-sistema)`);
  }
});

test("il premio e la classifica della gara usano --font-premio", () => {
  const css = readFileSync(join(PUBLIC, "css", "overlay.css"), "utf8");
  for (const selettore of [".premio-testo", ".cl-titolo", ".cl-top", ".cl-num", ".cl-traccia-testo", ".cl-artista", ".cl-punti", ".cl-badge"]) {
    // alcuni selettori hanno anche una regola di sola posizione: basta che una abbia il font
    const blocchi = [...css.matchAll(new RegExp(`(?:^|\\n)${selettore.replaceAll(".", "\\.")}\\s*\\{([^}]*)\\}`, "g"))].map((m) => m[1]);
    assert.ok(blocchi.some((b) => b.includes("var(--font-premio)")), `${selettore} deve usare var(--font-premio)`);
  }
});
