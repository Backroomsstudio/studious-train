import { DISCOUNTS, getPackage, getService, listCents, maxUnitsFor, normalizeLines, type BookableService, type CartLine, type PackageId } from "./catalog.ts";

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

/** Sconto per quantità: si usa lo scaglione più alto raggiunto (con sconti su 3 e 5, chi prende 4 ha quello del 3). */
export function discountForUnits(units: number, table: Record<number, number> = DISCOUNTS): number {
  let best = 0;
  for (const [minUnits, pct] of Object.entries(table)) {
    if (units >= Number(minUnits) && pct > best) best = pct;
  }
  return Math.min(Math.max(best, 0), 90);
}

export function discountFor(service: BookableService, units: number, table?: Record<number, number>): number {
  if (service.noDiscount) return 0;
  return discountForUnits(units, table);
}

const roundEuro = (cents: number) => Math.round(cents / 100) * 100;

/** Prezzo di un solo servizio (usato per i servizi singoli e per le card del checkout). */
export function quote(service: BookableService, units: number, table?: Record<number, number>): PriceQuote {
  if (!Number.isInteger(units) || units < 1 || units > maxUnitsFor(service)) {
    throw new RangeError(`Quantità non valida per ${service.id}: ${units}`);
  }
  const fullCents = service.unitPriceCents * units;
  const discountPercent = discountFor(service, units, table);
  // Arrotondamento all'euro intero, come sul listino.
  const totalCents = roundEuro((fullCents * (100 - discountPercent)) / 100);
  return { units, fullCents, discountPercent, totalCents, savingCents: fullCents - totalCents };
}

export interface CartQuote {
  /** Prezzo pieno di listino di tutto il carrello */
  fullCents: number;
  /** Totale da pagare */
  totalCents: number;
  savingCents: number;
  /** Sconto per quantità applicato al carrello libero (0 per i pacchetti) */
  discountPercent: number;
  /** Unità che contano per lo sconto */
  discountUnits: number;
  packageId?: PackageId;
}

/**
 * Prezzo del carrello. Pacchetto: prezzo fisso. Carrello libero: sconto per quantità su tutte le unità insieme,
 * "in qualsiasi combinazione" (3+ −10%, 5+ −20%, 10+ −30%); i servizi a prezzo fisso non contano e non si scontano.
 */
export function cartQuote(lines: CartLine[], packageId?: PackageId): CartQuote {
  const clean = normalizeLines(lines);
  if (!clean.length) throw new RangeError("Carrello vuoto");
  for (const l of clean) {
    if (l.units > maxUnitsFor(getService(l.serviceId)!)) throw new RangeError(`Quantità non valida per ${l.serviceId}: ${l.units}`);
  }
  const fullCents = listCents(clean);
  if (packageId) {
    const pkg = getPackage(packageId);
    if (!pkg) throw new RangeError("Pacchetto non valido");
    return { fullCents, totalCents: pkg.priceCents, savingCents: fullCents - pkg.priceCents, discountPercent: 0, discountUnits: 0, packageId };
  }
  let discountable = 0;
  let fixed = 0;
  let discountUnits = 0;
  for (const l of clean) {
    const s = getService(l.serviceId)!;
    if (s.noDiscount) fixed += s.unitPriceCents * l.units;
    else {
      discountable += s.unitPriceCents * l.units;
      discountUnits += l.units;
    }
  }
  const discountPercent = discountForUnits(discountUnits);
  const totalCents = roundEuro((discountable * (100 - discountPercent)) / 100) + fixed;
  return { fullCents, totalCents, savingCents: fullCents - totalCents, discountPercent, discountUnits };
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
