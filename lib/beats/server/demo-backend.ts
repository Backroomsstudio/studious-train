/**
 * Backend dimostrativo in memoria. Lo stato (saldo, licenze) vive nel processo del server:
 * si azzera al riavvio e non è condiviso tra istanze serverless. Serve per sviluppo e anteprime.
 */
import { isSimilar, keysForFilter, paginate, sortBeats } from "../catalog-utils";
import {
  DEMO_BEATS,
  DEMO_DEAL,
  DEMO_GENRES,
  DEMO_PRODUCERS,
  DEMO_TYPE_TAGS,
  searchDocumentFor,
  type DemoBeat,
} from "../demo-data";
import { BPM_RANGE, type BeatFilters } from "../filters";
import { fuzzyScore } from "../fuzzy";
import { checkUnlock, planCycleGrant } from "../ledger-rules";
import { LICENSES, licenseIncludesAsset, type LicenseType } from "../licenses";
import { keyId } from "../music";
import type { PlanTier } from "../plans";
import {
  CUSTOMIZATION_MAX_OPEN,
  customizationCost,
  customizationDueDate,
} from "../customizations";
import { NEW_WINDOW_DAYS } from "../drops";
import type { BeatDetail, BeatSummary, CustomizationSummary, Facets, OwnedLicense, ProjectSummary } from "../types";
import type { LedgerEntry, StoreBackend } from "./backend";
import { StoreError } from "./errors";

export const DEMO_USER_ID = "demo-kael";
const DEMO_TIER: PlanTier = "ELITE";
const DAY = 86_400_000;

interface DemoState {
  balance: number;
  licenses: Array<OwnedLicense & { creditsSpent: number }>;
  ledger: LedgerEntry[];
  customizations: CustomizationSummary[];
}

const globalForDemo = globalThis as unknown as { beatsDemoState?: DemoState };

function state(): DemoState {
  if (globalForDemo.beatsDemoState) return globalForDemo.beatsDemoState;
  const now = Date.now();
  // Saldo iniziale come nel mockup (45 ⚡): rinnovo VIP Resident + rollover, meno un WAV Lease.
  const grant = planCycleGrant({ tier: DEMO_TIER, balance: 14, reason: "renewal", grantedThisPeriod: 0 });
  const spent = LICENSES.WAV_LEASE.credits;
  const initial: DemoState = {
    customizations: [],
    balance: grant.balanceAfter - spent,
    licenses: [
      {
        id: "demo-lic-level-0",
        beatId: "demo-level-0",
        type: "WAV_LEASE",
        creditsSpent: spent,
        createdAt: new Date(now - DAY).toISOString(),
      },
    ],
    ledger: [
      {
        id: "demo-tx-2",
        type: "UNLOCK",
        amount: -spent,
        balanceAfter: grant.balanceAfter - spent,
        description: "WAV Lease · Level 0",
        createdAt: new Date(now - DAY).toISOString(),
      },
      {
        id: "demo-tx-1",
        type: "SUBSCRIPTION_GRANT",
        amount: grant.grant,
        balanceAfter: grant.balanceAfter,
        description: "Crediti del mese",
        createdAt: new Date(now - 6 * DAY).toISOString(),
      },
    ],
  };
  globalForDemo.beatsDemoState = initial;
  return initial;
}

function nextMidnight(now: Date): Date {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return end;
}

function toSummary(beat: DemoBeat, now = new Date()): BeatSummary {
  const released = new Date(now.getTime() - beat.daysAgo * DAY);
  // Uscita a inizio giornata: un beat "di oggi" non risulta mai nel futuro.
  released.setHours(0, 1, 0, 0);
  return {
    id: beat.id,
    slug: beat.slug,
    title: beat.title,
    bpm: beat.bpm,
    key: { root: beat.keyRoot, mode: beat.keyMode },
    durationSec: beat.durationSec,
    coverUrl: null,
    peaks: beat.peaks,
    producers: beat.producers.map((p) => {
      const producer = DEMO_PRODUCERS.find((d) => d.slug === p.slug)!;
      return { slug: p.slug, name: producer.name, role: p.role, accentColor: producer.accentColor };
    }),
    genres: beat.genres.map((slug) => {
      const g = DEMO_GENRES.find((d) => d.slug === slug);
      return { slug, name: g?.name ?? slug, parent: g?.parent ?? null };
    }),
    typeTags: beat.typeTags.map((slug) => ({ slug, name: DEMO_TYPE_TAGS.find((t) => t.slug === slug)?.name ?? slug })),
    moods: beat.moods,
    releasedAt: released.toISOString(),
    isCollab: beat.producers.length > 1,
    hasStems: beat.hasStems,
    deal:
      beat.slug === DEMO_DEAL.beatSlug
        ? { discountPct: DEMO_DEAL.discountPct, endsAt: nextMidnight(now).toISOString() }
        : null,
  };
}

function matches(beat: DemoBeat, f: BeatFilters): boolean {
  if (beat.bpm < f.bpmMin || beat.bpm > f.bpmMax) return false;
  if (f.producers.length && !beat.producers.some((p) => f.producers.includes(p.slug))) return false;
  if (f.collab === "only" && beat.producers.length < 2) return false;
  if (f.collab === "exclude" && beat.producers.length > 1) return false;
  if (f.genres.length) {
    // Selezionare un genere padre include i sottogeneri (Trap → Plugg, Rage).
    const expanded = beat.genres.flatMap((g) => [g, DEMO_GENRES.find((d) => d.slug === g)?.parent ?? g]);
    if (!expanded.some((g) => f.genres.includes(g))) return false;
  }
  if (f.types.length && !beat.typeTags.some((t) => f.types.includes(t))) return false;
  const keys = keysForFilter(f);
  if (keys && !keys.some((k) => keyId(k) === keyId({ root: beat.keyRoot, mode: beat.keyMode }))) return false;
  return true;
}

const findBeat = (id: string) => DEMO_BEATS.find((b) => b.id === id);
const plays = (b: BeatSummary) => findBeat(b.id)?.plays ?? 0;

export function createDemoBackend(): StoreBackend {
  return {
    async search(filters) {
      let pool = DEMO_BEATS.filter((b) => matches(b, filters)).map((b) => ({ beat: b, score: 1 }));
      if (filters.q) {
        pool = pool
          .map(({ beat }) => ({ beat, score: fuzzyScore(filters.q!, searchDocumentFor(beat)) }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score);
      }
      const summaries = pool.map((r) => toSummary(r.beat));
      return paginate(sortBeats(summaries, filters.sort, plays), filters.page);
    },

    async facets(): Promise<Facets> {
      return {
        producers: DEMO_PRODUCERS.map((p) => ({
          slug: p.slug,
          name: p.name,
          isResident: p.isResident,
          accentColor: p.accentColor,
          count: DEMO_BEATS.filter((b) => b.producers.some((x) => x.slug === p.slug)).length,
        })),
        genres: DEMO_GENRES.map((g) => ({
          slug: g.slug,
          name: g.name,
          parent: g.parent,
          count: DEMO_BEATS.filter((b) => b.genres.includes(g.slug)).length,
        })),
        typeTags: DEMO_TYPE_TAGS.map((t) => ({ ...t, count: DEMO_BEATS.filter((b) => b.typeTags.includes(t.slug)).length })),
        bpm: { min: BPM_RANGE.min, max: BPM_RANGE.max },
      };
    },

    async beatBySlug(slug): Promise<BeatDetail | null> {
      const beat = DEMO_BEATS.find((b) => b.slug === slug);
      if (!beat) return null;
      return {
        ...toSummary(beat),
        description: `Beat dimostrativo di ${beat.producers.map((p) => p.slug).join(" & ")}. Sostituisci con il catalogo reale.`,
        exclusiveAvailable: true,
      };
    },

    async beatOfTheDay(now = new Date()) {
      const beat = DEMO_BEATS.find((b) => b.slug === DEMO_DEAL.beatSlug);
      return beat ? toSummary(beat, now) : null;
    },

    async similar(base, limit = 6) {
      return DEMO_BEATS.map((b) => toSummary(b))
        .filter((b) => isSimilar(base, b))
        .slice(0, limit);
    },

    async viewer(userId) {
      if (userId !== DEMO_USER_ID) return null;
      const s = state();
      const owned: Record<string, LicenseType[]> = {};
      for (const l of s.licenses) (owned[l.beatId] ??= []).push(l.type);
      return {
        id: DEMO_USER_ID,
        name: "Marco “Kael” Rossi",
        artistName: "Kael",
        image: null,
        creditBalance: s.balance,
        plan: {
          tier: DEMO_TIER,
          status: "ACTIVE",
          renewsAt: new Date(Date.now() + 24 * DAY).toISOString(),
          cancelAtPeriodEnd: false,
        },
        owned,
      };
    },

    async projects(userId): Promise<ProjectSummary[]> {
      if (userId !== DEMO_USER_ID) return [];
      const due = new Date();
      due.setDate(due.getDate() + 3);
      return [
        { id: "demo-p1", title: "Notte Fonda", summary: "Voce su Level 0 · 3 take", status: "DRAFT", dueAt: null },
        {
          id: "demo-p2",
          title: "Moquette (Kael rmx)",
          summary: "Mix & Master con Freya",
          status: "IN_STUDIO",
          dueAt: due.toISOString(),
        },
      ];
    },

    async library(userId) {
      if (userId !== DEMO_USER_ID) return [];
      return state()
        .licenses.map((license) => {
          const beat = findBeat(license.beatId);
          return beat ? { license, beat: toSummary(beat) } : null;
        })
        .filter((x) => x !== null)
        .sort((a, b) => b.license.createdAt.localeCompare(a.license.createdAt));
    },

    async ledger(userId, limit = 20) {
      return userId === DEMO_USER_ID ? state().ledger.slice(0, limit) : [];
    },

    async unlock(userId, beatId, license) {
      if (userId !== DEMO_USER_ID) throw new StoreError("UNAUTHENTICATED");
      const s = state();
      const beat = findBeat(beatId);
      if (!beat) throw new StoreError("NOT_FOUND", "Beat non disponibile.");
      if (LICENSES[license].assets.includes("STEMS") && !beat.hasStems) {
        throw new StoreError("BAD_REQUEST", "Questo beat non ha gli stems.");
      }
      const existing = s.licenses.find((l) => l.beatId === beatId && l.type === license);
      if (existing) return { license: existing, balance: s.balance, alreadyOwned: true };

      const summary = toSummary(beat);
      const check = checkUnlock({ tier: DEMO_TIER, balance: s.balance, license, discountPct: summary.deal?.discountPct });
      if (!check.ok) throw new StoreError(check.reason);

      // Nessun await tra controllo e scrittura: in un singolo processo Node l'operazione è atomica.
      s.balance -= check.cost;
      const created = {
        id: `demo-lic-${beat.slug}-${license.toLowerCase()}`,
        beatId,
        type: license,
        creditsSpent: check.cost,
        createdAt: new Date().toISOString(),
      };
      s.licenses.push(created);
      s.ledger.unshift({
        id: `demo-tx-${s.ledger.length + 1}`,
        type: "UNLOCK",
        amount: -check.cost,
        balanceAfter: s.balance,
        description: `${LICENSES[license].name} · ${beat.title}`,
        createdAt: created.createdAt,
      });
      return { license: created, balance: s.balance, alreadyOwned: false };
    },

    async resolveDownload(userId, licenseId, asset) {
      const license = state().licenses.find((l) => l.id === licenseId);
      if (userId !== DEMO_USER_ID || !license) throw new StoreError("NOT_FOUND", "Licenza non trovata.");
      if (!licenseIncludesAsset(license.type, asset)) throw new StoreError("PLAN_REQUIRED", "File non incluso nella licenza.");
      const beat = findBeat(license.beatId)!;
      return { kind: "demo", beatId: beat.id, filename: `${beat.title} (DEMO ${asset}).wav` };
    },

    async newArrivals(limit = 12) {
      return DEMO_BEATS.filter((b) => b.daysAgo < NEW_WINDOW_DAYS)
        .sort((a, b) => a.daysAgo - b.daysAgo)
        .slice(0, limit)
        .map((b) => toSummary(b));
    },

    async customize(userId, beatId, input) {
      if (userId !== DEMO_USER_ID) throw new StoreError("UNAUTHENTICATED");
      const s = state();
      const beat = findBeat(beatId);
      if (!beat) throw new StoreError("NOT_FOUND", "Beat non disponibile.");
      const open = s.customizations.filter((c) => c.status === "REQUESTED" || c.status === "IN_PROGRESS").length;
      if (open >= CUSTOMIZATION_MAX_OPEN) {
        throw new StoreError("BAD_REQUEST", `Hai già ${open} personalizzazioni in corso: aspetta la consegna di una.`);
      }
      const cost = customizationCost(input.options, input.express);
      if (s.balance < cost) throw new StoreError("INSUFFICIENT_CREDITS");
      s.balance -= cost;
      const summary = toSummary(beat);
      const now = new Date();
      const request: CustomizationSummary = {
        id: `demo-cust-${s.customizations.length + 1}`,
        beat: { id: beat.id, slug: beat.slug, title: beat.title, coverUrl: null, producers: summary.producers },
        options: [...new Set(input.options)],
        express: input.express,
        notes: input.notes,
        creditsSpent: cost,
        status: "REQUESTED",
        dueAt: customizationDueDate(now, input.express).toISOString(),
        createdAt: now.toISOString(),
      };
      s.customizations.unshift(request);
      s.ledger.unshift({
        id: `demo-tx-${s.ledger.length + 1}`,
        type: "CUSTOMIZATION",
        amount: -cost,
        balanceAfter: s.balance,
        description: `Personalizzazione · ${beat.title}`,
        createdAt: request.createdAt,
      });
      return { request, balance: s.balance };
    },

    async customizations(userId) {
      return userId === DEMO_USER_ID ? state().customizations : [];
    },

    async preview(beatId) {
      const beat = findBeat(beatId);
      return beat ? { kind: "demo", beatId, filename: `${beat.slug}-preview.wav` } : null;
    },
  };
}

export function demoBeatById(id: string): DemoBeat | undefined {
  return findBeat(id);
}
