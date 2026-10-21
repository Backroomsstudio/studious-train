/**
 * Permessi di download firmati (HMAC-SHA256), validi pochi minuti.
 *
 * Il permesso lega utente, licenza e file: il link `/api/downloads?grant=…` funziona solo per
 * l'utente che l'ha ricevuto e solo finché non scade. Il server ricontrolla comunque la licenza
 * prima di firmare l'URL di R2, quindi una licenza revocata blocca anche i link già emessi.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { DownloadAsset } from "../licenses";
import { storeEnv } from "./env";

export const GRANT_TTL_SECONDS = 15 * 60;

export interface DownloadGrant {
  userId: string;
  licenseId: string;
  asset: DownloadAsset;
  /** Scadenza in secondi Unix. */
  exp: number;
}

const ASSETS: readonly DownloadAsset[] = ["MP3", "WAV", "STEMS"];

function secret(): string {
  const value = storeEnv.downloadGrantSecret;
  if (value) return value;
  if (storeEnv.demoMode) return "demo-only-download-secret";
  throw new Error("DOWNLOAD_GRANT_SECRET (o AUTH_SECRET) non impostato");
}

const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("base64url");

export function issueDownloadGrant(
  input: Omit<DownloadGrant, "exp">,
  options: { ttlSeconds?: number; now?: number; key?: string } = {},
): string {
  const now = options.now ?? Date.now();
  const grant: DownloadGrant = { ...input, exp: Math.floor(now / 1000) + (options.ttlSeconds ?? GRANT_TTL_SECONDS) };
  const payload = Buffer.from(JSON.stringify([grant.userId, grant.licenseId, grant.asset, grant.exp])).toString("base64url");
  return `${payload}.${sign(payload, options.key ?? secret())}`;
}

export function verifyDownloadGrant(token: string, options: { now?: number; key?: string } = {}): DownloadGrant | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload, options.key ?? secret()));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const [userId, licenseId, asset, exp] = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown[];
    if (typeof userId !== "string" || typeof licenseId !== "string" || typeof exp !== "number") return null;
    if (!ASSETS.includes(asset as DownloadAsset)) return null;
    if (exp * 1000 <= (options.now ?? Date.now())) return null;
    return { userId, licenseId, asset: asset as DownloadAsset, exp };
  } catch {
    return null;
  }
}
