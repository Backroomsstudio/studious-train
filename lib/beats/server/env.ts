/**
 * Configurazione del beat store letta dalle variabili d'ambiente.
 *
 * Modalità demo: senza DATABASE_URL (o con BEATS_DEMO_MODE=1) il negozio gira su un catalogo
 * dimostrativo in memoria con audio sintetizzato. Nessun file reale viene mai servito in demo.
 */

import { parseLaunchAt, parseStaffInvites } from "../launch";

const read = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

export const storeEnv = {
  get databaseUrl() {
    return read("DATABASE_URL");
  },
  get demoMode() {
    return read("BEATS_DEMO_MODE") === "1" || !read("DATABASE_URL");
  },
  get siteUrl() {
    return read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";
  },
  /** Apertura pubblica (`STORE_LAUNCH_AT`, ISO): prima entra solo lo staff. Vuota = negozio aperto. */
  get launchAt() {
    return parseLaunchAt(read("STORE_LAUNCH_AT"));
  },
  /** Codici d'invito dello staff (`STAFF_INVITES=astral:CODICE,…`): codice → slug del produttore. */
  get staffInvites() {
    return parseStaffInvites(read("STAFF_INVITES"));
  },
  get downloadGrantSecret() {
    return read("DOWNLOAD_GRANT_SECRET") ?? read("AUTH_SECRET");
  },
  stripe: {
    get secretKey() {
      return read("STRIPE_SECRET_KEY");
    },
    get webhookSecret() {
      return read("STRIPE_WEBHOOK_SECRET");
    },
    get prices() {
      return {
        STARTER: read("STRIPE_PRICE_STARTER"),
        PRO: read("STRIPE_PRICE_PRO"),
        ELITE: read("STRIPE_PRICE_ELITE"),
      } as const;
    },
    /** Prezzi annuali (10 mesi pagati, 12 di crediti). */
    get yearlyPrices() {
      return {
        STARTER: read("STRIPE_PRICE_STARTER_YEARLY"),
        PRO: read("STRIPE_PRICE_PRO_YEARLY"),
        ELITE: read("STRIPE_PRICE_ELITE_YEARLY"),
      } as const;
    },
  },
  /** Segreto del cron (accrediti mensili degli annuali, chiusura aste): header `Authorization: Bearer …`. */
  get cronSecret() {
    return read("CRON_SECRET");
  },
  /** Origini autorizzate a leggere l'overlay della diretta (app overlay-live), separate da virgola. */
  get overlayOrigins() {
    return (read("LIVE_OVERLAY_ORIGINS") ?? "*").split(",").map((o) => o.trim());
  },
  /**
   * Archivio file compatibile S3. Di base Cloudflare R2 (endpoint dall'account); con `R2_ENDPOINT`
   * va bene qualunque S3 (es. Supabase Storage: `https://<ref>.storage.supabase.co/storage/v1/s3`).
   */
  r2: {
    get config() {
      const accountId = read("R2_ACCOUNT_ID");
      const customEndpoint = read("R2_ENDPOINT");
      const accessKeyId = read("R2_ACCESS_KEY_ID");
      const secretAccessKey = read("R2_SECRET_ACCESS_KEY");
      const bucket = read("R2_BUCKET");
      const endpoint = customEndpoint ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
      if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
      return {
        endpoint,
        region: read("R2_REGION") ?? "auto",
        // Gli S3 diversi da R2 vogliono quasi sempre gli indirizzi "bucket nel percorso".
        forcePathStyle: Boolean(customEndpoint),
        accessKeyId,
        secretAccessKey,
        bucket,
      };
    },
  },
};
