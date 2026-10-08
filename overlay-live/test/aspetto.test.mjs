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

// ---------- Palette ----------
// Gli overlay sono in scala di grigi. Hanno una tinta solo tre famiglie che servono a capire cosa succede: oro/bronzo (podio,
// premio, vincitore, Super Skip), rosso (ultimi minuti, pallino LIVE) e verde smeraldo (Skip, sblocco del Drum).

function inHsl(r, g, b) {
  const [R, G, B] = [r, g, b].map((x) => x / 255);
  const massimo = Math.max(R, G, B);
  const minimo = Math.min(R, G, B);
  const l = (massimo + minimo) / 2;
  const d = massimo - minimo;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = massimo === R ? ((G - B) / d) % 6 : massimo === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

// Neutro: differenza tra canale massimo e minimo ≤ 10 su 255. Con una tinta: rosso e oro/bronzo (345°…60°) o smeraldo
// (135°…170°), e solo se il colore è davvero saturo (≥ 0,2): un grigio appena colorato non è una famiglia, è una dominante.
export function coloreAmmesso(r, g, b) {
  if (Math.max(r, g, b) - Math.min(r, g, b) <= 10) return true;
  const { h, s } = inHsl(r, g, b);
  return s >= 0.2 && (h >= 345 || h <= 60 || (h >= 135 && h <= 170));
}

function hslInRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min((n + h / 30) % 12 - 3, 9 - ((n + h / 30) % 12), 1));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255));
}

// Tutti i colori scritti in una riga: esadecimali, rgb(), rgba(), hsl(), hsla() e, negli script, una terna «R, G, B» tra virgolette.
function coloriInRiga(riga, file) {
  const trovati = [];
  for (const m of riga.matchAll(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g)) {
    const esa = m[1].length <= 4 ? [...m[1]].map((c) => c + c).join("") : m[1];
    trovati.push({ testo: m[0], rgb: [0, 2, 4].map((i) => parseInt(esa.slice(i, i + 2), 16)) });
  }
  for (const m of riga.matchAll(/rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/gi)) trovati.push({ testo: m[0], rgb: [m[1], m[2], m[3]].map(Number) });
  for (const m of riga.matchAll(/hsla?\(\s*([\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%/gi)) {
    trovati.push({ testo: m[0], rgb: hslInRgb(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100) });
  }
  if (file.endsWith(".js")) {
    for (const m of riga.matchAll(/["'`](\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})["'`]/g)) trovati.push({ testo: m[0], rgb: [m[1], m[2], m[3]].map(Number) });
  }
  return trovati;
}

test("coloreAmmesso: rifiuta viola, magenta, ciano e neri tinti; accetta grigi, oro, rosso e smeraldo", () => {
  for (const [r, g, b] of [[160, 102, 255], [255, 79, 216], [54, 220, 255], [21, 12, 40], [163, 169, 177], [10, 7, 20]]) {
    assert.equal(coloreAmmesso(r, g, b), false, `rgb(${r},${g},${b}) non deve passare`);
  }
  for (const [r, g, b] of [[92, 58, 0], [255, 216, 99], [255, 48, 70], [20, 163, 111], [255, 255, 255], [11, 11, 12], [0, 0, 0], [232, 236, 242]]) {
    assert.equal(coloreAmmesso(r, g, b), true, `rgb(${r},${g},${b}) deve passare`);
  }
});

test("coloriInRiga legge esadecimali, rgb, rgba, hsl e terne degli script", () => {
  assert.deepEqual(coloriInRiga("a { color: #fff; b: #a066ff; c: rgba(255, 79, 216, 0.5); d: hsl(0 0% 50%); }", "x.css").map((c) => c.rgb), [[255, 255, 255], [160, 102, 255], [255, 79, 216], [128, 128, 128]]);
  assert.deepEqual(coloriInRiga('const C = ["205, 178, 255"];', "x.js").map((c) => c.rgb), [[205, 178, 255]]);
  assert.deepEqual(coloriInRiga('const C = ["205, 178, 255"];', "x.css"), []);
});

test("ogni colore scritto negli overlay è neutro, oro/bronzo, rosso o smeraldo", () => {
  const problemi = [];
  for (const { file, testo } of fileOverlay()) {
    senzaCommenti(file, testo)
      .split("\n")
      .forEach((riga, i) => {
        for (const { testo: colore, rgb } of coloriInRiga(riga, file)) if (!coloreAmmesso(...rgb)) problemi.push(`${file}:${i + 1} ${colore}`);
      });
  }
  assert.equal(problemi.length, 0, `${problemi.length} colori con una tinta non ammessa, per esempio:\n${problemi.slice(0, 40).join("\n")}`);
});

// ---------- Testi ----------

test("il badge delle barre del Battle dice «Voto Chat»", () => {
  const battle = readFileSync(join(PUBLIC, "battle.html"), "utf8");
  assert.ok(battle.includes("<span>Voto</span><span>Chat</span>"), "il badge deve dire Voto / Chat");
  assert.ok(!/votes/i.test(battle), "battle.html non deve più dire «Votes»");
  const readme = readFileSync(join(PUBLIC, "..", "README.md"), "utf8");
  assert.ok(!/chat votes/i.test(readme), "il README non deve più dire «CHAT VOTES»");
  assert.ok(readme.includes("«VOTO CHAT»"), "il README descrive il badge come «VOTO CHAT»");
});
