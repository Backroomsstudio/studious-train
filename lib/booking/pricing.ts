import { DISCOUNTS, DISCOUNTS_BY_SERVICE, maxUnitsFor, type BookableService } from "./catalog.ts";

export interface PriceQuote {
  units: number;
  /** Prezzo pieno (unità × prezzo unitario), in centesimi */
  fullCents: number;
  /** Sconto applicato, in percentuale (0 se nessuno) */
  discountPercent: number;
  /** Totale da pagare, in centesimi (arrotondato all'euro intero) */
  totalCents: number;
  savingCents: number;
}

export function discountFor(service: BookableService, units: number, table?: Record<number, number>): number {
  if (service.noDiscount) return 0;
  const source = table ?? DISCOUNTS_BY_SERVICE[service.id] ?? DISCOUNTS;
  // Si usa lo scaglione più alto raggiunto: con sconti su 3 e 5, chi prende 4 ha quello del 3.
  let best = 0;
  for (const [minUnits, pct] of Object.entries(source)) {
    if (units >= Number(minUnits) && pct > best) best = pct;
  }
  return Math.min(Math.max(best, 0), 90);
}

export function quote(service: BookableService, units: number, table?: Record<number, number>): PriceQuote {
  if (!Number.isInteger(units) || units < 1 || units > maxUnitsFor(service)) {
    throw new RangeError(`Quantità non valida per ${service.id}: ${units}`);
  }
  const fullCents = service.unitPriceCents * units;
  const discountPercent = discountFor(service, units, table);
  const discounted = (fullCents * (100 - discountPercent)) / 100;
  // Arrotondamento all'euro intero, come sul listino.
  const totalCents = Math.round(discounted / 100) * 100;
  return { units, fullCents, discountPercent, totalCents, savingCents: fullCents - totalCents };
}

export function formatEuro(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(euros) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 ora" : `${h} ore`;
  return `${h} h ${m} min`;
}

export function unitLabel(service: BookableService, units: number): string {
  return `${units} ${units === 1 ? service.unit.one : service.unit.many}`;
}
