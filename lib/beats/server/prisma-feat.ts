/**
 * "Cerco feat" sul database: annunci, chat private e segnalazioni.
 * Autorizzazioni: le chat le leggono solo i due partecipanti (agli altri risultano "non trovate"),
 * solo l'autore chiude l'annuncio. I limiti si contano sulle righe salvate, quindi valgono
 * anche con più istanze serverless.
 */
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  FEAT_LIMITS,
  featAvatarColor,
  featExpiry,
  featMessageSchema,
  featPostSchema,
  featReportSchema,
} from "../feat";
import type { FeatArtist, FeatMessageItem, FeatPostSummary, FeatThreadDetail, FeatThreadSummary } from "../types";
import type { StoreBackend } from "./backend";
import { FEAT_ERRORS, featArtist, validate } from "./feat-common";
import { StoreError } from "./errors";
import { getDb } from "./prisma";
import { beatInclude, toSummary } from "./prisma-backend";

type FeatBackend = Pick<
  StoreBackend,
  "featPosts" | "createFeatPost" | "closeFeatPost" | "openFeatThread" | "featThread" | "sendFeatMessage" | "featInbox" | "reportFeat"
>;

type Db = ReturnType<typeof getDb>;

const userSelect = { id: true, artistName: true, name: true } satisfies Prisma.UserSelect;
type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

const artistName = (u: UserRow) => u.artistName ?? u.name?.split(" ")[0] ?? "Artista";

/** Mesi da Resident di più artisti in una sola query (stessa regola di `residentMonths`). */
async function monthsOf(db: Db, ids: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const rows = await db.creditTransaction.groupBy({
    by: ["userId"],
    where: { userId: { in: unique }, type: "SUBSCRIPTION_GRANT", idempotencyKey: { startsWith: "grant:" } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.userId, r._count._all]));
}

const toArtist = (u: UserRow, months: Map<string, number>): FeatArtist =>
  featArtist(artistName(u), featAvatarColor(u.id), months.get(u.id) ?? 0);

const toMessage = (m: { id: string; body: string; senderId: string; createdAt: Date; readAt: Date | null }, userId: string): FeatMessageItem => ({
  id: m.id,
  body: m.body,
  mine: m.senderId === userId,
  createdAt: m.createdAt.toISOString(),
  readAt: m.readAt?.toISOString() ?? null,
});

const postInclude = (now: Date, viewerId: string | null) =>
  ({
    author: { select: userSelect },
    beat: { include: beatInclude(now) },
    // Risposte = chat con almeno un messaggio (aprire la chat senza scrivere non conta).
    _count: { select: { threads: { where: { messages: { some: {} } } } } },
    threads: { where: { applicantId: viewerId ?? "" }, select: { id: true } },
  }) satisfies Prisma.FeatPostInclude;

type PostRow = Prisma.FeatPostGetPayload<{ include: ReturnType<typeof postInclude> }>;

const threadInclude = (userId: string) =>
  ({
    post: { select: { id: true, role: true, text: true, status: true, authorId: true, author: { select: userSelect }, beat: { select: { title: true } } } },
    applicant: { select: userSelect },
    messages: { orderBy: { createdAt: "desc" }, take: 1 },
    _count: { select: { messages: { where: { senderId: { not: userId }, readAt: null } } } },
  }) satisfies Prisma.FeatThreadInclude;

type ThreadRow = Prisma.FeatThreadGetPayload<{ include: ReturnType<typeof threadInclude> }>;

export function createPrismaFeat(): FeatBackend {
  const db = getDb();

  async function toPosts(rows: PostRow[], viewerId: string | null): Promise<FeatPostSummary[]> {
    const months = await monthsOf(db, rows.map((r) => r.authorId));
    const slugs = [...new Set(rows.map((r) => r.genre).filter((g): g is string => Boolean(g)))];
    const genres = slugs.length ? await db.genre.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } }) : [];
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      text: r.text,
      genre: r.genre ? { slug: r.genre, name: genres.find((g) => g.slug === r.genre)?.name ?? r.genre } : null,
      city: r.city,
      beat: r.beat && r.beat.status === "PUBLISHED" ? toSummary(r.beat) : null,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      author: toArtist(r.author, months),
      isMine: r.authorId === viewerId,
      replyCount: r._count.threads,
      threadId: r.threads[0]?.id ?? null,
    }));
  }

  async function loadPost(id: string, viewerId: string | null): Promise<FeatPostSummary> {
    const row = await db.featPost.findUnique({ where: { id }, include: postInclude(new Date(), viewerId) });
    if (!row) throw FEAT_ERRORS.postNotFound();
    return (await toPosts([row], viewerId))[0];
  }

  async function toThreads(rows: ThreadRow[], userId: string): Promise<FeatThreadSummary[]> {
    const months = await monthsOf(db, rows.flatMap((t) => [t.applicantId, t.post.authorId]));
    return rows.map((t) => {
      const isAuthor = t.post.authorId === userId;
      const last = t.messages[0];
      return {
        id: t.id,
        post: { id: t.post.id, role: t.post.role, text: t.post.text, status: t.post.status, beatTitle: t.post.beat?.title ?? null },
        other: toArtist(isAuthor ? t.applicant : t.post.author, months),
        isAuthor,
        last: last ? toMessage(last, userId) : null,
        unread: t._count.messages,
        updatedAt: t.updatedAt.toISOString(),
      };
    });
  }

  /** La chat, solo se l'utente è uno dei due partecipanti. */
  async function participantThread(userId: string, threadId: string): Promise<ThreadRow> {
    const t = await db.featThread.findFirst({
      where: { id: threadId, OR: [{ applicantId: userId }, { post: { authorId: userId } }] },
      include: threadInclude(userId),
    });
    if (!t) throw FEAT_ERRORS.threadNotFound();
    return t;
  }

  async function detail(userId: string, threadId: string): Promise<FeatThreadDetail> {
    const t = await participantThread(userId, threadId);
    const messages = await db.featMessage.findMany({ where: { threadId }, orderBy: { createdAt: "desc" }, take: 200 });
    const [summary] = await toThreads([t], userId);
    return { ...summary, messages: messages.reverse().map((m) => toMessage(m, userId)) };
  }

  return {
    async featPosts(viewerId, filters = {}) {
      const now = new Date();
      const visible: Prisma.FeatPostWhereInput = viewerId
        ? { expiresAt: { gt: now }, OR: [{ status: "OPEN" }, { authorId: viewerId }] }
        : { expiresAt: { gt: now }, status: "OPEN" };
      const rows = await db.featPost.findMany({
        where: { AND: [visible, filters.role ? { role: filters.role } : {}, filters.genre ? { genre: filters.genre } : {}] },
        include: postInclude(now, viewerId),
        orderBy: { createdAt: "desc" },
        take: 60,
      });
      return toPosts(rows, viewerId);
    },

    async createFeatPost(userId, raw) {
      const input = validate(featPostSchema, raw);
      const now = new Date();
      const recent = await db.featPost.count({
        where: { authorId: userId, createdAt: { gt: new Date(now.getTime() - FEAT_LIMITS.posts.windowMs) } },
      });
      if (recent >= FEAT_LIMITS.posts.max) throw new StoreError("RATE_LIMITED", FEAT_LIMITS.posts.message);
      if (input.genre && !(await db.genre.findUnique({ where: { slug: input.genre }, select: { id: true } }))) throw FEAT_ERRORS.badGenre();
      if (input.beatId && !(await db.beat.findFirst({ where: { id: input.beatId, status: "PUBLISHED" }, select: { id: true } }))) {
        throw FEAT_ERRORS.badBeat();
      }
      const post = await db.featPost.create({
        data: {
          authorId: userId,
          role: input.role,
          text: input.text,
          genre: input.genre ?? null,
          city: input.city ?? null,
          beatId: input.beatId ?? null,
          createdAt: now,
          expiresAt: featExpiry(now),
        },
        select: { id: true },
      });
      return loadPost(post.id, userId);
    },

    async closeFeatPost(userId, postId) {
      const post = await db.featPost.findUnique({ where: { id: postId }, select: { authorId: true, status: true } });
      if (!post) throw FEAT_ERRORS.postNotFound();
      if (post.authorId !== userId) throw FEAT_ERRORS.notAuthor();
      if (post.status === "OPEN") {
        await db.featPost.update({ where: { id: postId }, data: { status: "CLOSED", closedAt: new Date() } });
      }
      return loadPost(postId, userId);
    },

    async openFeatThread(userId, postId) {
      const post = await db.featPost.findUnique({ where: { id: postId }, select: { authorId: true, status: true, expiresAt: true } });
      if (!post) throw FEAT_ERRORS.postNotFound();
      if (post.authorId === userId) throw FEAT_ERRORS.ownPost();
      const existing = await db.featThread.findUnique({ where: { postId_applicantId: { postId, applicantId: userId } }, select: { id: true } });
      if (existing) return detail(userId, existing.id);
      if (post.status !== "OPEN" || post.expiresAt <= new Date()) throw FEAT_ERRORS.closed();
      // upsert sulla chiave unica: due clic ravvicinati non creano due chat.
      const thread = await db.featThread.upsert({
        where: { postId_applicantId: { postId, applicantId: userId } },
        create: { postId, applicantId: userId },
        update: {},
        select: { id: true },
      });
      return detail(userId, thread.id);
    },

    async featThread(userId, threadId) {
      await participantThread(userId, threadId);
      await db.featMessage.updateMany({ where: { threadId, senderId: { not: userId }, readAt: null }, data: { readAt: new Date() } });
      return detail(userId, threadId);
    },

    async sendFeatMessage(userId, threadId, raw) {
      const { body } = validate(featMessageSchema, { body: raw });
      await participantThread(userId, threadId);
      const now = new Date();
      const recent = await db.featMessage.count({
        where: { senderId: userId, createdAt: { gt: new Date(now.getTime() - FEAT_LIMITS.messages.windowMs) } },
      });
      if (recent >= FEAT_LIMITS.messages.max) throw new StoreError("RATE_LIMITED", FEAT_LIMITS.messages.message);
      const [message] = await db.$transaction([
        db.featMessage.create({ data: { threadId, senderId: userId, body, createdAt: now } }),
        db.featThread.update({ where: { id: threadId }, data: { updatedAt: now } }),
      ]);
      return toMessage(message, userId);
    },

    async featInbox(userId) {
      const rows = await db.featThread.findMany({
        where: { OR: [{ applicantId: userId }, { post: { authorId: userId } }], messages: { some: {} } },
        include: threadInclude(userId),
        orderBy: { updatedAt: "desc" },
        take: 50,
      });
      const threads = await toThreads(rows, userId);
      return { threads, unread: threads.reduce((sum, t) => sum + t.unread, 0) };
    },

    async reportFeat(userId, raw) {
      const input = validate(featReportSchema, raw);
      if (input.postId && !(await db.featPost.findUnique({ where: { id: input.postId }, select: { id: true } }))) {
        throw FEAT_ERRORS.postNotFound();
      }
      if (input.messageId) {
        const visible = await db.featMessage.findFirst({
          where: { id: input.messageId, thread: { OR: [{ applicantId: userId }, { post: { authorId: userId } }] } },
          select: { id: true },
        });
        if (!visible) throw new StoreError("NOT_FOUND", "Messaggio non trovato.");
      }
      const target = { postId: input.postId ?? null, messageId: input.messageId ?? null };
      // Una segnalazione per persona e contenuto: ripetere non aggiunge righe.
      if (await db.featReport.findFirst({ where: { reporterId: userId, ...target }, select: { id: true } })) return;
      await db.featReport.create({ data: { reporterId: userId, reason: input.reason, ...target } });
    },
  };
}
