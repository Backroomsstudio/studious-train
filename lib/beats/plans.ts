/**
 * Piani di abbonamento. Unico punto da modificare per prezzi, crediti e vantaggi.
 * Gli ID dei prezzi Stripe arrivano dalle variabili d'ambiente (vedi `.env.example`).
 *
 * Politica di rollover: i crediti non usati passano al mese successivo fino a un tetto
 * (`rolloverCap`); al rinnovo l'eccedenza scade prima del nuovo accredito. Alla cancellazione
 * i crediti restano spendibili fino a fine periodo, poi scadono.
 */

import type { LicenseType } from "./licenses";

export type PlanTier = "STARTER" | "PRO" | "ELITE";

export interface Plan {
  tier: PlanTier;
  name: string;
  /** Prezzo mensile in centesimi di euro. */
  priceCents: number;
  monthlyCredits: number;
  /** Saldo massimo che può passare al mese successivo. */
  rolloverCap: number;
  /** Licenze sbloccabili con questo piano (incentivo all'upgrade). */
  licenses: LicenseType[];
  perks: string[];
  highlighted?: boolean;
}

export const PLANS: Record<PlanTier, Plan> = {
  STARTER: {
    tier: "STARTER",
    name: "Starter",
    priceCents: 2990,
    monthlyCredits: 10,
    rolloverCap: 10,
    licenses: ["MP3_LEASE", "WAV_LEASE"],
    perks: ["10 crediti al mese", "Leasing MP3 e WAV", "Rollover fino a 10 crediti"],
  },
  PRO: {
    tier: "PRO",
    name: "Pro Artist",
    priceCents: 3990,
    monthlyCredits: 20,
    rolloverCap: 20,
    licenses: ["MP3_LEASE", "WAV_LEASE", "TRACKOUT"],
    perks: ["20 crediti al mese", "Trackout con stems", "Rollover fino a 20 crediti", "Anteprime in esclusiva 48 h"],
    highlighted: true,
  },
  ELITE: {
    tier: "ELITE",
    name: "VIP Resident",
    priceCents: 4999,
    monthlyCredits: 35,
    rolloverCap: 35,
    licenses: ["MP3_LEASE", "WAV_LEASE", "TRACKOUT", "UNLIMITED"],
    perks: [
      "35 crediti al mese",
      "Licenza Unlimited",
      "Rollover fino a 35 crediti",
      "-15% su Mix & Master in studio",
      "Prelazione sulle esclusive",
    ],
  },
};

export const PLAN_ORDER: PlanTier[] = ["STARTER", "PRO", "ELITE"];

export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && value in PLANS;
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** Il piano più economico che include la licenza (per la CTA di upgrade). */
export function cheapestPlanFor(license: LicenseType): Plan {
  return PLAN_ORDER.map((t) => PLANS[t]).find((p) => p.licenses.includes(license)) ?? PLANS.ELITE;
}
