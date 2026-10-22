/**
 * Libro mastro dei crediti su PostgreSQL.
 *
 * Garanzie:
 * - Atomicità: saldo, riga del mastro e licenza cambiano nella stessa transazione.
 * - Niente saldo negativo: l'addebito è un UPDATE condizionato (`creditBalance >= costo`);
 *   in più il DB ha un CHECK sul saldo (vedi migrazione).
 * - Niente doppie spese: `License(userId, beatId, type)` è unica; due sblocchi concorrenti
 *   dello stesso beat fanno fallire il secondo e il suo addebito viene annullato dal rollback.
 * - Niente doppi accrediti: le righe generate dai webhook hanno un `idempotencyKey` unico.
 */
import { Prisma, type PlanTier, type LicenseType } from "@/lib/generated/prisma/client";
import {
  CUSTOMIZATION_MAX_OPEN,
  customizationCost,
  customizationDueDate,
  type CustomizationOption,
} from "../customizations";
import { LICENSES } from "../licenses";
import { checkUnlock, planCycleGrant, type CycleReason } from "../ledger-rules";
import { StoreError } from "./errors";
import type { Db } from "./prisma";

type Tx = Prisma.TransactionClient;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** Piano attivo dell'utente (gli abbonamenti cancellati restano validi fino a fine periodo). */
export async function activeTier(db: Db | Tx, userId: string, now = new Date()): Promise<PlanTier | null> {
  const sub = await db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] }, currentPeriodEnd: { gt: now } },
    orderBy: { currentPeriodEnd: "desc" },
    select: { tier: true },
  });
  return sub?.tier ?? null;
}

async function lockBalance(tx: Tx, userId: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ creditBalance: number }>>`
    SELECT "creditBalance" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  if (!rows[0]) throw new StoreError("NOT_FOUND", "Utente inesistente.");
  return rows[0].creditBalance;
}

export interface UnlockResult {
  licenseId: string;
  type: LicenseType;
  createdAt: Date;
  balance: number;
  alreadyOwned: boolean;
}

export async function unlockWithCredits(
  db: Db,
  input: { userId: string; beatId: string; license: LicenseType; now?: Date },
): Promise<UnlockResult> {
  const now = input.now ?? new Date();
  const run = () =>
    db.$transaction(async (tx) => {
      const existing = await tx.license.findUnique({
        where: { userId_beatId_type: { userId: input.userId, beatId: input.beatId, type: input.license } },
      });
      if (existing) {
        if (existing.status === "REVOKED") throw new StoreError("LICENSE_REVOKED");
        const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { creditBalance: true } });
        return {
          licenseId: existing.id,
          type: existing.type,
          createdAt: existing.createdAt,
          balance: user.creditBalance,
          alreadyOwned: true,
        };
      }

      const beat = await tx.beat.findFirst({
        where: { id: input.beatId, status: "PUBLISHED" },
        select: {
          id: true,
          stemsObjectKey: true,
          deals: { where: { startsAt: { lte: now }, endsAt: { gt: now } }, select: { discountPct: true }, take: 1 },
        },
      });
      if (!beat) throw new StoreError("NOT_FOUND", "Beat non disponibile.");
      if (LICENSES[input.license].assets.includes("STEMS") && !beat.stemsObjectKey) {
        throw new StoreError("BAD_REQUEST", "Questo beat non ha gli stems.");
      }

      const tier = await activeTier(tx, input.userId, now);
      const balance = await lockBalance(tx, input.userId);
      const check = checkUnlock({ tier, balance, license: input.license, discountPct: beat.deals[0]?.discountPct });
      if (!check.ok) throw new StoreError(check.reason);

      const debited = await tx.user.updateMany({
        where: { id: input.userId, creditBalance: { gte: check.cost } },
        data: { creditBalance: { decrement: check.cost } },
      });
      if (debited.count !== 1) throw new StoreError("INSUFFICIENT_CREDITS");
      const balanceAfter = balance - check.cost;

      const license = await tx.license.create({
        data: {
          userId: input.userId,
          beatId: beat.id,
          type: input.license,
          creditsSpent: check.cost,
          terms: LICENSES[input.license].terms as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.creditTransaction.create({
        data: {
          userId: input.userId,
          type: "UNLOCK",
          amount: -check.cost,
          balanceAfter,
          description: `${LICENSES[input.license].name}`,
          licenseId: license.id,
        },
      });
      return { licenseId: license.id, type: license.type, createdAt: license.createdAt, balance: balanceAfter, alreadyOwned: false };
    });

  try {
    return await run();
  } catch (error) {
    // Sblocco concorrente dello stesso beat: l'altra richiesta ha vinto, la nostra è stata annullata.
    if (isUniqueViolation(error)) return run();
    throw error;
  }
}

/**
 * Accredito del periodo dopo una fattura pagata. Idempotente per fattura.
 * Restituisce `false` se la fattura era già stata accreditata.
 */
export async function grantCycleCredits(
  db: Db,
  input: {
    userId: string;
    subscriptionId: string;
    tier: PlanTier;
    invoiceId: string;
    reason: CycleReason;
    periodStart: Date;
  },
): Promise<boolean> {
  try {
    await db.$transaction(async (tx) => {
      const balance = await lockBalance(tx, input.userId);
      const granted = await tx.creditTransaction.aggregate({
        where: {
          subscriptionId: input.subscriptionId,
          type: "SUBSCRIPTION_GRANT",
          createdAt: { gte: input.periodStart },
        },
        _sum: { amount: true },
      });
      const plan = planCycleGrant({
        tier: input.tier,
        balance,
        reason: input.reason,
        grantedThisPeriod: granted._sum.amount ?? 0,
      });

      if (plan.expire > 0) {
        await tx.creditTransaction.create({
          data: {
            userId: input.userId,
            type: "ROLLOVER_EXPIRY",
            amount: -plan.expire,
            balanceAfter: plan.balanceAfterExpiry,
            description: "Crediti oltre il tetto di rollover",
            subscriptionId: input.subscriptionId,
            stripeInvoiceId: input.invoiceId,
            idempotencyKey: `rollover:${input.invoiceId}`,
          },
        });
      }
      if (plan.grant > 0) {
        await tx.creditTransaction.create({
          data: {
            userId: input.userId,
            type: "SUBSCRIPTION_GRANT",
            amount: plan.grant,
            balanceAfter: plan.balanceAfter,
            description: input.reason === "upgrade" ? "Integrazione per upgrade" : "Crediti del mese",
            subscriptionId: input.subscriptionId,
            stripeInvoiceId: input.invoiceId,
            idempotencyKey: `grant:${input.invoiceId}`,
          },
        });
      }
      await tx.user.update({ where: { id: input.userId }, data: { creditBalance: plan.balanceAfter } });
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

/** Fine abbonamento: i crediti residui scadono. Idempotente per abbonamento. */
export async function expireCreditsAtSubscriptionEnd(
  db: Db,
  input: { userId: string; subscriptionId: string },
): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      // Se nel frattempo è partito un altro abbonamento attivo, i crediti restano.
      if (await activeTier(tx, input.userId)) return;
      const balance = await lockBalance(tx, input.userId);
      if (balance === 0) return;
      await tx.creditTransaction.create({
        data: {
          userId: input.userId,
          type: "SUBSCRIPTION_END_EXPIRY",
          amount: -balance,
          balanceAfter: 0,
          description: "Abbonamento terminato",
          subscriptionId: input.subscriptionId,
          idempotencyKey: `end:${input.subscriptionId}`,
        },
      });
      await tx.user.update({ where: { id: input.userId }, data: { creditBalance: 0 } });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}

export interface CustomizationInput {
  userId: string;
  beatId: string;
  options: CustomizationOption[];
  express: boolean;
  notes: string;
  referenceUrl?: string;
  now?: Date;
}

/**
 * Richiesta di personalizzazione: addebito, richiesta e riga del mastro nella stessa transazione,
 * con lo stesso UPDATE condizionato dello sblocco (mai saldo negativo). Le richieste aperte per
 * artista sono limitate, così i produttori non vanno in sovraccarico.
 */
export async function requestCustomization(db: Db, input: CustomizationInput) {
  const now = input.now ?? new Date();
  const cost = customizationCost(input.options, input.express);
  return db.$transaction(async (tx) => {
    const beat = await tx.beat.findFirst({ where: { id: input.beatId, status: "PUBLISHED" }, select: { id: true, title: true } });
    if (!beat) throw new StoreError("NOT_FOUND", "Beat non disponibile.");
    if (!(await activeTier(tx, input.userId, now))) throw new StoreError("PLAN_REQUIRED", "Serve un abbonamento attivo per le personalizzazioni.");

    const balance = await lockBalance(tx, input.userId);
    const open = await tx.customizationRequest.count({
      where: { userId: input.userId, status: { in: ["REQUESTED", "IN_PROGRESS"] } },
    });
    if (open >= CUSTOMIZATION_MAX_OPEN) {
      throw new StoreError("BAD_REQUEST", `Hai già ${open} personalizzazioni in corso: aspetta la consegna di una.`);
    }
    if (balance < cost) throw new StoreError("INSUFFICIENT_CREDITS");

    const debited = await tx.user.updateMany({
      where: { id: input.userId, creditBalance: { gte: cost } },
      data: { creditBalance: { decrement: cost } },
    });
    if (debited.count !== 1) throw new StoreError("INSUFFICIENT_CREDITS");

    const request = await tx.customizationRequest.create({
      data: {
        userId: input.userId,
        beatId: beat.id,
        options: [...new Set(input.options)],
        express: input.express,
        notes: input.notes,
        referenceUrl: input.referenceUrl,
        creditsSpent: cost,
        dueAt: customizationDueDate(now, input.express),
      },
    });
    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        type: "CUSTOMIZATION",
        amount: -cost,
        balanceAfter: balance - cost,
        description: `Personalizzazione · ${beat.title}`,
        customizationId: request.id,
      },
    });
    return { request, balance: balance - cost };
  });
}
