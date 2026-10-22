/**
 * Test di "Cerco feat" sul backend dimostrativo (stesse regole del backend Prisma):
 * annunci, unicità delle chat, autorizzazioni, chiusura, limiti e risposta automatica demo.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { FEAT_LIMITS, parseFeatFilters, timeAgo, underLimit } from "../../lib/beats/feat";
import { createDemoFeat, DEMO_BOT_REPLIES, initialFeatState } from "../../lib/beats/server/demo-feat";
import { StoreError } from "../../lib/beats/server/errors";

const ANNA = "test-anna";
const BRUNO = "test-bruno";
const CARLA = "test-carla";

const isCode = (code: string) => (e: unknown) => e instanceof StoreError && e.code === code;

/** Backend isolato con orologio manuale. */
function setup() {
  const clock = { t: Date.UTC(2026, 9, 22, 12) };
  const feat = createDemoFeat({ state: initialFeatState(clock.t), now: () => clock.t, botDelayMs: 2000 });
  return { feat, clock };
}

const post = { role: "feat" as const, text: "Cerco una voce per il ritornello del mio pezzo trap." };

test("bacheca: i 6 annunci del prototipo, dal più recente, con filtri per ruolo e genere", async () => {
  const { feat } = setup();
  const all = await feat.featPosts(null);
  assert.equal(all.length, 6);
  assert.equal(all[0].author.name, "Nebbia");
  assert.ok(all.every((p, i) => i === 0 || p.createdAt <= all[i - 1].createdAt));
  assert.equal(all[0].beat?.slug, "ronzio");
  assert.equal(all[0].replyCount, 2);
  assert.equal(all[0].author.level.name, "Gold");
  assert.ok(all.every((p) => !p.isMine && p.threadId === null));

  const strofe = await feat.featPosts(null, { role: "strofa" });
  assert.deepEqual(strofe.map((p) => p.author.name), ["Tommy K", "Rocco 808"]);
  const drill = await feat.featPosts(null, { genre: "drill" });
  assert.deepEqual(drill.map((p) => p.author.name), ["Luce"]);
});

test("pubblicare: valida il testo, il genere e il beat; l'annuncio va in cima ed è dell'autore", async () => {
  const { feat, clock } = setup();
  clock.t += 1000;
  const created = await feat.createFeatPost(ANNA, { ...post, genre: "trap", beatId: "demo-cromo", city: "Vicenza" });
  assert.equal(created.isMine, true);
  assert.equal(created.status, "OPEN");
  assert.equal(created.beat?.title, "Cromo");
  assert.equal(created.genre?.name, "Trap");
  assert.equal(new Date(created.expiresAt).getTime() - new Date(created.createdAt).getTime(), 30 * 86_400_000);

  const forAnna = await feat.featPosts(ANNA);
  assert.equal(forAnna[0].id, created.id);
  assert.equal(forAnna[0].isMine, true);
  assert.equal((await feat.featPosts(BRUNO))[0].isMine, false);

  await assert.rejects(feat.createFeatPost(ANNA, { ...post, text: "corto" }), isCode("BAD_REQUEST"));
  await assert.rejects(feat.createFeatPost(ANNA, { ...post, text: "x".repeat(281) }), isCode("BAD_REQUEST"));
  await assert.rejects(feat.createFeatPost(ANNA, { ...post, genre: "polka" }), isCode("BAD_REQUEST"));
  await assert.rejects(feat.createFeatPost(ANNA, { ...post, beatId: "demo-non-esiste" }), isCode("BAD_REQUEST"));
  await assert.rejects(feat.createFeatPost(ANNA, { ...post, role: "dj" as never }), isCode("BAD_REQUEST"));
});

test("chat: una sola per coppia annuncio + artista, e l'autore non risponde a sé stesso", async () => {
  const { feat } = setup();
  const p = await feat.createFeatPost(ANNA, post);
  const first = await feat.openFeatThread(BRUNO, p.id);
  const again = await feat.openFeatThread(BRUNO, p.id);
  assert.equal(again.id, first.id);
  assert.equal(first.isAuthor, false);
  assert.equal(first.other.name, "Artista");
  const other = await feat.openFeatThread(CARLA, p.id);
  assert.notEqual(other.id, first.id);
  await assert.rejects(feat.openFeatThread(ANNA, p.id), isCode("BAD_REQUEST"));

  // Aprire senza scrivere non conta come risposta.
  assert.equal((await feat.featPosts(null)).find((x) => x.id === p.id)?.replyCount, 0);
  await feat.sendFeatMessage(BRUNO, first.id, "Ciao! Ti mando una demo?");
  const listed = (await feat.featPosts(BRUNO)).find((x) => x.id === p.id)!;
  assert.equal(listed.replyCount, 1);
  assert.equal(listed.threadId, first.id);
});

test("chat: la leggono e scrivono solo i due partecipanti; i non letti si azzerano aprendo", async () => {
  const { feat, clock } = setup();
  const p = await feat.createFeatPost(ANNA, post);
  const t = await feat.openFeatThread(BRUNO, p.id);
  clock.t += 1000;
  await feat.sendFeatMessage(BRUNO, t.id, "Ci sto, quando registriamo?");

  await assert.rejects(feat.featThread(CARLA, t.id), isCode("NOT_FOUND"));
  await assert.rejects(feat.sendFeatMessage(CARLA, t.id, "Posso entrare anche io?"), isCode("NOT_FOUND"));
  await assert.rejects(feat.sendFeatMessage(BRUNO, t.id, "   "), isCode("BAD_REQUEST"));
  await assert.rejects(feat.sendFeatMessage(BRUNO, t.id, "x".repeat(1001)), isCode("BAD_REQUEST"));
  await assert.rejects(feat.reportFeat(CARLA, { messageId: (await feat.featThread(BRUNO, t.id)).messages[0].id, reason: "Spam" }), isCode("NOT_FOUND"));

  // L'autrice vede la chat in "I tuoi messaggi" con un non letto.
  const inbox = await feat.featInbox(ANNA);
  assert.equal(inbox.unread, 1);
  assert.equal(inbox.threads[0].isAuthor, true);
  assert.equal(inbox.threads[0].last?.body, "Ci sto, quando registriamo?");
  assert.equal((await feat.featInbox(CARLA)).threads.length, 0);

  const read = await feat.featThread(ANNA, t.id);
  assert.equal(read.messages.length, 1);
  assert.equal(read.messages[0].mine, false);
  assert.equal((await feat.featInbox(ANNA)).unread, 0);
  await feat.sendFeatMessage(ANNA, t.id, "Domani alle 18 al Backrooms!");
  const forBruno = await feat.featThread(BRUNO, t.id);
  assert.deepEqual(forBruno.messages.map((m) => m.mine), [true, false]);
  assert.ok(forBruno.messages[0].readAt);
});

test("chiusura: solo l'autore; poi niente nuove chat, ma le chat aperte continuano", async () => {
  const { feat } = setup();
  const p = await feat.createFeatPost(ANNA, post);
  const t = await feat.openFeatThread(BRUNO, p.id);
  await assert.rejects(feat.closeFeatPost(BRUNO, p.id), isCode("FORBIDDEN"));
  await assert.rejects(feat.closeFeatPost(ANNA, "demo-feat-nessuno"), isCode("NOT_FOUND"));

  const closed = await feat.closeFeatPost(ANNA, p.id);
  assert.equal(closed.status, "CLOSED");
  assert.equal((await feat.featPosts(BRUNO)).some((x) => x.id === p.id), false);
  assert.equal((await feat.featPosts(ANNA)).find((x) => x.id === p.id)?.status, "CLOSED");
  await assert.rejects(feat.openFeatThread(CARLA, p.id), isCode("BAD_REQUEST"));
  assert.equal((await feat.openFeatThread(BRUNO, p.id)).id, t.id);
  await feat.sendFeatMessage(BRUNO, t.id, "Peccato, alla prossima!");
});

test("scadenza: dopo 30 giorni l'annuncio esce dalla bacheca", async () => {
  const { feat, clock } = setup();
  const p = await feat.createFeatPost(ANNA, post);
  clock.t += 31 * 86_400_000;
  assert.equal((await feat.featPosts(ANNA)).some((x) => x.id === p.id), false);
  await assert.rejects(feat.openFeatThread(BRUNO, p.id), isCode("BAD_REQUEST"));
});

test("limiti: 3 annunci ogni 24 ore e 20 messaggi al minuto per artista", async () => {
  const { feat, clock } = setup();
  for (let i = 0; i < FEAT_LIMITS.posts.max; i++) {
    await feat.createFeatPost(ANNA, { ...post, text: `${post.text} #${i}` });
    clock.t += 60_000;
  }
  await assert.rejects(feat.createFeatPost(ANNA, post), isCode("RATE_LIMITED"));
  // Il limite è per artista e scorre col tempo.
  await feat.createFeatPost(BRUNO, post);
  clock.t += 24 * 3_600_000;
  const p = await feat.createFeatPost(ANNA, post);

  const t = await feat.openFeatThread(BRUNO, p.id);
  for (let i = 0; i < FEAT_LIMITS.messages.max; i++) await feat.sendFeatMessage(BRUNO, t.id, `Messaggio ${i}`);
  await assert.rejects(feat.sendFeatMessage(BRUNO, t.id, "Uno di troppo"), isCode("RATE_LIMITED"));
  await feat.sendFeatMessage(ANNA, t.id, "Io posso ancora rispondere");
  clock.t += 61_000;
  await feat.sendFeatMessage(BRUNO, t.id, "Dopo un minuto si riparte");

  assert.equal(underLimit([1, 2], { max: 3, windowMs: 10 }, 5), true);
  assert.equal(underLimit([1, 2, 3], { max: 3, windowMs: 10 }, 5), false);
  assert.equal(underLimit([1, 2, 3], { max: 3, windowMs: 10 }, 12), true);
});

test("solo demo: l'autore finto risponde una volta, dopo il ritardo, e la risposta è non letta", async () => {
  const { feat, clock } = setup();
  const nebbia = (await feat.featPosts(BRUNO))[0];
  const t = await feat.openFeatThread(BRUNO, nebbia.id);
  await feat.sendFeatMessage(BRUNO, t.id, "Ciao Nebbia, ho la voce giusta!");
  assert.equal((await feat.featInbox(BRUNO)).unread, 0);
  clock.t += 2500;
  const inbox = await feat.featInbox(BRUNO);
  assert.equal(inbox.unread, 1);
  assert.equal(inbox.threads[0].last?.body, DEMO_BOT_REPLIES[0]);
  assert.equal(inbox.threads[0].other.name, "Nebbia");

  await feat.sendFeatMessage(BRUNO, t.id, "Grande, ti scrivo stasera.");
  clock.t += 10_000;
  const chat = await feat.featThread(BRUNO, t.id);
  assert.equal(chat.messages.filter((m) => !m.mine).length, 1);
  assert.equal((await feat.featInbox(BRUNO)).unread, 0);
});

test("segnalazioni: annunci pubblici, messaggi solo per chi li vede; ripetere non duplica", async () => {
  const state = initialFeatState(Date.now());
  const feat = createDemoFeat({ state });
  const [first] = await feat.featPosts(null);
  await feat.reportFeat(BRUNO, { postId: first.id, reason: "Spam o pubblicità" });
  await feat.reportFeat(BRUNO, { postId: first.id, reason: "Spam o pubblicità" });
  await feat.reportFeat(CARLA, { postId: first.id, reason: "Altro" });
  assert.equal(state.reports.length, 2);
  await assert.rejects(feat.reportFeat(BRUNO, { postId: "nessuno", reason: "Altro" }), isCode("NOT_FOUND"));
  await assert.rejects(feat.reportFeat(BRUNO, { reason: "Altro" }), isCode("BAD_REQUEST"));
});

test("filtri dalla query string e tempo relativo in italiano", () => {
  assert.deepEqual(parseFeatFilters(new URLSearchParams("role=strofa&genre=Trap")), { role: "strofa", genre: "trap" });
  assert.deepEqual(parseFeatFilters(new URLSearchParams("role=dj&genre=<x>")), {});
  const now = Date.UTC(2026, 9, 22, 12);
  assert.equal(timeAgo(new Date(now - 20_000).toISOString(), now), "adesso");
  assert.equal(timeAgo(new Date(now - 5 * 60_000).toISOString(), now), "5 minuti fa");
  assert.equal(timeAgo(new Date(now - 2 * 3_600_000).toISOString(), now), "2 ore fa");
  assert.equal(timeAgo(new Date(now - 30 * 3_600_000).toISOString(), now), "ieri");
});
