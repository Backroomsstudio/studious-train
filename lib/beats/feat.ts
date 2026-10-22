/**
 * Cerco feat: la bacheca dove gli artisti cercano con chi collaborare, con chat privata.
 * Regole condivise da server, client e test: ruoli, limiti, validazione e piccoli formati.
 */
import { z } from "zod";

/** Cosa cerca (o offre) chi pubblica. Elenco fisso: nel DB resta una stringa, validata qui. */
export const FEAT_ROLES = [
  { id: "feat", label: "Cerco feat" },
  { id: "strofa", label: "Offro strofa" },
  { id: "ritornello", label: "Cerco ritornello" },
  { id: "produttore", label: "Cerco produttore" },
  { id: "voce", label: "Cerco voce" },
  { id: "strumenti", label: "Cerco strumentista" },
] as const;

export type FeatRole = (typeof FEAT_ROLES)[number]["id"];

const ROLE_IDS = FEAT_ROLES.map((r) => r.id) as [FeatRole, ...FeatRole[]];

export const isFeatRole = (value: unknown): value is FeatRole => ROLE_IDS.includes(value as FeatRole);

export const featRoleLabel = (id: string) => FEAT_ROLES.find((r) => r.id === id)?.label ?? id;

export const FEAT = {
  textMin: 10,
  textMax: 280,
  cityMax: 40,
  messageMax: 1000,
  reasonMax: 300,
  /** Dopo 30 giorni l'annuncio esce dalla bacheca. */
  expiresDays: 30,
  /** Polling della chat aperta e della casella. */
  pollMs: 4000,
} as const;

/**
 * Limiti contati sui dati salvati (validi anche con più istanze serverless). Le route aggiungono
 * davanti un throttle in memoria (`server/throttle.ts`) contro chi martella le API.
 */
export const FEAT_LIMITS = {
  posts: { max: 3, windowMs: 24 * 60 * 60_000, message: "Hai già pubblicato 3 annunci nelle ultime 24 ore: riprova domani." },
  messages: { max: 20, windowMs: 60_000, message: "Stai scrivendo troppo veloce: aspetta un minuto e riprova." },
} as const;

/** True se c'è ancora posto nella finestra (`times` = momenti delle azioni già fatte, in ms). */
export function underLimit(times: number[], limit: { max: number; windowMs: number }, now = Date.now()): boolean {
  return times.filter((t) => t > now - limit.windowMs).length < limit.max;
}

export const FEAT_REPORT_REASONS = ["Spam o pubblicità", "Linguaggio offensivo", "Truffa o richiesta di soldi", "Altro"] as const;

const DAY = 86_400_000;

export const featExpiry = (from: Date) => new Date(from.getTime() + FEAT.expiresDays * DAY);

/** Testo pulito: niente spazi ai bordi né righe vuote a raffica. */
export const cleanFeatText = (s: string) => s.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

const emptyToUndefined = z.literal("").transform(() => undefined);

export const featPostSchema = z.object({
  role: z.enum(ROLE_IDS, "Scegli cosa cerchi."),
  text: z
    .string()
    .transform(cleanFeatText)
    .pipe(
      z
        .string()
        .min(FEAT.textMin, `Racconta un po' di più (almeno ${FEAT.textMin} caratteri).`)
        .max(FEAT.textMax, `Massimo ${FEAT.textMax} caratteri.`),
    ),
  genre: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,32}$/, "Genere non valido.")
    .optional()
    .or(emptyToUndefined),
  beatId: z.string().trim().min(1).max(64).optional().or(emptyToUndefined),
  city: z.string().trim().max(FEAT.cityMax, `La città può avere al massimo ${FEAT.cityMax} caratteri.`).optional().or(emptyToUndefined),
});

export type FeatPostInput = z.output<typeof featPostSchema>;

export const featMessageSchema = z.object({
  body: z
    .string()
    .transform(cleanFeatText)
    .pipe(z.string().min(1, "Scrivi un messaggio.").max(FEAT.messageMax, `Massimo ${FEAT.messageMax} caratteri.`)),
});

export const featReportSchema = z
  .object({
    postId: z.string().min(1).max(64).optional(),
    messageId: z.string().min(1).max(64).optional(),
    reason: z.string().trim().min(3, "Dicci il motivo.").max(FEAT.reasonMax),
  })
  .refine((r) => Boolean(r.postId) !== Boolean(r.messageId), "Segnala un annuncio oppure un messaggio.");

export type FeatReportInput = z.output<typeof featReportSchema>;

export interface FeatFilters {
  role?: FeatRole;
  genre?: string;
}

/** Filtri dalla query string, tolleranti: valori sconosciuti ignorati. */
export function parseFeatFilters(params: URLSearchParams): FeatFilters {
  const role = params.get("role");
  const genre = params.get("genre")?.trim().toLowerCase();
  return {
    ...(isFeatRole(role) ? { role } : {}),
    ...(genre && /^[a-z0-9-]{2,32}$/.test(genre) ? { genre } : {}),
  };
}

/** Colori degli avatar (gli stessi del prototipo): stabili per artista. */
export const FEAT_AVATAR_COLORS = ["#bf5af2", "#ff9f0a", "#30d158", "#64d2ff", "#ff2d92", "#0a84ff"] as const;

export function featAvatarColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FEAT_AVATAR_COLORS[h % FEAT_AVATAR_COLORS.length];
}

const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });

/** "adesso", "5 minuti fa", "2 ore fa", "ieri", "3 giorni fa". */
export function timeAgo(iso: string, now = Date.now()): string {
  const sec = Math.round((new Date(iso).getTime() - now) / 1000);
  if (sec > -60) return "adesso";
  if (sec > -3600) return rtf.format(Math.round(sec / 60), "minute");
  if (sec > -86_400) return rtf.format(Math.round(sec / 3600), "hour");
  if (sec > -7 * 86_400) return rtf.format(Math.round(sec / 86_400), "day");
  return rtf.format(Math.round(sec / (7 * 86_400)), "week");
}
