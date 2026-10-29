/**
 * "Cerco feat" nel backend dimostrativo: annunci, chat e segnalazioni in memoria, con le stesse
 * regole del DB (autorizzazioni, limiti, scadenza a 30 giorni).
 *
 * SOLO DEMO: gli autori degli annunci di esempio sono finti e rispondono da soli una volta per
 * chat, dopo un paio di secondi (`DEMO_BOT_REPLIES`), così la bacheca sembra viva.
 * Nel backend Prisma questo non esiste: rispondono solo le persone vere.
 */
import { DEMO_GENRES } from "../demo-data";
import {
  FEAT_LIMITS,
  featAvatarColor,
  featExpiry,
  featMessageSchema,
  featPostSchema,
  featReportSchema,
  underLimit,
} from "../feat";
import type { FeatArtist, FeatMessageItem, FeatPostSummary, FeatThreadDetail, FeatThreadSummary } from "../types";
import type { StoreBackend } from "./backend";
import { DEMO_USER_ID, demoBeatById, toSummary } from "./demo-backend";
import { FEAT_ERRORS, featArtist, validate } from "./feat-common";
import { StoreError } from "./errors";

const HOUR = 3_600_000;

interface DemoFeatUser {
  name: string;
  color: string;
  /** Mesi da Resident → livello. */
  months: number;
}

/** Autori finti degli annunci di esempio (solo demo). */
const DEMO_BOTS: Record<string, DemoFeatUser> = {
  "demo-bot-nebbia": { name: "Nebbia", color: "#66666d", months: 7 },
  "demo-bot-tommy": { name: "Tommy K", color: "#c9c9ce", months: 2 },
  "demo-bot-sara": { name: "Sara V", color: "#8e8e95", months: 4 },
  "demo-bot-luce": { name: "Luce", color: "#2e2e33", months: 13 },
  "demo-bot-dama": { name: "Dama", color: "#e0306c", months: 1 },
  "demo-bot-rocco": { name: "Rocco 808", color: "#121214", months: 6 },
};

/** SOLO DEMO: risposte automatiche degli autori finti (dal prototipo). */
export const DEMO_BOT_REPLIES = [
  "Spacca! Mandami la tua strofa e ci lavoro stasera.",
  "Ci sto. Ti va di registrarla insieme al Backrooms?",
  "Ascoltata: la tua voce ci sta benissimo. Facciamola!",
  "Bella vibe. Ti giro il mio ritornello entro domani.",
];

const isBot = (id: string) => id in DEMO_BOTS;

function demoUser(id: string): DemoFeatUser {
  // Kael (l'utente dimostrativo) è Gold: 7 mesi da Resident, come in demo-backend.
  if (id === DEMO_USER_ID) return { name: "Kael", color: "#8e8e95", months: 7 };
  return DEMO_BOTS[id] ?? { name: "Artista", color: featAvatarColor(id), months: 0 };
}

const artistOf = (id: string): FeatArtist => {
  const u = demoUser(id);
  return featArtist(u.name, u.color, u.months);
};

interface DemoPost {
  id: string;
  authorId: string;
  role: string;
  text: string;
  beatId: string | null;
  genre: string | null;
  city: string | null;
  status: "OPEN" | "CLOSED";
  createdAt: number;
  expiresAt: number;
}

interface DemoThread {
  id: string;
  postId: string;
  applicantId: string;
  createdAt: number;
  updatedAt: number;
  /** SOLO DEMO: risposta automatica dell'autore finto, in arrivo a `at`. */
  botReply: { at: number; text: string } | null;
  botReplied: boolean;
}

interface DemoMessage {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: number;
  readAt: number | null;
}

export interface DemoFeatState {
  posts: DemoPost[];
  threads: DemoThread[];
  messages: DemoMessage[];
  reports: Array<{ id: string; reporterId: string; postId: string | null; messageId: string | null; reason: string; createdAt: number }>;
  seq: number;
}

/** I 6 annunci del prototipo, con qualche risposta tra autori finti per i contatori. */
export function initialFeatState(now: number): DemoFeatState {
  const seed: Array<[string, string, string, string, string, string, number]> = [
    ["demo-bot-nebbia", "feat", "rnb", "Vicenza", "ronzio", "Ho una strofa pronta su Ronzio, cerco una voce maschile per il ritornello. Vibe notturna, tipo The Weeknd.", 2],
    ["demo-bot-tommy", "strofa", "trap", "Padova", "cromo", "16 barre in 48 ore su qualsiasi beat trap. Ho già 3 pezzi su Spotify, flow alla Sfera.", 5],
    ["demo-bot-sara", "ritornello", "pop", "Verona", "pool-rooms", "Cerco una voce femminile per un ritornello estivo su Pool Rooms. Registriamo insieme al Backrooms?", 8],
    ["demo-bot-luce", "feat", "drill", "Milano", "corridoio", "UK drill sul 140, cerco chi spacca davvero. Pezzo diviso 50/50.", 20],
    ["demo-bot-dama", "produttore", "afro", "Vicenza", "fuori-orario", "Ho testo e melodia, cerco chi mi rifà Fuori Orario su misura per la mia voce.", 30],
    ["demo-bot-rocco", "strofa", "trap", "Treviso", "no-clip", "Rage e plugg, ad-lib e autotune spinto. Mandami il pezzo, ti rispondo in giornata.", 52],
  ];
  const posts: DemoPost[] = seed.map(([authorId, role, genre, city, beat, text, ago], i) => {
    const createdAt = now - ago * HOUR;
    return {
      id: `demo-feat-f${i + 1}`,
      authorId,
      role,
      text,
      beatId: `demo-${beat}`,
      genre,
      city,
      status: "OPEN",
      createdAt,
      expiresAt: featExpiry(new Date(createdAt)).getTime(),
    };
  });
  // Chat già avviate tra autori finti: nessuno le vede, contano solo nelle risposte.
  const replies: Array<[postIndex: number, applicantId: string, body: string]> = [
    [0, "demo-bot-rocco", "Ho un ritornello che ci sta a pennello, te lo mando."],
    [0, "demo-bot-tommy", "Se vuoi ci metto anche una strofa."],
    [2, "demo-bot-dama", "Ci sto! Quando registriamo?"],
    [3, "demo-bot-rocco", "140 è casa mia."],
  ];
  const threads: DemoThread[] = [];
  const messages: DemoMessage[] = [];
  replies.forEach(([index, applicantId, body], i) => {
    const at = posts[index].createdAt + HOUR / 2;
    threads.push({ id: `demo-feat-t${i + 1}`, postId: posts[index].id, applicantId, createdAt: at, updatedAt: at, botReply: null, botReplied: true });
    messages.push({ id: `demo-feat-m${i + 1}`, threadId: `demo-feat-t${i + 1}`, senderId: applicantId, body, createdAt: at, readAt: at });
  });
  return { posts, threads, messages, reports: [], seq: 100 };
}

const globalForFeat = globalThis as unknown as { beatsDemoFeat?: DemoFeatState };

function sharedState(): DemoFeatState {
  globalForFeat.beatsDemoFeat ??= initialFeatState(Date.now());
  return globalForFeat.beatsDemoFeat;
}

type FeatBackend = Pick<
  StoreBackend,
  "featPosts" | "createFeatPost" | "closeFeatPost" | "openFeatThread" | "featThread" | "sendFeatMessage" | "featInbox" | "reportFeat"
>;

export interface DemoFeatOptions {
  /** Stato isolato (test); di default quello condiviso del processo. */
  state?: DemoFeatState;
  now?: () => number;
  /** SOLO DEMO: ritardo della risposta automatica degli autori finti. */
  botDelayMs?: number;
}

export function createDemoFeat(options: DemoFeatOptions = {}): FeatBackend {
  const now = options.now ?? Date.now;
  const botDelayMs = options.botDelayMs ?? 2500;
  const st = () => options.state ?? sharedState();

  const nextId = (s: DemoFeatState, prefix: string) => `demo-feat-${prefix}${++s.seq}`;
  const postOf = (s: DemoFeatState, id: string) => s.posts.find((p) => p.id === id);
  const messagesOf = (s: DemoFeatState, threadId: string) =>
    s.messages.filter((m) => m.threadId === threadId).sort((a, b) => a.createdAt - b.createdAt);
  const isParticipant = (s: DemoFeatState, t: DemoThread, userId: string) =>
    t.applicantId === userId || postOf(s, t.postId)?.authorId === userId;

  /** SOLO DEMO: consegna le risposte automatiche arrivate a scadenza. */
  function deliverBotReplies(s: DemoFeatState, at: number) {
    for (const t of s.threads) {
      if (!t.botReply || t.botReply.at > at) continue;
      const author = postOf(s, t.postId)!.authorId;
      s.messages.push({ id: nextId(s, "m"), threadId: t.id, senderId: author, body: t.botReply.text, createdAt: t.botReply.at, readAt: null });
      t.updatedAt = t.botReply.at;
      t.botReply = null;
      t.botReplied = true;
    }
  }

  function toMessage(m: DemoMessage, userId: string): FeatMessageItem {
    return {
      id: m.id,
      body: m.body,
      mine: m.senderId === userId,
      createdAt: new Date(m.createdAt).toISOString(),
      readAt: m.readAt ? new Date(m.readAt).toISOString() : null,
    };
  }

  function toPost(s: DemoFeatState, p: DemoPost, viewerId: string | null): FeatPostSummary {
    const beat = p.beatId ? demoBeatById(p.beatId) : undefined;
    const genre = p.genre ? DEMO_GENRES.find((g) => g.slug === p.genre) : undefined;
    const threads = s.threads.filter((t) => t.postId === p.id);
    return {
      id: p.id,
      role: p.role,
      text: p.text,
      genre: p.genre ? { slug: p.genre, name: genre?.name ?? p.genre } : null,
      city: p.city,
      beat: beat ? toSummary(beat) : null,
      status: p.status,
      createdAt: new Date(p.createdAt).toISOString(),
      expiresAt: new Date(p.expiresAt).toISOString(),
      author: artistOf(p.authorId),
      isMine: viewerId === p.authorId,
      replyCount: threads.filter((t) => s.messages.some((m) => m.threadId === t.id)).length,
      threadId: (viewerId && threads.find((t) => t.applicantId === viewerId)?.id) || null,
    };
  }

  function toThread(s: DemoFeatState, t: DemoThread, userId: string): FeatThreadSummary {
    const p = postOf(s, t.postId)!;
    const isAuthor = p.authorId === userId;
    const msgs = messagesOf(s, t.id);
    const last = msgs.at(-1);
    return {
      id: t.id,
      post: { id: p.id, role: p.role, text: p.text, status: p.status, beatTitle: (p.beatId && demoBeatById(p.beatId)?.title) || null },
      other: artistOf(isAuthor ? t.applicantId : p.authorId),
      isAuthor,
      last: last ? toMessage(last, userId) : null,
      unread: msgs.filter((m) => m.senderId !== userId && !m.readAt).length,
      updatedAt: new Date(t.updatedAt).toISOString(),
    };
  }

  function detail(s: DemoFeatState, t: DemoThread, userId: string): FeatThreadDetail {
    return { ...toThread(s, t, userId), messages: messagesOf(s, t.id).map((m) => toMessage(m, userId)) };
  }

  function participantThread(s: DemoFeatState, userId: string, threadId: string): DemoThread {
    const t = s.threads.find((x) => x.id === threadId);
    // Chi non partecipa riceve "non trovata": non sa nemmeno che la chat esiste.
    if (!t || !isParticipant(s, t, userId)) throw FEAT_ERRORS.threadNotFound();
    return t;
  }

  return {
    async featPosts(viewerId, filters = {}) {
      const s = st();
      const at = now();
      deliverBotReplies(s, at);
      return s.posts
        .filter((p) => p.expiresAt > at && (p.status === "OPEN" || p.authorId === viewerId))
        .filter((p) => (!filters.role || p.role === filters.role) && (!filters.genre || p.genre === filters.genre))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p) => toPost(s, p, viewerId));
    },

    async createFeatPost(userId, raw) {
      const s = st();
      const at = now();
      const input = validate(featPostSchema, raw);
      const mine = s.posts.filter((p) => p.authorId === userId).map((p) => p.createdAt);
      if (!underLimit(mine, FEAT_LIMITS.posts, at)) throw new StoreError("RATE_LIMITED", FEAT_LIMITS.posts.message);
      if (input.genre && !DEMO_GENRES.some((g) => g.slug === input.genre)) throw FEAT_ERRORS.badGenre();
      if (input.beatId && !demoBeatById(input.beatId)) throw FEAT_ERRORS.badBeat();
      const post: DemoPost = {
        id: nextId(s, "p"),
        authorId: userId,
        role: input.role,
        text: input.text,
        beatId: input.beatId ?? null,
        genre: input.genre ?? null,
        city: input.city ?? null,
        status: "OPEN",
        createdAt: at,
        expiresAt: featExpiry(new Date(at)).getTime(),
      };
      s.posts.push(post);
      return toPost(s, post, userId);
    },

    async closeFeatPost(userId, postId) {
      const s = st();
      const p = postOf(s, postId);
      if (!p) throw FEAT_ERRORS.postNotFound();
      if (p.authorId !== userId) throw FEAT_ERRORS.notAuthor();
      p.status = "CLOSED";
      return toPost(s, p, userId);
    },

    async openFeatThread(userId, postId) {
      const s = st();
      const at = now();
      deliverBotReplies(s, at);
      const p = postOf(s, postId);
      if (!p) throw FEAT_ERRORS.postNotFound();
      if (p.authorId === userId) throw FEAT_ERRORS.ownPost();
      let t = s.threads.find((x) => x.postId === postId && x.applicantId === userId);
      if (!t) {
        if (p.status !== "OPEN" || p.expiresAt <= at) throw FEAT_ERRORS.closed();
        t = { id: nextId(s, "t"), postId, applicantId: userId, createdAt: at, updatedAt: at, botReply: null, botReplied: false };
        s.threads.push(t);
      }
      return detail(s, t, userId);
    },

    async featThread(userId, threadId) {
      const s = st();
      const at = now();
      deliverBotReplies(s, at);
      const t = participantThread(s, userId, threadId);
      for (const m of s.messages) if (m.threadId === t.id && m.senderId !== userId && !m.readAt) m.readAt = at;
      return detail(s, t, userId);
    },

    async sendFeatMessage(userId, threadId, raw) {
      const s = st();
      const at = now();
      const { body } = validate(featMessageSchema, { body: raw });
      deliverBotReplies(s, at);
      const t = participantThread(s, userId, threadId);
      const sent = s.messages.filter((m) => m.senderId === userId).map((m) => m.createdAt);
      if (!underLimit(sent, FEAT_LIMITS.messages, at)) throw new StoreError("RATE_LIMITED", FEAT_LIMITS.messages.message);
      const message: DemoMessage = { id: nextId(s, "m"), threadId: t.id, senderId: userId, body, createdAt: at, readAt: null };
      s.messages.push(message);
      t.updatedAt = at;
      // SOLO DEMO: l'autore finto risponde una volta, dopo poco.
      const author = postOf(s, t.postId)!.authorId;
      if (isBot(author) && userId === t.applicantId && !t.botReplied && !t.botReply) {
        const n = s.threads.filter((x) => x.botReplied && x.applicantId === userId).length;
        t.botReply = { at: at + botDelayMs, text: DEMO_BOT_REPLIES[n % DEMO_BOT_REPLIES.length] };
      }
      return toMessage(message, userId);
    },

    async featInbox(userId) {
      const s = st();
      deliverBotReplies(s, now());
      const threads = s.threads
        .filter((t) => isParticipant(s, t, userId) && s.messages.some((m) => m.threadId === t.id))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((t) => toThread(s, t, userId));
      return { threads, unread: threads.reduce((sum, t) => sum + t.unread, 0) };
    },

    async reportFeat(userId, raw) {
      const s = st();
      const input = validate(featReportSchema, raw);
      if (input.postId && !postOf(s, input.postId)) throw FEAT_ERRORS.postNotFound();
      if (input.messageId) {
        const m = s.messages.find((x) => x.id === input.messageId);
        const t = m && s.threads.find((x) => x.id === m.threadId);
        if (!t || !isParticipant(s, t, userId)) throw new StoreError("NOT_FOUND", "Messaggio non trovato.");
      }
      const postId = input.postId ?? null;
      const messageId = input.messageId ?? null;
      if (s.reports.some((r) => r.reporterId === userId && r.postId === postId && r.messageId === messageId)) return;
      s.reports.push({ id: nextId(s, "r"), reporterId: userId, postId, messageId, reason: input.reason, createdAt: now() });
    },
  };
}
