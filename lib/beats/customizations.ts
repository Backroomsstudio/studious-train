/**
 * Personalizzazione di un beat del catalogo: l'artista sceglie le modifiche, paga in crediti,
 * il produttore la realizza e la consegna con una WAV Lease della versione personalizzata.
 * Unico punto da modificare per voci, costi e tempi.
 */

export type CustomizationOption = "KEY" | "TEMPO" | "STRUCTURE" | "SOUNDS" | "VOCAL_TAG" | "MIX_READY";

export interface CustomizationOptionDef {
  id: CustomizationOption;
  name: string;
  detail: string;
  credits: number;
}

/** Costo fisso: lavoro del produttore + WAV Lease della versione personalizzata. */
export const CUSTOMIZATION_BASE_CREDITS = 6;
export const CUSTOMIZATION_EXPRESS_CREDITS = 4;
export const CUSTOMIZATION_DAYS = 5;
export const CUSTOMIZATION_EXPRESS_DAYS = 2;
/** Richieste aperte contemporaneamente per artista (i produttori sono tre). */
export const CUSTOMIZATION_MAX_OPEN = 3;
export const CUSTOMIZATION_NOTES_MAX = 600;

export const CUSTOMIZATION_OPTIONS: CustomizationOptionDef[] = [
  { id: "KEY", name: "Cambio tonalità", detail: "La tonalità giusta per la tua voce", credits: 3 },
  { id: "TEMPO", name: "Cambio BPM", detail: "Più lento o più veloce, senza artefatti", credits: 3 },
  { id: "STRUCTURE", name: "Struttura su misura", detail: "Intro, strofe, ritornelli e bridge dove li vuoi", credits: 6 },
  { id: "SOUNDS", name: "Suoni e strumenti", detail: "808, batteria o melodia rifatti nel tuo stile", credits: 5 },
  { id: "VOCAL_TAG", name: "Tag personale", detail: "“prod. for” col tuo nome nell'intro", credits: 2 },
  { id: "MIX_READY", name: "Pronto per la voce", detail: "Spazio in frequenza e stems puliti per il mix", credits: 4 },
];

export function isCustomizationOption(value: unknown): value is CustomizationOption {
  return CUSTOMIZATION_OPTIONS.some((o) => o.id === value);
}

export function customizationCost(options: CustomizationOption[], express: boolean): number {
  const unique = [...new Set(options)];
  return (
    CUSTOMIZATION_BASE_CREDITS +
    unique.reduce((sum, id) => sum + (CUSTOMIZATION_OPTIONS.find((o) => o.id === id)?.credits ?? 0), 0) +
    (express ? CUSTOMIZATION_EXPRESS_CREDITS : 0)
  );
}

/** Data di consegna in giorni lavorativi (sabato e domenica esclusi). */
export function customizationDueDate(from: Date, express: boolean): Date {
  const due = new Date(from);
  let left = express ? CUSTOMIZATION_EXPRESS_DAYS : CUSTOMIZATION_DAYS;
  while (left > 0) {
    due.setDate(due.getDate() + 1);
    if (due.getDay() !== 0 && due.getDay() !== 6) left--;
  }
  return due;
}

export const CUSTOMIZATION_STATUS = {
  REQUESTED: "Richiesta inviata",
  IN_PROGRESS: "In lavorazione",
  DELIVERED: "Consegnata",
  REFUNDED: "Rimborsata",
} as const;

export type CustomizationStatus = keyof typeof CUSTOMIZATION_STATUS;
