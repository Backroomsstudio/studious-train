#!/usr/bin/env node
// Recensioni Google sul sito.
//
// Unica fonte: data/recensioni.json (le recensioni come sono su Google Maps, dalla più recente).
// Questo script genera la sezione #recensioni di public/index.html e aggiorna il contatore
// "5,0 su Google · N recensioni" ovunque compaia nella pagina.
//
//   node scripts/recensioni.mjs                      rigenera index.html dal JSON
//   node scripts/recensioni.mjs --sync lette.json    unisce le recensioni lette da Google, poi rigenera
//   node scripts/recensioni.mjs --check              esce con errore se index.html non è aggiornato
//
// Il file passato a --sync è l'elenco letto da Google Maps (ordinato per "Più recenti"):
//   [{ "id": "...", "n": "Nome", "s": 5, "d": "2 giorni fa", "t": "testo" }, ...]
//
// Senza deploy: la pagina chiede /api/recensioni (netlify/functions/recensioni.mts), che legge
// data/recensioni.json da GitHub. Basta quindi un commit "[skip netlify]" per aggiornare il sito.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyToHtml, mergeReviews, summary } from "../src/recensioni/core.mjs";

export * from "../src/recensioni/core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_FILE = join(ROOT, "data", "recensioni.json");
export const HTML_FILE = join(ROOT, "public", "index.html");

function main(argv) {
  const data = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  const html = readFileSync(HTML_FILE, "utf8");
  if (argv.includes("--check")) {
    if (applyToHtml(html, data) !== html) {
      console.error("index.html non è allineato a data/recensioni.json: esegui `node scripts/recensioni.mjs`.");
      process.exit(1);
    }
    console.log(`Recensioni allineate (${summary(data).count}).`);
    return;
  }
  let next = data;
  const i = argv.indexOf("--sync");
  if (i !== -1) {
    const scraped = JSON.parse(readFileSync(argv[i + 1], "utf8"));
    const d = argv.indexOf("--date");
    const today = d !== -1 ? argv[d + 1] : new Date().toISOString().slice(0, 10);
    const res = mergeReviews(data, scraped, today);
    next = res.data;
    console.log(
      JSON.stringify({ totale: next.recensioni.length, nuove: res.added, modificate: res.updated, tolte: res.removed, cambiato: res.changed }),
    );
    if (res.changed) writeFileSync(DATA_FILE, JSON.stringify(next, null, 2) + "\n");
  }
  const out = applyToHtml(html, next);
  if (out !== html) writeFileSync(HTML_FILE, out);
  console.log(`index.html: ${summary(next).count} recensioni, media ${summary(next).avg}${out !== html ? " (aggiornato)" : " (già aggiornato)"}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
