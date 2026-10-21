/**
 * Popola il database con il catalogo dimostrativo (idempotente: si può rilanciare).
 * Le chiavi R2 seguono la convenzione `beats/<slug>/{preview.mp3,master.mp3,master.wav,stems.zip}`:
 * caricando i file reali con questi nomi il catalogo diventa subito scaricabile.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { DEMO_BEATS, DEMO_DEAL, DEMO_GENRES, DEMO_PRODUCERS, DEMO_TYPE_TAGS, searchDocumentFor } from "../lib/beats/demo-data";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL non impostato");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  for (const p of DEMO_PRODUCERS) {
    await db.producer.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, name: p.name, bio: p.bio, isResident: p.isResident, accentColor: p.accentColor },
      update: { name: p.name, bio: p.bio, isResident: p.isResident, accentColor: p.accentColor },
    });
  }
  for (const g of DEMO_GENRES.filter((g) => !g.parent).concat(DEMO_GENRES.filter((g) => g.parent))) {
    const parent = g.parent ? { connect: { slug: g.parent } } : undefined;
    await db.genre.upsert({ where: { slug: g.slug }, create: { slug: g.slug, name: g.name, parent }, update: { name: g.name, parent } });
  }
  for (const t of DEMO_TYPE_TAGS) {
    await db.typeTag.upsert({ where: { slug: t.slug }, create: t, update: { name: t.name } });
  }

  const producers = new Map((await db.producer.findMany()).map((p) => [p.slug, p.id]));
  for (const b of DEMO_BEATS) {
    const released = new Date(Date.now() - b.daysAgo * 86_400_000);
    const data = {
      title: b.title,
      status: "PUBLISHED" as const,
      bpm: b.bpm,
      keyRoot: b.keyRoot,
      keyMode: b.keyMode,
      durationSec: b.durationSec,
      moods: b.moods,
      waveformPeaks: b.peaks,
      previewObjectKey: `beats/${b.slug}/preview.mp3`,
      mp3ObjectKey: `beats/${b.slug}/master.mp3`,
      wavObjectKey: `beats/${b.slug}/master.wav`,
      stemsObjectKey: b.hasStems ? `beats/${b.slug}/stems.zip` : null,
      playCount: b.plays,
      searchDocument: searchDocumentFor(b),
      releasedAt: released,
      genres: { set: [], connect: b.genres.map((slug) => ({ slug })) },
      typeTags: { set: [], connect: b.typeTags.map((slug) => ({ slug })) },
    };
    const beat = await db.beat.upsert({
      where: { slug: b.slug },
      create: { ...data, slug: b.slug, genres: { connect: data.genres.connect }, typeTags: { connect: data.typeTags.connect } },
      update: data,
    });
    await db.beatProducer.deleteMany({ where: { beatId: beat.id } });
    await db.beatProducer.createMany({
      data: b.producers.map((p) => ({ beatId: beat.id, producerId: producers.get(p.slug)!, role: p.role, splitPct: p.splitPct })),
    });
  }

  const dealBeat = await db.beat.findUniqueOrThrow({ where: { slug: DEMO_DEAL.beatSlug } });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  await db.dailyDeal.deleteMany({ where: { beatId: dealBeat.id, startsAt: start } });
  await db.dailyDeal.create({ data: { beatId: dealBeat.id, discountPct: DEMO_DEAL.discountPct, startsAt: start, endsAt: end } });

  console.log(`Seed completato: ${DEMO_BEATS.length} beat, ${DEMO_PRODUCERS.length} produttori.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
