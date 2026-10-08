// Geometria della gara (verticale 1080×1920): le variabili di overlay.css stanno tra loro come dice la spec (§7.2) e la tabella
// dello strumento dei mockup (strumenti/mockup-layout.mjs) dice gli stessi numeri del CSS. Nessun browser: si leggono i file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GEOMETRIA, CORPI_GARA, sovrapposizioni } from "../strumenti/mockup-layout.mjs";

const PUBBLICA = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const css = readFileSync(join(PUBBLICA, "css", "overlay.css"), "utf8");
const blocco = css.match(/\.verticale\s+\.palco\s*\{([^}]*)\}/)?.[1] ?? "";

function px(nome) {
  const m = blocco.match(new RegExp(`--${nome}\\s*:\\s*(\\d+)px`));
  assert.ok(m, `manca --${nome} nel blocco «.verticale .palco» di overlay.css`);
  return Number(m[1]);
}

test("il blocco voti finisce a y 1196, appena sopra i commenti di TikTok (che partono da 1200)", () => {
  assert.equal(px("y-chat") + px("h-chat"), 1196);
});

test("il tabellone sta sotto la classifica e la barra «Vota in chat» sotto il tabellone, con 12 px liberi", () => {
  assert.ok(px("y-tabellone") >= px("y-colonne") + px("h-classifica") + 12, "tabellone troppo in alto: tocca la classifica");
  assert.ok(px("y-chat") >= px("y-tabellone") + px("h-tabellone") + 12, "barra troppo in alto: tocca il tabellone");
  assert.deepEqual([px("y-tabellone"), px("h-tabellone"), px("y-chat"), px("h-chat")], [858, 260, 1130, 66]);
});

test("premio, classifica e timer non si muovono", () => {
  assert.deepEqual([px("y-premio"), px("h-premio"), px("y-colonne"), px("h-classifica"), px("h-timer")], [282, 156, 454, 392, 132]);
});

test("la tabella dello strumento dei mockup dice gli stessi numeri del CSS", () => {
  const tabella = GEOMETRIA.gara.verticale;
  const attesi = {
    premio: [px("x"), px("y-premio"), px("largo"), px("h-premio")],
    classifica: [px("x"), px("y-colonne"), px("largo-classifica"), px("h-classifica")],
    timer: [px("x-destra"), px("y-colonne"), px("largo-destra"), px("h-timer")],
    notifica: [px("x-destra"), px("y-notifica"), px("largo-destra"), Number(css.match(/\.notifica\s*\{[^}]*min-height:\s*(\d+)px/)?.[1])], // alta almeno così
    tabellone: [px("x"), px("y-tabellone"), px("largo"), px("h-tabellone")],
    chat: [px("x"), px("y-chat"), px("largo"), px("h-chat")],
    albero: [px("x"), px("y-premio"), px("largo"), px("y-chat") + px("h-chat") - px("y-premio")], // dal premio al fondo della barra
  };
  assert.deepEqual(Object.keys(tabella).sort(), Object.keys(attesi).sort());
  for (const [pezzo, rettangolo] of Object.entries(attesi)) assert.deepEqual(tabella[pezzo].r, rettangolo, pezzo);
});

test("sovrapposizioni: i pezzi della gara non si toccano (l'albero li copre di proposito); due pezzi che si coprono vengono segnalati", () => {
  const { albero, ...pezzi } = GEOMETRIA.gara.verticale;
  assert.deepEqual(sovrapposizioni(pezzi), []);
  assert.deepEqual(albero.r, [116, 282, 848, 914], "l'albero sta in x 116–964 e y 282–1196");
  assert.equal(sovrapposizioni({ albero, premio: pezzi.premio }).length, 1, "l'albero copre il premio e lo strumento lo vede"); 
  const pezzo = (x, y, w, h) => ({ r: [x, y, w, h], dentro: true });
  // bordi che si toccano o si sfiorano di 1 px (la tolleranza dello strumento) non contano
  assert.deepEqual(sovrapposizioni({ a: pezzo(0, 0, 100, 100), b: pezzo(100, 0, 100, 100), c: pezzo(0, 99, 100, 50) }), []);
  const trovate = sovrapposizioni({ a: pezzo(0, 0, 100, 100), b: pezzo(50, 50, 100, 100), c: pezzo(300, 300, 10, 10) });
  assert.equal(trovate.length, 1);
  assert.match(trovate[0], /a e b/);
  assert.match(trovate[0], /50/);
});

test("i corpi dei testi che lo strumento controlla sono quelli di CORPI in public/js/overlay.js", () => {
  const letterale = readFileSync(join(PUBBLICA, "js", "overlay.js"), "utf8").match(/const CORPI = (\{[\s\S]*?\n\});/)?.[1];
  assert.ok(letterale, "manca «const CORPI = {…};» in public/js/overlay.js");
  const corpi = new Function(`return ${letterale.replace(/\/\/[^\n]*/g, "")}`)();
  assert.deepEqual(Object.keys(corpi).sort(), Object.keys(CORPI_GARA).sort());
  for (const [chiave, { base, minimo }] of Object.entries(CORPI_GARA)) assert.deepEqual(corpi[chiave], [base, minimo], `${chiave}: [massimo, minimo]`);
});
