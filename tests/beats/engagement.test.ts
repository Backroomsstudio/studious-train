import assert from "node:assert/strict";
import { test } from "node:test";
import { BADGES, computeBadges, newlyUnlocked, type BadgeInput } from "../../lib/beats/badges";
import { addListening, computeListeningStats, dayKey, EMPTY_LOG, streaks, type ListenedBeat } from "../../lib/beats/listening-stats";
import { compareHref, rankCandidates } from "../../lib/beats/compare";
import { encodeQr, qrByteCapacity, qrPath } from "../../lib/beats/qr";

/* ---- QR Code ---- */

// Matrici di riferimento generate con la libreria Python `qrcode` (modo byte, livello M, maschera fissata).
const REF_INVITE = [
  "111111100010111011111001001111111", "100000100100111101001110101000001", "101110101001110111101111101011101",
  "101110101111101110000110001011101", "101110101110100100100001101011101", "100000101101010110000010001000001",
  "111111101010101010101010101111111", "000000001101101100110111000000000", "101111100001010111001011001111100",
  "000001011110100010111001001101101", "000111101110000110100000001010110", "000001011101101100001111110011111",
  "110110100011100100101111110111000", "110101010110111111010001001000111", "101110110000010000100010111011010",
  "110001001001010010001110011011100", "000110101011111001001010110110001", "011110010101010011111101001101101",
  "000010100100100111001100011110110", "101000001001101111110111101111110", "000011100000101110001110010011000",
  "110001010100110101110001011101101", "101110100011000111001110000001110", "100010001000111100011110101111100",
  "101011110011100101101011111110010", "000000001000000010111110100010101", "111111100001010100100111101010110",
  "100000101111100000011111100011111", "101110101100011100111110111111011", "101110101011111111010101110011111",
  "101110101011111001000000101100100", "100000100111000010001110010011100", "111111101000101001010001101100010",
];
const REF_SHORT = [
  "111111100001001111111", "100000101011101000001", "101110101111101011101", "101110101111101011101",
  "101110100010101011101", "100000100111001000001", "111111101010101111111", "000000001110000000000",
  "100000101111011001110", "010101000101110010101", "101100100100110001110", "010111011001110111101",
  "000011100001101001111", "000000001000100000100", "111111100111011001010", "100000100000001101111",
  "101110100011000010101", "101110100111111000000", "101110100001110010011", "100000100101111011100",
  "111111101010100101110",
];

const rows = (q: ReturnType<typeof encodeQr>) => q.modules.map((r) => r.map((c) => (c ? "1" : "0")).join(""));

test("QR: link d'invito identico al riferimento (versione 4-M, maschera 2)", () => {
  const q = encodeQr("https://backrooms.studio/beats/accedi?invito=KAEL742", { ecc: "M", mask: 2 });
  assert.equal(q.version, 4);
  assert.equal(q.size, 33);
  assert.deepEqual(rows(q), REF_INVITE);
});

test("QR: testo corto identico al riferimento (versione 1-M, maschera 5)", () => {
  const q = encodeQr("BACKROOMS", { ecc: "M", mask: 5 });
  assert.equal(q.version, 1);
  assert.deepEqual(rows(q), REF_SHORT);
});

test("QR: capacità in byte come da tabella ISO", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 10].map((v) => qrByteCapacity(v, "M")), [14, 26, 42, 62, 84, 213]);
  assert.equal(qrByteCapacity(1, "L"), 17);
  assert.equal(qrByteCapacity(10, "H"), 119);
});

test("QR: sceglie la versione minima, la maschera automatica e rifiuta i testi troppo lunghi", () => {
  assert.equal(encodeQr("x".repeat(62)).version, 4);
  assert.equal(encodeQr("x".repeat(63)).version, 5);
  const auto = encodeQr("https://backrooms.studio/beats/accedi?invito=KAEL742");
  assert.ok(auto.mask >= 0 && auto.mask <= 7);
  // I pattern di posizione non dipendono dalla maschera.
  assert.deepEqual(rows(auto).slice(0, 7).map((r) => r.slice(0, 7)), REF_INVITE.slice(0, 7).map((r) => r.slice(0, 7)));
  assert.throws(() => encodeQr("x".repeat(214)), RangeError);
  assert.match(qrPath(encodeQr("BACKROOMS", { mask: 5 })), /^M4 4h1v1h-1z/);
});

/* ---- Statistiche d'ascolto ---- */

const producer = (slug: string, role: "MAIN" | "CO_PRODUCER" = "MAIN") => ({ slug, name: slug[0].toUpperCase() + slug.slice(1), role, accentColor: null });
const beat = (id: string, genre: { slug: string; name: string; parent?: string | null }, producers = [producer("astral")]): ListenedBeat => ({
  id,
  slug: id,
  title: id.toUpperCase(),
  bpm: 140,
  key: { root: 9, mode: "MINOR" },
  coverUrl: null,
  producers,
  genres: [genre],
});

const PLUGG = { slug: "plugg", name: "Plugg", parent: "trap" };
const RNB = { slug: "rnb", name: "R&B", parent: null };

test("ascolti: ore, beat, produttore e genere preferiti", () => {
  const at = new Date(2026, 9, 20, 15);
  let log = EMPTY_LOG;
  log = addListening(log, beat("level-0", PLUGG), 3600, at, { countPlay: true });
  log = addListening(log, beat("level-0", PLUGG), 1800, at, { countPlay: true });
  log = addListening(log, beat("moquette", RNB, [producer("freya"), producer("astral", "CO_PRODUCER")]), 2400, at, { countPlay: true });
  const s = computeListeningStats(log, at);
  assert.equal(s.totalSeconds, 7800);
  assert.equal(s.hours, 2.2);
  assert.equal(s.minutes, 130);
  assert.equal(s.plays, 3);
  assert.equal(s.topBeat?.beat.id, "level-0");
  assert.equal(s.topBeat?.plays, 2);
  // Astral: 5400 s da principale + 1200 s da co-produttore; Freya 2400 s.
  assert.equal(s.topProducer?.slug, "astral");
  assert.equal(s.producers[0].seconds, 6600);
  // Plugg conta come Trap (genere principale).
  assert.equal(s.topGenre?.slug, "trap");
  assert.equal(s.topGenre?.name, "Trap");
  assert.deepEqual(s.genres.map((g) => [g.slug, g.pct]), [["trap", 69], ["rnb", 31]]);
});

test("ascolti: serie di giorni consecutivi, giorni brevi esclusi", () => {
  const now = new Date(2026, 9, 22, 10);
  const days: Record<string, number> = {};
  for (const d of [22, 21, 20, 18, 17, 16, 15]) days[dayKey(new Date(2026, 9, d))] = 600;
  days[dayKey(new Date(2026, 9, 19))] = 30; // meno di un minuto: rompe la serie
  assert.deepEqual(streaks(days, now), { current: 3, longest: 4 });
  // Se oggi non hai ancora ascoltato, la serie di ieri resta viva.
  assert.equal(streaks(days, new Date(2026, 9, 23, 9)).current, 3);
  assert.equal(streaks(days, new Date(2026, 9, 24, 9)).current, 0);
  // La serie attraversa il cambio di mese.
  assert.equal(streaks({ [dayKey(new Date(2026, 9, 31))]: 90, [dayKey(new Date(2026, 10, 1))]: 90 }, new Date(2026, 10, 1)).current, 2);
});

test("ascolti: notturno dopo mezzanotte e filtro per anno", () => {
  let log = addListening(EMPTY_LOG, beat("a", RNB), 120, new Date(2026, 0, 3, 2));
  log = addListening(log, beat("b", RNB), 300, new Date(2025, 11, 30, 20));
  const s = computeListeningStats(log, new Date(2026, 0, 3, 12), 2026);
  assert.equal(s.nightOwl, true);
  assert.equal(s.totalSeconds, 120);
  assert.equal(s.topBeat?.beat.id, "a");
  assert.equal(computeListeningStats(EMPTY_LOG).topBeat, null);
});

/* ---- Badge ---- */

const base: BadgeInput = { unlocked: 0, saved: 0, listenSeconds: 0, longestStreak: 0, nightOwl: false, levelMonths: 0, counters: {} };
const byId = (input: BadgeInput) => Object.fromEntries(computeBadges(input).map((b) => [b.def.id, b]));

test("badge: tutto bloccato all'inizio, id unici", () => {
  assert.ok(computeBadges(base).every((b) => !b.unlocked && b.progress === 0));
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
});

test("badge: traguardi da libreria, salvati, ascolti, livello e contatori", () => {
  const b = byId({ ...base, unlocked: 3, saved: 5, listenSeconds: 9.5 * 3600, longestStreak: 7, nightOwl: true, levelMonths: 7, counters: { demo: 1 } });
  assert.equal(b["primo-sblocco"].unlocked, true);
  assert.equal(b.collezionista.unlocked, false);
  assert.equal(b.collezionista.current, 3);
  assert.equal(b.collezionista.progress, 0.3);
  assert.equal(b.swiper.unlocked, true);
  assert.equal(b.maratoneta.current, 9);
  assert.equal(b.maratoneta.unlocked, false);
  assert.equal(b["in-serie"].unlocked, true);
  assert.equal(b.notturno.unlocked, true);
  assert.equal(b["resident-gold"].unlocked, true);
  assert.equal(b["resident-gold"].current, 6); // limitato al traguardo
  assert.equal(b["prima-demo"].unlocked, true);
});

test("badge: solo i nuovi sblocchi rispetto a quelli già visti", () => {
  const states = computeBadges({ ...base, unlocked: 1, counters: { compare: 2 } });
  assert.deepEqual(newlyUnlocked(states, ["primo-sblocco"]).map((s) => s.def.id), ["orecchio-fino"]);
});

/* ---- Confronto A/B ---- */

test("confronto: B più vicino per BPM, con vantaggio alla tonalità compatibile", () => {
  const a = { id: "a", bpm: 140, key: { root: 9, mode: "MINOR" as const } }; // 8A
  const pool = [
    a,
    { id: "far", bpm: 100, key: { root: 9, mode: "MINOR" as const } },
    { id: "near", bpm: 142, key: { root: 1, mode: "MAJOR" as const } }, // 3B, non compatibile
    { id: "compat", bpm: 144, key: { root: 0, mode: "MAJOR" as const } }, // 8B, compatibile
  ];
  assert.deepEqual(rankCandidates(a, pool).map((x) => x.id), ["compat", "near", "far"]);
  assert.equal(compareHref("level-0", "moquette"), "/beats/confronta?a=level-0&b=moquette");
});
