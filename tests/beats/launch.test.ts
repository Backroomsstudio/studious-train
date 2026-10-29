import assert from "node:assert/strict";
import { test } from "node:test";
import { gateExempt, isStaffRole, launchLabel, parseLaunchAt, parseStaffInvites, storeOpen } from "../../lib/beats/launch";
import {
  beatInputSchema,
  beatVisibility,
  evenSplits,
  formatOf,
  guessFromFilename,
  productInputSchema,
  slugify,
  uploadKey,
} from "../../lib/beats/staff";

test("lancio: aperto senza data, chiuso prima, aperto dalla data in poi", () => {
  const at = parseLaunchAt("2027-01-01T00:00:00+01:00")!;
  assert.equal(at.toISOString(), "2026-12-31T23:00:00.000Z");
  assert.equal(storeOpen(null), true);
  assert.equal(storeOpen(at, new Date("2026-12-31T22:59:59Z")), false);
  assert.equal(storeOpen(at, new Date("2026-12-31T23:00:00Z")), true);
  assert.equal(parseLaunchAt("non una data"), null);
  assert.equal(parseLaunchAt(""), null);
  assert.equal(launchLabel(at), "1° gennaio 2027");
  assert.equal(launchLabel(new Date("2027-01-15T12:00:00Z")), "15 gennaio 2027");
});

test("lancio: accesso, attesa e servizi restano raggiungibili; il catalogo no", () => {
  for (const path of ["/beats/accedi", "/beats/presto", "/api/auth/session", "/api/webhooks/stripe", "/api/waitlist", "/api/staff/uploads"]) {
    assert.equal(gateExempt(path), true, path);
  }
  for (const path of ["/beats", "/beats/cerca", "/beats/accedi-falso", "/api/beats", "/api/products/x/preview"]) {
    assert.equal(gateExempt(path), false, path);
  }
  assert.equal(isStaffRole("ADMIN"), true);
  assert.equal(isStaffRole("PRODUCER"), true);
  assert.equal(isStaffRole("ARTIST"), false);
  assert.equal(isStaffRole(undefined), false);
});

test("codici staff: codice maiuscolo → producer, voci malformate ignorate", () => {
  const invites = parseStaffInvites("astral:abc123XYZ, Freya:FREYA2027 ,rotto,plugghe:corto");
  assert.equal(invites.get("ABC123XYZ"), "astral");
  assert.equal(invites.get("FREYA2027"), "freya");
  assert.equal(invites.size, 2);
});

test("caricamenti: formato dal nome e chiavi per bozza", () => {
  assert.equal(formatOf("Level 0.WAV"), "wav");
  assert.equal(formatOf("kit.zip"), "zip");
  assert.equal(formatOf("cover.png"), null);
  const draft = "3f2b8c1e-1d2a-4b5c-8d9e-0a1b2c3d4e5f";
  assert.equal(uploadKey(draft, "preview"), `beats/${draft}/preview.mp3`);
  assert.equal(uploadKey(draft, "stem-bass"), `beats/${draft}/stems/bass.mp3`);
  assert.equal(uploadKey(draft, "product-zip"), `products/${draft}/kit.zip`);
});

test("nome del file: BPM e tonalità se ci sono", () => {
  assert.deepEqual(guessFromFilename("Level 0 140bpm Cmin.wav"), { bpm: 140, keyRoot: 0, keyMode: "MINOR" });
  assert.deepEqual(guessFromFilename("ronzio_92 BPM_F#m.mp3"), { bpm: 92, keyRoot: 6, keyMode: "MINOR" });
  assert.deepEqual(guessFromFilename("Bounce (Eb maj).wav"), { keyRoot: 3, keyMode: "MAJOR" });
  assert.deepEqual(guessFromFilename("Beat senza info.wav"), {});
});

test("quote e slug", () => {
  assert.deepEqual(evenSplits(3), [34, 33, 33]);
  assert.deepEqual(evenSplits(1), [100]);
  assert.equal(slugify("Città di Notte!"), "citta-di-notte");
  assert.equal(slugify("???"), "beat");
});

const baseBeat = {
  title: "Level 0",
  description: "",
  bpm: 140,
  keyRoot: 0,
  keyMode: "MINOR",
  durationSec: 150,
  peaks: Array.from({ length: 160 }, () => 0.5),
  genres: ["trap"],
  typeTags: [],
  moods: [],
  producers: [{ slug: "astral", role: "MAIN", splitPct: 100 }],
  status: "PUBLISHED",
  releasedAt: "2027-01-01T00:00:00+01:00",
  exclusiveAvailable: true,
  files: { preview: "beats/x/preview.mp3", mp3: "beats/x/mp3.mp3", wav: "beats/x/wav.wav", stems: null, stemPreviewPrefix: null },
};

test("beat: per pubblicare servono i file, le quote fanno 100, chiavi solo sotto beats/", () => {
  assert.equal(beatInputSchema.safeParse(baseBeat).success, true);
  assert.equal(beatInputSchema.safeParse({ ...baseBeat, files: { ...baseBeat.files, wav: "" } }).success, false);
  assert.equal(beatInputSchema.safeParse({ ...baseBeat, status: "DRAFT", files: { ...baseBeat.files, wav: "" } }).success, true);
  assert.equal(
    beatInputSchema.safeParse({ ...baseBeat, producers: [{ slug: "astral", role: "MAIN", splitPct: 60 }, { slug: "freya", role: "CO_PRODUCER", splitPct: 30 }] })
      .success,
    false,
  );
  assert.equal(beatInputSchema.safeParse({ ...baseBeat, files: { ...baseBeat.files, wav: "products/../segreto.wav" } }).success, false);
});

test("beat: bozza, online, programmato e archiviato", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  assert.equal(beatVisibility({ status: "DRAFT", releasedAt: "2026-01-01T00:00:00Z" }, now), "draft");
  assert.equal(beatVisibility({ status: "PUBLISHED", releasedAt: "2026-10-01T00:00:00Z" }, now), "live");
  assert.equal(beatVisibility({ status: "PUBLISHED", releasedAt: "2027-01-01T00:00:00Z" }, now), "scheduled");
  assert.equal(beatVisibility({ status: "ARCHIVED", releasedAt: "2026-10-01T00:00:00Z" }, now), "archived");
});

test("kit: in vendita solo con lo ZIP e un prezzo", () => {
  const kit = {
    kind: "LOOP_KIT",
    title: "Notturno",
    description: "25 loop melodici",
    contents: ["25 loop"],
    producerSlug: "freya",
    priceCents: 1990,
    credits: 4,
    coverColor: "#e0306c",
    published: true,
    files: { zip: "products/x/kit.zip", preview: null },
  };
  assert.equal(productInputSchema.safeParse(kit).success, true);
  assert.equal(productInputSchema.safeParse({ ...kit, files: { zip: "", preview: null } }).success, false);
  assert.equal(productInputSchema.safeParse({ ...kit, priceCents: 0, credits: 0 }).success, false);
  assert.equal(productInputSchema.safeParse({ ...kit, published: false, priceCents: 0, credits: 0, files: { zip: "", preview: null } }).success, true);
});
