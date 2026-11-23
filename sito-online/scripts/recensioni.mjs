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

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_FILE = join(ROOT, "data", "recensioni.json");
export const HTML_FILE = join(ROOT, "public", "index.html");

const START = "<!-- RECENSIONI:INIZIO · generato da scripts/recensioni.mjs da data/recensioni.json: non modificare a mano -->";
const END = "<!-- RECENSIONI:FINE -->";

/** Quante recensioni possono sparire da Google in un solo aggiornamento prima di fermarsi. */
export const MAX_REMOVED = 3;

const DAY = 86400000;

/** "2 ore fa", "un giorno fa", "3 settimane fa", "1 mese fa" → data approssimativa (YYYY-MM-DD). */
export function relativeToDate(rel, today) {
  const base = new Date(`${today}T12:00:00Z`).getTime();
  const s = String(rel || "").toLowerCase().trim();
  const m = s.match(/^(un|una|\d+)\s+(minut|or|giorn|settiman|mes|ann)/);
  if (!m) return today;
  const n = m[1] === "un" || m[1] === "una" ? 1 : parseInt(m[1], 10);
  const days = { minut: 0, or: 0, giorn: 1, settiman: 7, mes: 30, ann: 365 }[m[2]];
  return new Date(base - n * days * DAY).toISOString().slice(0, 10);
}

function cleanText(t) {
  // Google Maps aggiunge " …" dopo il testo che finisce con emoji: non fa parte della recensione.
  return String(t || "").replace(/\s+…$/, "").replace(/\r/g, "").trim();
}

function validScraped(list) {
  if (!Array.isArray(list) || list.length === 0) throw new Error("Nessuna recensione letta da Google: non aggiorno nulla.");
  for (const r of list) {
    if (!r || !r.id || !r.n || !(r.s >= 1 && r.s <= 5)) throw new Error(`Recensione letta male: ${JSON.stringify(r).slice(0, 120)}`);
  }
  const ids = new Set(list.map((r) => r.id));
  if (ids.size !== list.length) throw new Error("Recensioni doppie nella lettura: non aggiorno nulla.");
}

/**
 * Unisce l'elenco letto da Google con quello salvato.
 * Nuove → aggiunte con data approssimativa; cambiate (testo o stelle) → aggiornate; sparite da Google → tolte,
 * ma se ne spariscono più di MAX_REMOVED in una volta si ferma (lettura probabilmente incompleta).
 */
export function mergeReviews(stored, scraped, today) {
  validScraped(scraped);
  const old = new Map(stored.recensioni.map((r) => [r.id, r]));
  const seen = new Set(scraped.map((r) => r.id));
  const removed = stored.recensioni.filter((r) => !seen.has(r.id));
  if (removed.length > MAX_REMOVED) {
    throw new Error(
      `Da Google mancano ${removed.length} recensioni che sul sito ci sono: probabilmente la lettura è incompleta. Non aggiorno nulla.`,
    );
  }
  const added = [];
  const updated = [];
  const recensioni = scraped.map((r) => {
    const next = { id: r.id, nome: String(r.n).trim(), stelle: Math.round(r.s), testo: cleanText(r.t) };
    const prev = old.get(r.id);
    if (!prev) {
      added.push(next.nome);
      return { ...next, data: relativeToDate(r.d, today) };
    }
    if (prev.nome !== next.nome || prev.stelle !== next.stelle || prev.testo !== next.testo) updated.push(next.nome);
    return { ...next, data: prev.data };
  });
  const changed = added.length + updated.length + removed.length > 0;
  return {
    data: { ...stored, aggiornato: changed ? today : stored.aggiornato, recensioni },
    added,
    updated,
    removed: removed.map((r) => r.nome),
    changed,
  };
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const starsText = (n) => "★".repeat(n) + "☆".repeat(5 - n);
const starsLabel = (n) => `${n} ${n === 1 ? "stella" : "stelle"} su 5`;

function initial(name) {
  const m = String(name).match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : "★";
}

/** Testi lunghi: in pagina si vedono le prime righe, con «Leggi tutta» (così le schede restano basse). */
export function isLong(text) {
  const lines = String(text).split(/\n+/).reduce((a, p) => a + Math.max(1, Math.ceil(p.length / 28)), 0);
  return lines > 6;
}

export function summary(data) {
  const list = data.recensioni;
  const avg = list.length ? list.reduce((a, r) => a + r.stelle, 0) / list.length : 0;
  return { count: list.length, avg: avg.toFixed(1).replace(".", ",") };
}

export function renderSection(data) {
  const { count, avg } = summary(data);
  const withText = data.recensioni.filter((r) => r.testo);
  const starsOnly = data.recensioni.filter((r) => !r.testo);
  const card = (r) =>
    `      <figure class="slab rev${isLong(r.testo) ? " long" : ""}"><div class="face"><div class="stars" aria-label="${starsLabel(r.stelle)}">${starsText(r.stelle)}</div>` +
    `<q>${esc(r.testo).replace(/\n+/g, "<br>")}</q>` +
    (isLong(r.testo) ? `<button type="button" class="rev-toggle" aria-expanded="false">Leggi tutta</button>` : "") +
    `<figcaption class="who"><i>${esc(initial(r.nome))}</i><div>${esc(r.nome)}<small>su Google</small></div></figcaption></div></figure>`;
  const chip = (r) =>
    `        <li><span class="stars" aria-label="${starsLabel(r.stelle)}">${starsText(r.stelle)}</span><span>${esc(r.nome)}</span></li>`;
  const more = starsOnly.length
    ? `    <div class="rev-more rv">
      <h3 class="rev-more-t">${starsOnly.length === 1 ? "Un'altra valutazione" : `Altre ${starsOnly.length} valutazioni`}, solo stelle</h3>
      <ul class="rev-wall" aria-label="Valutazioni senza commento">
${starsOnly.map(chip).join("\n")}
      </ul>
`
    : `    <div class="rev-more rv">
`;
  return `${START}
<section class="sec" id="recensioni" aria-labelledby="recensioni-title">
  <div class="wrap">
    <div class="sec-head rv"><div><div class="eyebrow">${avg} su Google · ${count} recensioni</div><h2 class="t gold-text t3d" id="recensioni-title">Parlano gli artisti.</h2></div>
      <div class="rev-head"><button type="button" id="rprev" aria-label="Recensioni precedenti">←</button><button type="button" id="rnext" aria-label="Recensioni successive">→</button></div></div>
    <div class="revs" id="revs" tabindex="0" aria-label="Recensioni dei clienti">
${withText.map(card).join("\n")}
    </div>
${more}      <div class="rev-links"><a class="btn-ghost" href="${esc(data.urlGoogle)}" target="_blank" rel="noopener" data-track="recensioni_google">Leggile tutte su Google ↗</a><a class="btn-ghost" href="${esc(data.urlScrivi)}" target="_blank" rel="noopener" data-track="scrivi_recensione">Hai registrato da noi? Lascia una recensione ↗</a></div>
    </div>
  </div>
</section>
${END}`;
}

export function applyToHtml(html, data) {
  const { count, avg } = summary(data);
  let out;
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a !== -1 && b > a) {
    out = html.slice(0, a) + renderSection(data) + html.slice(b + END.length);
  } else {
    // Prima volta: sostituisce la sezione scritta a mano.
    const re = /<section class="sec" id="recensioni"[\s\S]*?<\/section>/;
    if (!re.test(html)) throw new Error("Sezione #recensioni non trovata in index.html");
    out = html.replace(re, renderSection(data));
  }
  // Contatore nella hero (e ovunque compaia).
  out = out.replace(/<b>[\d,]+<\/b> su Google · \d+ recensioni/g, `<b>${avg}</b> su Google · ${count} recensioni`);
  return out;
}

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
