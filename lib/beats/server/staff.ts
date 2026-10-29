/**
 * Area Gestione (solo staff): catalogo completo in ogni stato, salvataggio di beat e kit, profilo
 * producer. Le chiavi dei file arrivano dal browser dopo il caricamento diretto sul bucket: prima di
 * registrarle si controlla che l'oggetto esista (un caricamento interrotto non diventa un beat rotto).
 */
import "server-only";
import type { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { isStaffRole } from "../launch";
import {
  beatInputSchema,
  productInputSchema,
  producerInputSchema,
  slugify,
  type BeatInput,
  type ProductInput,
  type StaffBeat,
  type StaffProduct,
  type StaffProducer,
} from "../staff";
import { STEM_NAMES } from "../stems";
import type { Viewer } from "../types";
import { StoreError } from "./errors";
import { getDb, type Db } from "./prisma";
import { getViewer } from "./queries";
import { objectSize } from "./storage";

export async function requireStaff(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new StoreError("UNAUTHENTICATED");
  if (!isStaffRole(viewer.role)) throw new StoreError("FORBIDDEN", "Area riservata ai producer dello studio.");
  return viewer;
}

const staffBeatInclude = {
  producers: { include: { producer: true }, orderBy: { role: "asc" } },
  genres: true,
  typeTags: true,
  _count: { select: { licenses: true } },
} satisfies Prisma.BeatInclude;

type StaffBeatRow = Prisma.BeatGetPayload<{ include: typeof staffBeatInclude }>;

function toStaffBeat(row: StaffBeatRow): StaffBeat {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    bpm: row.bpm,
    keyRoot: row.keyRoot,
    keyMode: row.keyMode,
    durationSec: row.durationSec,
    peaks: Array.isArray(row.waveformPeaks) ? (row.waveformPeaks as number[]) : [],
    genres: row.genres.map((g) => g.slug),
    typeTags: row.typeTags.map((t) => t.name),
    moods: row.moods,
    producers: row.producers.map((p) => ({
      slug: p.producer.slug,
      name: p.producer.name,
      role: p.role,
      splitPct: p.splitPct,
      accentColor: p.producer.accentColor,
    })),
    releasedAt: row.releasedAt.toISOString(),
    exclusiveAvailable: row.exclusiveAvailable,
    files: {
      preview: row.previewObjectKey,
      mp3: row.mp3ObjectKey,
      wav: row.wavObjectKey,
      stems: row.stemsObjectKey,
      stemPreviewPrefix: row.stemPreviewPrefix,
    },
    playCount: row.playCount,
    licenseCount: row._count.licenses,
    updatedAt: row.updatedAt.toISOString(),
  };
}

type StaffProductRow = Prisma.ProductGetPayload<{ include: { producer: true; _count: { select: { purchases: true } } } }>;

function toStaffProduct(row: StaffProductRow): StaffProduct {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    description: row.description,
    contents: row.contents,
    producerSlug: row.producer?.slug ?? null,
    priceCents: row.priceCents,
    credits: row.credits,
    coverColor: row.coverColor,
    published: row.published,
    files: { zip: row.objectKey, preview: row.previewObjectKey },
    purchaseCount: row._count.purchases,
  };
}

export interface StaffOverview {
  beats: StaffBeat[];
  products: StaffProduct[];
  producers: StaffProducer[];
  genres: Array<{ slug: string; name: string; parent: string | null }>;
  waitlist: number;
  members: number;
}

export async function staffOverview(): Promise<StaffOverview> {
  const db = getDb();
  const [beats, products, producers, genres, waitlist, members] = await Promise.all([
    db.beat.findMany({ include: staffBeatInclude, orderBy: [{ updatedAt: "desc" }] }),
    db.product.findMany({ include: { producer: true, _count: { select: { purchases: true } } }, orderBy: { createdAt: "desc" } }),
    db.producer.findMany({ orderBy: [{ isResident: "desc" }, { name: "asc" }] }),
    db.genre.findMany({ include: { parent: { select: { slug: true } } }, orderBy: { name: "asc" } }),
    db.waitlistEntry.count(),
    db.user.count({ where: { role: "ARTIST" } }),
  ]);
  return {
    beats: beats.map(toStaffBeat),
    products: products.map(toStaffProduct),
    producers: producers.map((p) => ({
      slug: p.slug,
      name: p.name,
      bio: p.bio ?? "",
      instagram: p.instagram ?? "",
      accentColor: p.accentColor ?? "#8e8e95",
      linked: Boolean(p.userId),
    })),
    genres: genres.map((g) => ({ slug: g.slug, name: g.name, parent: g.parent?.slug ?? null })),
    waitlist,
    members,
  };
}

/** Solo le chiavi nuove vanno verificate: quelle già salvate erano state controllate allora. */
async function assertUploaded(keys: Array<string | null | undefined>, previous: Set<string>) {
  for (const key of keys) {
    if (!key || previous.has(key)) continue;
    if ((await objectSize(key)) === null) throw new StoreError("BAD_REQUEST", "Un file non risulta caricato: riprova il caricamento.");
  }
}

async function uniqueSlug(db: Db, base: string, table: "beat" | "product"): Promise<string> {
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const taken = table === "beat" ? await db.beat.findUnique({ where: { slug } }) : await db.product.findUnique({ where: { slug } });
    if (!taken) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function parse<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new StoreError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Dati non validi.");
  return parsed.data;
}

export async function saveBeat(raw: unknown, id?: string): Promise<StaffBeat> {
  const input: BeatInput = parse(beatInputSchema, raw);
  const db = getDb();
  const existing = id ? await db.beat.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new StoreError("NOT_FOUND", "Beat non trovato.");

  const previous = new Set([existing?.previewObjectKey, existing?.mp3ObjectKey, existing?.wavObjectKey, existing?.stemsObjectKey].filter(Boolean) as string[]);
  const stemPreviews = input.files.stemPreviewPrefix && input.files.stemPreviewPrefix !== existing?.stemPreviewPrefix
    ? STEM_NAMES.map((s) => `${input.files.stemPreviewPrefix}/${s}.mp3`)
    : [];
  await assertUploaded([input.files.preview, input.files.mp3, input.files.wav, input.files.stems, ...stemPreviews], previous);

  const [producers, genres] = await Promise.all([
    db.producer.findMany({ where: { slug: { in: input.producers.map((p) => p.slug) } } }),
    db.genre.findMany({ where: { slug: { in: input.genres } } }),
  ]);
  if (producers.length !== input.producers.length) throw new StoreError("BAD_REQUEST", "Produttore sconosciuto.");
  const producerId = new Map(producers.map((p) => [p.slug, p.id]));

  // I type beat si creano al volo ("Travis Scott" → travis-scott).
  const tags = [...new Map(input.typeTags.map((name) => [slugify(name), name])).entries()];
  for (const [slug, name] of tags) await db.typeTag.upsert({ where: { slug }, create: { slug, name }, update: {} });

  const searchDocument = [
    input.title,
    ...producers.map((p) => p.name),
    ...genres.map((g) => g.name),
    ...tags.map(([, name]) => `${name} type beat`),
    ...input.moods,
  ]
    .join(" ")
    .toLowerCase();

  const data = {
    title: input.title,
    description: input.description || null,
    status: input.status,
    bpm: input.bpm,
    keyRoot: input.keyRoot,
    keyMode: input.keyMode,
    durationSec: input.durationSec,
    moods: input.moods,
    waveformPeaks: input.peaks,
    previewObjectKey: input.files.preview,
    mp3ObjectKey: input.files.mp3,
    wavObjectKey: input.files.wav,
    stemsObjectKey: input.files.stems || null,
    stemPreviewPrefix: input.files.stems ? input.files.stemPreviewPrefix || null : null,
    exclusiveAvailable: input.exclusiveAvailable,
    releasedAt: new Date(input.releasedAt),
    searchDocument,
    genres: { set: genres.map((g) => ({ id: g.id })) },
    typeTags: { set: tags.map(([slug]) => ({ slug })) },
  };

  const beatId = await db.$transaction(async (tx) => {
    const beat = existing
      ? await tx.beat.update({ where: { id: existing.id }, data })
      : await tx.beat.create({
          data: {
            ...data,
            slug: await uniqueSlug(db, slugify(input.title), "beat"),
            genres: { connect: data.genres.set },
            typeTags: { connect: data.typeTags.set },
          },
        });
    await tx.beatProducer.deleteMany({ where: { beatId: beat.id } });
    await tx.beatProducer.createMany({
      data: input.producers.map((p) => ({ beatId: beat.id, producerId: producerId.get(p.slug)!, role: p.role, splitPct: p.splitPct })),
    });
    return beat.id;
  });
  return toStaffBeat(await db.beat.findUniqueOrThrow({ where: { id: beatId }, include: staffBeatInclude }));
}

export async function saveProduct(raw: unknown, id?: string): Promise<StaffProduct> {
  const input: ProductInput = parse(productInputSchema, raw);
  const db = getDb();
  const existing = id ? await db.product.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new StoreError("NOT_FOUND", "Kit non trovato.");
  await assertUploaded([input.files.zip, input.files.preview], new Set([existing?.objectKey, existing?.previewObjectKey].filter(Boolean) as string[]));

  const producer = input.producerSlug ? await db.producer.findUnique({ where: { slug: input.producerSlug } }) : null;
  if (input.producerSlug && !producer) throw new StoreError("BAD_REQUEST", "Produttore sconosciuto.");

  const data = {
    kind: input.kind,
    title: input.title,
    description: input.description,
    contents: input.contents,
    producerId: producer?.id ?? null,
    priceCents: input.priceCents,
    credits: input.credits,
    coverColor: input.coverColor,
    published: input.published,
    objectKey: input.files.zip,
    previewObjectKey: input.files.preview || null,
  };
  const row = existing
    ? await db.product.update({ where: { id: existing.id }, data, include: { producer: true, _count: { select: { purchases: true } } } })
    : await db.product.create({
        data: { ...data, slug: await uniqueSlug(db, slugify(input.title), "product") },
        include: { producer: true, _count: { select: { purchases: true } } },
      });
  return toStaffProduct(row);
}

/** Ogni producer cura il proprio profilo (nome, bio, colore dei tag, Instagram). */
export async function saveProducerProfile(viewer: Viewer, raw: unknown): Promise<StaffProducer> {
  const input = parse(producerInputSchema, raw);
  if (!viewer.producerSlug) throw new StoreError("FORBIDDEN", "Questo account non è collegato a un profilo producer.");
  const row = await getDb().producer.update({
    where: { slug: viewer.producerSlug },
    data: { name: input.name, bio: input.bio || null, instagram: input.instagram || null, accentColor: input.accentColor },
  });
  return { slug: row.slug, name: row.name, bio: row.bio ?? "", instagram: row.instagram ?? "", accentColor: row.accentColor ?? "#8e8e95", linked: true };
}

/** Anteprima di qualunque beat (anche bozza o programmato), solo per lo staff. */
export async function staffPreviewKey(kind: "beat" | "product", id: string): Promise<string | null> {
  const db = getDb();
  if (kind === "beat") return (await db.beat.findUnique({ where: { id }, select: { previewObjectKey: true } }))?.previewObjectKey || null;
  return (await db.product.findUnique({ where: { id }, select: { previewObjectKey: true } }))?.previewObjectKey ?? null;
}
