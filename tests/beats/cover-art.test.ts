import assert from "node:assert/strict";
import { test } from "node:test";
import { coverArtSVG, coverArtURI, hashSeed, shiftHue, svgToDataUri, type CoverArtInput } from "../../lib/beats/cover-art";
import { DEMO_BEATS } from "../../lib/beats/demo-data";
import { toSummary } from "../../lib/beats/server/demo-backend";

const beats = DEMO_BEATS.map((b) => toSummary(b));

/** Controllo di buona forma XML senza dipendenze: ogni tag aperto si chiude nell'ordine giusto. */
function assertWellFormed(svg: string) {
  assert.match(svg, /^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg' viewBox='0 0 200 200'>/);
  assert.ok(svg.endsWith("</svg>"));
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  const stack: string[] = [];
  for (const [, close, name, rest] of svg.matchAll(/<(\/?)([a-zA-Z]+)([^<>]*)>/g)) {
    if (close) assert.equal(stack.pop(), name, `chiusura inattesa </${name}>`);
    else if (!rest.trimEnd().endsWith("/")) stack.push(name);
    // Attributi sempre tra apici singoli, nessun apice spaiato.
    assert.equal((rest.match(/'/g) ?? []).length % 2, 0, `apici spaiati in <${name}${rest}>`);
  }
  assert.deepEqual(stack, [], "tag non chiusi");
}

test("copertina generativa: deterministica e diversa da beat a beat", () => {
  assert.ok(beats.length >= 6);
  const seen = new Set<string>();
  for (const beat of beats) {
    const a = coverArtSVG(beat);
    assert.equal(a, coverArtSVG({ ...beat, peaks: [...beat.peaks] }), `${beat.slug} non è deterministica`);
    assert.equal(coverArtSVG(beat, "lite"), coverArtSVG(beat, "lite"));
    seen.add(a);
  }
  assert.equal(seen.size, beats.length, "due beat hanno la stessa copertina");
});

test("copertina generativa: SVG valido in entrambi i dettagli", () => {
  for (const beat of beats) {
    assertWellFormed(coverArtSVG(beat, "full"));
    assertWellFormed(coverArtSVG(beat, "lite"));
  }
  // La miniatura è più leggera: niente grana né ruota Camelot.
  const full = coverArtSVG(beats[0], "full");
  const lite = coverArtSVG(beats[0], "lite");
  assert.ok(lite.length < full.length);
  assert.ok(!lite.includes("feTurbulence"));
});

test("copertina generativa: colori di produttore e genere, BPM e tonalità influiscono", () => {
  const beat = beats[0];
  const svg = coverArtSVG(beat);
  assert.ok(svg.includes(beat.producers[0].accentColor!.toLowerCase()), "manca il colore del produttore");
  assert.notEqual(coverArtSVG({ ...beat, bpm: 70 }), coverArtSVG({ ...beat, bpm: 160 }));
  assert.notEqual(coverArtSVG({ ...beat, key: { root: 0, mode: "MAJOR" } }), coverArtSVG({ ...beat, key: { root: 0, mode: "MINOR" } }));
  // Colori non validi non entrano mai nel markup.
  const evil = coverArtSVG({ ...beat, producers: [{ accentColor: "red'/><script>" }] });
  assert.ok(!evil.includes("<script"));
  assertWellFormed(evil);
});

test("copertina generativa: funziona anche con dati minimi (schede delle aste)", () => {
  const minimal: CoverArtInput = { id: "auc-1", title: "Ronzio", producers: [{ accentColor: null }] };
  const svg = coverArtSVG(minimal);
  assertWellFormed(svg);
  assert.equal(svg, coverArtSVG(minimal));
});

test("copertina generativa: data URI decodificabile e memoizzato", () => {
  const beat = beats[1];
  const uri = coverArtURI(beat);
  assert.ok(uri.startsWith("data:image/svg+xml,"));
  assert.equal(decodeURIComponent(uri.slice("data:image/svg+xml,".length)), coverArtSVG(beat));
  assert.equal(uri, svgToDataUri(coverArtSVG(beat)));
  assert.equal(coverArtURI(beat), uri);
  assert.doesNotMatch(uri.slice(19), /[<>#"]/);
  assert.equal(hashSeed("ronzio"), hashSeed("ronzio"));
  assert.notEqual(hashSeed("ronzio"), hashSeed("ronzia"));
  assert.equal(shiftHue("#ff0000", 120), "#00ff00");
  assert.equal(shiftHue("#0066ff", 0), "#0066ff");
});
