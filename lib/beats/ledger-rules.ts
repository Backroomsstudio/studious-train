/**
 * Regole pure del libro mastro dei crediti, condivise dal backend Prisma, dalla demo e dai test.
 */
import { creditCost, type LicenseType } from "./licenses";
import { PLANS, type PlanTier } from "./plans";

export type CycleReason = "renewal" | "upgrade";

export interface CycleGrantPlan {
  /** Crediti da far scadere prima dell'accredito (eccedenza sul tetto di rollover). */
  expire: number;
  /** Crediti da accreditare. */
  grant: number;
  balanceAfterExpiry: number;
  balanceAfter: number;
}

/**
 * Rinnovo: il saldo viene riportato al tetto di rollover, poi si accredita il mese.
 * Upgrade a metà periodo: si accredita solo la differenza non ancora ricevuta nel periodo,
 * senza scadenze (chi passa da Starter a Pro riceve i 10 crediti mancanti).
 */
export function planCycleGrant(input: {
  tier: PlanTier;
  balance: number;
  reason: CycleReason;
  grantedThisPeriod: number;
}): CycleGrantPlan {
  const plan = PLANS[input.tier];
  if (input.reason === "upgrade") {
    const grant = Math.max(0, plan.monthlyCredits - input.grantedThisPeriod);
    return { expire: 0, grant, balanceAfterExpiry: input.balance, balanceAfter: input.balance + grant };
  }
  const expire = Math.max(0, input.balance - plan.rolloverCap);
  const balanceAfterExpiry = input.balance - expire;
  return {
    expire,
    grant: plan.monthlyCredits,
    balanceAfterExpiry,
    balanceAfter: balanceAfterExpiry + plan.monthlyCredits,
  };
}

/** Senza un piano attivo (solo crediti omaggio) si sbloccano le licenze dello Starter. */
export function allowedLicenses(tier: PlanTier | null): LicenseType[] {
  return PLANS[tier ?? "STARTER"].licenses;
}

export type UnlockCheck =
  | { ok: true; cost: number }
  | { ok: false; reason: "PLAN_REQUIRED" | "INSUFFICIENT_CREDITS"; cost: number };

export function checkUnlock(input: {
  tier: PlanTier | null;
  balance: number;
  license: LicenseType;
  discountPct?: number;
}): UnlockCheck {
  const cost = creditCost(input.license, input.discountPct);
  if (!allowedLicenses(input.tier).includes(input.license)) return { ok: false, reason: "PLAN_REQUIRED", cost };
  if (input.balance < cost) return { ok: false, reason: "INSUFFICIENT_CREDITS", cost };
  return { ok: true, cost };
}

/** Saldo diviso nelle due borse: abbonamento (scade) e portafoglio (non scade). */
export interface Wallet {
  subscription: number;
  wallet: number;
}

export const totalCredits = (w: Wallet) => w.subscription + w.wallet;

/**
 * Da quale borsa esce una spesa: prima i crediti dell'abbonamento (che altrimenti scadrebbero),
 * poi il portafoglio. `null` se il totale non basta.
 */
export function splitDebit(w: Wallet, cost: number): { fromSubscription: number; fromWallet: number } | null {
  if (cost < 0 || totalCredits(w) < cost) return null;
  const fromSubscription = Math.min(w.subscription, cost);
  return { fromSubscription, fromWallet: cost - fromSubscription };
}

/** Data + n mesi (il 31 gennaio + 1 mese diventa l'ultimo di febbraio, non il 3 marzo). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/**
 * Piani annuali: quante mensilità di crediti sono già iniziate nel periodo (1..12).
 * La prima arriva con la fattura, le altre dal cron mensile.
 */
export function yearlyMonthsStarted(periodStart: Date, now: Date): number {
  let n = 0;
  while (n < 12 && addMonths(periodStart, n) <= now) n++;
  return n;
}
