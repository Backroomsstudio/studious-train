import { Prisma } from "@/lib/generated/prisma/client";
import { isSimilar, keysForFilter, paginate, sortBeats } from "../catalog-utils";
import { BPM_RANGE, PAGE_SIZE, type BeatFilters } from "../filters";
import { LICENSES, licenseIncludesAsset, type DownloadAsset, type LicenseType } from "../licenses";
import { compatibleKeys } from "../music";
import type { BeatDetail, BeatSummary, CustomizationSummary, Facets, ProjectSummary, Viewer } from "../types";
import { NEW_WINDOW_DAYS } from "../drops";
import type { FileTarget, StoreBackend } from "./backend";
import { StoreError } from "./errors";
import { levelInfo } from "../offers";
import { ensureReferralCode, residentMonths } from "./commerce";
import { activeTier, requestCustomization, unlockWithCredits } from "./ledger";
import { getDb } from "./prisma";
import { createPrismaCommerce } from "./prisma-commerce";
import { createPrismaFeat } from "./prisma-feat";

export const beatInclude = (now: Date) =>
  ({
    producers: { include: { producer: true }, orderBy: { role: "asc" } },
    genres: { include: { parent: { select: { slug: true } } } },
    typeTags: true,
    deals: { where: { startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { endsAt: "asc" }, take: 1 },
  }) satisfies Prisma.BeatInclude;

type BeatRow = Prisma.BeatGetPayload<{ include: ReturnType<typeof beatInclude> }>;

export function toSummary(row: BeatRow): BeatSummary {
  const deal = row.deals[0];
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    bpm: row.bpm,
    key: { root: row.keyRoot, mode: row.keyMode },
    durationSec: row.durationSec,
    coverUrl: row.coverUrl,
    peaks: Array.isArray(row.waveformPeaks) ? (row.waveformPeaks as number[]) : [],
    producers: row.producers.map((p) => ({
      slug: p.producer.slug,
      name: p.producer.name,
      role: p.role,
      accentColor: p.producer.accentColor,
    })),
    genres: row.genres.map((g) => ({ slug: g.slug, name: g.name, parent: g.parent?.slug ?? null })),
    typeTags: row.typeTags.map((t) => ({ slug: t.slug, name: t.name })),
    moods: row.moods,
    releasedAt: row.releasedAt.toISOString(),
    isCollab: row.producers.length > 1,
    hasStems: Boolean(row.stemsObjectKey),
    deal: deal ? { discountPct: deal.discountPct, endsAt: deal.endsAt.toISOString() } : null,
  };
}

function whereFor(f: BeatFilters): Prisma.BeatWhereInput {
  const and: Prisma.BeatWhereInput[] = [{ status: "PUBLISHED" }];
  if (f.bpmMin !== BPM_RANGE.min || f.bpmMax !== BPM_RANGE.max) and.push({ bpm: { gte: f.bpmMin, lte: f.bpmMax } });
  if (f.producers.length) and.push({ producers: { some: { producer: { slug: { in: f.producers } } } } });
  if (f.collab === "only") and.push({ producers: { some: { role: "CO_PRODUCER" } } });
  if (f.collab === "exclude") and.push({ producers: { none: { role: "CO_PRODUCER" } } });
  if (f.genres.length) {
    and.push({ genres: { some: { OR: [{ slug: { in: f.genres } }, { parent: { slug: { in: f.genres } } }] } } });
  }
  if (f.types.length) and.push({ typeTags: { some: { slug: { in: f.types } } } });
  const keys = keysForFilter(f);
  if (keys) and.push({ OR: keys.map((k) => ({ keyRoot: k.root, keyMode: k.mode })) });
  return { AND: and };
}

/**
 * Full-text con prefissi ("lev" trova "Level 0") + fuzzy a trigrammi per i refusi ("frya").
 * Restituisce gli id ordinati per pertinenza (al massimo 500).
 */
async function rankedIds(q: string): Promise<string[]> {
  const terms = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 8);
  if (!terms.length) return [];
  const tsQuery = terms.map((t) => `${t}:*`).join(" & ");
  const plain = terms.join(" ");
  const rows = await getDb().$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Beat"
    WHERE "status" = 'PUBLISHED'
      AND ("searchVector" @@ to_tsquery('simple', ${tsQuery}) OR word_similarity(${plain}, "searchDocument") > 0.35)
    ORDER BY ts_rank("searchVector", to_tsquery('simple', ${tsQuery})) + word_similarity(${plain}, "searchDocument") DESC
    LIMIT 500`;
  return rows.map((r) => r.id);
}

const ASSET_COLUMNS = { MP3: "mp3ObjectKey", WAV: "wavObjectKey", STEMS: "stemsObjectKey" } as const satisfies Record<
  DownloadAsset,
  string
>;

const CONTENT_TYPES: Record<DownloadAsset, string> = { MP3: "audio/mpeg", WAV: "audio/wav", STEMS: "application/zip" };
const EXTENSIONS: Record<DownloadAsset, string> = { MP3: "mp3", WAV: "wav", STEMS: "zip" };

type CustomizationRow = Prisma.CustomizationRequestGetPayload<{
  include: { beat: { include: { producers: { include: { producer: true } } } } };
}>;

function toCustomization(row: CustomizationRow): CustomizationSummary {
  return {
    id: row.id,
    beat: {
      id: row.beat.id,
      slug: row.beat.slug,
      title: row.beat.title,
      coverUrl: row.beat.coverUrl,
      producers: row.beat.producers.map((p) => ({
        slug: p.producer.slug,
        name: p.producer.name,
        role: p.role,
        accentColor: p.producer.accentColor,
      })),
    },
    options: row.options,
    express: row.express,
    notes: row.notes,
    creditsSpent: row.creditsSpent,
    status: row.status,
    dueAt: row.dueAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

const customizationInclude = { beat: { include: { producers: { include: { producer: true } } } } } as const;

export function createPrismaBackend(): StoreBackend {
  const db = getDb();

  return {
    ...createPrismaCommerce(),
    ...createPrismaFeat(),

    async search(filters) {
      const now = new Date();
      const where = whereFor(filters);
      if (filters.q) {
        const ids = await rankedIds(filters.q);
        if (!ids.length) return { items: [], total: 0, page: 1, pageCount: 1 };
        const rows = await db.beat.findMany({ where: { AND: [where, { id: { in: ids } }] }, include: beatInclude(now) });
        const order = new Map(ids.map((id, i) => [id, i]));
        const byRelevance = rows.map(toSummary).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
        const playsById = new Map(rows.map((r) => [r.id, r.playCount]));
        return paginate(sortBeats(byRelevance, filters.sort, (b) => playsById.get(b.id) ?? 0), filters.page);
      }

      const orderBy: Prisma.BeatOrderByWithRelationInput[] =
        filters.sort === "popular"
          ? [{ playCount: "desc" }]
          : filters.sort === "bpm_asc"
            ? [{ bpm: "asc" }]
            : filters.sort === "bpm_desc"
              ? [{ bpm: "desc" }]
              : [{ releasedAt: "desc" }];
      const [total, rows] = await Promise.all([
        db.beat.count({ where }),
        db.beat.findMany({
          where,
          include: beatInclude(now),
          orderBy: [...orderBy, { id: "asc" }],
          skip: (filters.page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
      ]);
      return { items: rows.map(toSummary), total, page: filters.page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
    },

    async facets(): Promise<Facets> {
      const published = { status: "PUBLISHED" } as const;
      const [producers, genres, typeTags, bpm] = await Promise.all([
        db.producer.findMany({
          include: { _count: { select: { beats: { where: { beat: published } } } } },
          orderBy: [{ isResident: "desc" }, { name: "asc" }],
        }),
        db.genre.findMany({ include: { parent: true, _count: { select: { beats: { where: published } } } }, orderBy: { name: "asc" } }),
        db.typeTag.findMany({ include: { _count: { select: { beats: { where: published } } } }, orderBy: { name: "asc" } }),
        db.beat.aggregate({ where: published, _min: { bpm: true }, _max: { bpm: true } }),
      ]);
      return {
        producers: producers.map((p) => ({
          slug: p.slug,
          name: p.name,
          isResident: p.isResident,
          accentColor: p.accentColor,
          count: p._count.beats,
        })),
        genres: genres.map((g) => ({ slug: g.slug, name: g.name, parent: g.parent?.slug ?? null, count: g._count.beats })),
        typeTags: typeTags.filter((t) => t._count.beats > 0).map((t) => ({ slug: t.slug, name: t.name, count: t._count.beats })),
        bpm: { min: bpm._min.bpm ?? BPM_RANGE.min, max: bpm._max.bpm ?? BPM_RANGE.max },
      };
    },

    async beatBySlug(slug): Promise<BeatDetail | null> {
      const row = await db.beat.findFirst({ where: { slug, status: "PUBLISHED" }, include: beatInclude(new Date()) });
      if (!row) return null;
      return {
        ...toSummary(row),
        description: row.description,
        exclusiveAvailable: row.exclusiveAvailable && !row.exclusiveSoldAt,
      };
    },

    async beatOfTheDay(now = new Date()) {
      const deal = await db.dailyDeal.findFirst({
        where: { startsAt: { lte: now }, endsAt: { gt: now }, beat: { status: "PUBLISHED" } },
        orderBy: { endsAt: "asc" },
        include: { beat: { include: beatInclude(now) } },
      });
      return deal ? toSummary(deal.beat) : null;
    },

    async similar(base, limit = 6) {
      const rows = await db.beat.findMany({
        where: {
          status: "PUBLISHED",
          id: { not: base.id },
          bpm: { gte: Math.floor(base.bpm * 0.9), lte: Math.ceil(base.bpm * 1.1) },
          OR: compatibleKeys(base.key).map((k) => ({ keyRoot: k.root, keyMode: k.mode })),
        },
        include: beatInclude(new Date()),
        orderBy: { playCount: "desc" },
        take: limit,
      });
      return rows.map(toSummary).filter((b) => isSimilar(base, b));
    },

    async viewer(userId): Promise<Viewer | null> {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          licenses: { where: { status: "ACTIVE" }, select: { beatId: true, type: true } },
          subscriptions: { orderBy: { currentPeriodEnd: "desc" }, take: 1 },
        },
      });
      if (!user) return null;
      const sub = user.subscriptions[0];
      const [tier, months, referralCode] = await Promise.all([
        activeTier(db, userId),
        residentMonths(db, userId),
        user.referralCode ?? ensureReferralCode(db, userId, user.artistName ?? user.name),
      ]);
      const owned: Record<string, LicenseType[]> = {};
      for (const l of user.licenses) (owned[l.beatId] ??= []).push(l.type);
      return {
        id: user.id,
        name: user.name ?? user.email ?? "Artista",
        artistName: user.artistName,
        image: user.image,
        creditBalance: user.creditBalance + user.walletCredits,
        credits: { subscription: user.creditBalance, wallet: user.walletCredits },
        level: levelInfo(months),
        referralCode,
        plan:
          sub && tier
            ? {
                tier,
                interval: sub.interval,
                status: sub.status,
                renewsAt: sub.currentPeriodEnd.toISOString(),
                cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
                pausedUntil: sub.pausedUntil && sub.pausedUntil > new Date() ? sub.pausedUntil.toISOString() : null,
              }
            : null,
        owned,
      };
    },

    async projects(userId): Promise<ProjectSummary[]> {
      const rows = await db.project.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 5 });
      return rows.map((p) => ({
        id: p.id,
        title: p.title,
        summary: p.summary,
        status: p.status,
        dueAt: p.dueAt?.toISOString() ?? null,
      }));
    },

    async library(userId) {
      const rows = await db.license.findMany({
        where: { userId, status: "ACTIVE" },
        include: { beat: { include: beatInclude(new Date()) } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((l) => ({
        license: { id: l.id, beatId: l.beatId, type: l.type, creditsSpent: l.creditsSpent, createdAt: l.createdAt.toISOString() },
        beat: toSummary(l.beat),
      }));
    },

    async ledger(userId, limit = 20) {
      const rows = await db.creditTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
      return rows.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      }));
    },

    async unlock(userId, beatId, license) {
      const result = await unlockWithCredits(db, { userId, beatId, license });
      return {
        license: { id: result.licenseId, beatId, type: result.type, createdAt: result.createdAt.toISOString() },
        balance: result.balance,
        alreadyOwned: result.alreadyOwned,
      };
    },

    async resolveDownload(userId, licenseId, asset, meta): Promise<FileTarget> {
      const license = await db.license.findFirst({
        where: { id: licenseId, userId },
        include: { beat: { select: { id: true, slug: true, title: true, mp3ObjectKey: true, wavObjectKey: true, stemsObjectKey: true } } },
      });
      if (!license) throw new StoreError("NOT_FOUND", "Licenza non trovata.");
      if (license.status !== "ACTIVE") throw new StoreError("LICENSE_REVOKED");
      if (!licenseIncludesAsset(license.type, asset)) throw new StoreError("PLAN_REQUIRED", "File non incluso nella licenza.");
      const objectKey = license.beat[ASSET_COLUMNS[asset]];
      if (!objectKey) throw new StoreError("NOT_FOUND", "File non disponibile per questo beat.");

      await db.$transaction([
        db.download.create({ data: { userId, licenseId, asset, ipHash: meta.ipHash, userAgent: meta.userAgent?.slice(0, 200) } }),
        db.beat.update({ where: { id: license.beat.id }, data: { downloadCount: { increment: 1 } } }),
      ]);
      return {
        kind: "r2",
        objectKey,
        contentType: CONTENT_TYPES[asset],
        filename: `${license.beat.title} - Backrooms (${LICENSES[license.type].name}).${EXTENSIONS[asset]}`,
      };
    },

    async newArrivals(limit = 12) {
      const now = new Date();
      const rows = await db.beat.findMany({
        where: { status: "PUBLISHED", releasedAt: { gte: new Date(now.getTime() - NEW_WINDOW_DAYS * 86_400_000), lte: now } },
        include: beatInclude(now),
        orderBy: { releasedAt: "desc" },
        take: limit,
      });
      return rows.map(toSummary);
    },

    async customize(userId, beatId, input) {
      const { request, balance } = await requestCustomization(db, { userId, beatId, ...input });
      const row = await db.customizationRequest.findUniqueOrThrow({ where: { id: request.id }, include: customizationInclude });
      return { request: toCustomization(row), balance };
    },

    async customizations(userId) {
      const rows = await db.customizationRequest.findMany({
        where: { userId },
        include: customizationInclude,
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return rows.map(toCustomization);
    },

    async preview(beatId) {
      const beat = await db.beat.findFirst({ where: { id: beatId, status: "PUBLISHED" }, select: { previewObjectKey: true, slug: true } });
      if (!beat) return null;
      // Conteggio ascolti senza bloccare la risposta.
      void db.beat.update({ where: { id: beatId }, data: { playCount: { increment: 1 } } }).catch(() => undefined);
      return { kind: "r2", objectKey: beat.previewObjectKey, contentType: "audio/mpeg", filename: `${beat.slug}-preview.mp3` };
    },

    async stemPreview(beatId, stem) {
      const beat = await db.beat.findFirst({
        where: { id: beatId, status: "PUBLISHED" },
        select: { slug: true, stemsObjectKey: true, stemPreviewPrefix: true },
      });
      // Anteprime degli stems generate all'upload in `${prefix}/${stem}.mp3`, accanto all'anteprima.
      if (!beat?.stemsObjectKey || !beat.stemPreviewPrefix) return null;
      return {
        kind: "r2",
        objectKey: `${beat.stemPreviewPrefix}/${stem}.mp3`,
        contentType: "audio/mpeg",
        filename: `${beat.slug}-${stem}.mp3`,
      };
    },
  };
}
