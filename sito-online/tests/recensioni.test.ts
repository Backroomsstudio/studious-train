import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-ignore: modulo JavaScript senza tipi
import { applyToHtml, mergeReviews, relativeToDate, renderSection, summary, DATA_FILE, HTML_FILE, MAX_REMOVED } from "../scripts/recensioni.mjs";

const base = { fonte: "Google Maps", urlGoogle: "https://maps.google.com/?cid=1", urlScrivi: "https://example.com/scrivi", aggiornato: "2026-11-01", recensioni: [] as any[] };
const r = (id: string, n: string, s = 5, t = "", d = "un giorno fa") => ({ id, n, s, t, d });

test("date relative di Google → data approssimativa", () => {
  assert.equal(relativeToDate("2 ore fa", "2026-11-23"), "2026-11-23");
  assert.equal(relativeToDate("un giorno fa", "2026-11-23"), "2026-11-22");
  assert.equal(relativeToDate("una settimana fa", "2026-11-23"), "2026-11-16");
  assert.equal(relativeToDate("3 settimane fa", "2026-11-23"), "2026-11-02");
  assert.equal(relativeToDate("1 mese fa", "2026-11-23"), "2026-10-24");
});

test("sync: aggiunge le nuove, tiene la data delle vecchie, aggiorna i testi cambiati", () => {
  const first = mergeReviews(base, [r("a", "Anna", 5, "Top"), r("b", "Bruno")], "2026-11-20");
  assert.deepEqual(first.added, ["Anna", "Bruno"]);
  const second = mergeReviews(first.data, [r("c", "Carla", 4, "Bello", "2 ore fa"), r("a", "Anna", 5, "Top davvero"), r("b", "Bruno")], "2026-11-23");
  assert.deepEqual(second.added, ["Carla"]);
  assert.deepEqual(second.updated, ["Anna"]);
  assert.equal(second.data.recensioni[0].id, "c");
  assert.equal(second.data.recensioni[1].data, first.data.recensioni[0].data);
  assert.equal(second.data.aggiornato, "2026-11-23");
  const same = mergeReviews(second.data, [r("c", "Carla", 4, "Bello"), r("a", "Anna", 5, "Top davvero"), r("b", "Bruno")], "2026-11-24");
  assert.equal(same.changed, false);
  assert.equal(same.data.aggiornato, "2026-11-23");
});

test("sync: si ferma se la lettura è vuota, doppia o se sparisce troppa roba", () => {
  const stored = mergeReviews(base, Array.from({ length: 10 }, (_, i) => r(`id${i}`, `N${i}`)), "2026-11-23").data;
  assert.throws(() => mergeReviews(stored, [], "2026-11-24"), /Nessuna recensione/);
  assert.throws(() => mergeReviews(stored, [r("x", "X"), r("x", "X")], "2026-11-24"), /doppie/);
  assert.throws(() => mergeReviews(stored, stored.recensioni.slice(0, 10 - MAX_REMOVED - 1).map((x: any) => r(x.id, x.nome)), "2026-11-24"), /incompleta/);
  const ok = mergeReviews(stored, stored.recensioni.slice(1).map((x: any) => r(x.id, x.nome)), "2026-11-24");
  assert.deepEqual(ok.removed, ["N0"]);
});

test("rendering: testo protetto, emoji finali senza «…», stelle e contatori giusti", () => {
  const d = mergeReviews(base, [r("a", "<b>Anna</b>", 4, "Ciao <script>x</script>\nriga 2 🔥 …"), r("b", "Bruno")], "2026-11-23").data;
  const html = renderSection(d);
  assert.ok(!html.includes("<script>x"));
  assert.ok(html.includes("&lt;b&gt;Anna&lt;/b&gt;"));
  assert.ok(html.includes("riga 2 🔥</q>"));
  assert.ok(html.includes("★★★★☆"));
  assert.ok(html.includes("4,5 su Google · 2 recensioni"));
  assert.ok(html.includes("Un'altra valutazione, solo stelle"));
  assert.deepEqual(summary(d), { count: 2, avg: "4,5" });
});

test("la pagina online è allineata a data/recensioni.json", () => {
  const data = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  const html = readFileSync(HTML_FILE, "utf8");
  assert.equal(applyToHtml(html, data), html);
  const { count } = summary(data);
  assert.equal((html.match(new RegExp(`su Google · ${count} recensioni`, "g")) || []).length, 2);
  assert.equal((html.match(/<figure class="slab rev( long)?">/g) || []).length, data.recensioni.filter((x: any) => x.testo).length);
});

test("/api/recensioni: impagina il JSON letto da GitHub e lo mette in cache sulla CDN", async () => {
  // @ts-ignore: modulo .mts importato dal test
  const { default: handler } = await import("../netlify/functions/recensioni.mts");
  const data = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  const orig = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify(data))) as typeof fetch;
    const res: Response = await handler();
    assert.equal(res.status, 200);
    assert.match(res.headers.get("Netlify-CDN-Cache-Control") || "", /max-age=1800/);
    const body = await res.json();
    assert.equal(body.count, data.recensioni.length);
    assert.equal(body.label, `${summary(data).avg} su Google · ${data.recensioni.length} recensioni`);
    assert.ok(body.cards.includes('<figure class="slab rev'));
    globalThis.fetch = (async () => new Response("no", { status: 404 })) as typeof fetch;
    assert.equal((await handler()).status, 503);
  } finally {
    globalThis.fetch = orig;
  }
});
