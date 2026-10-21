/**
 * Configurazione del beat store letta dalle variabili d'ambiente.
 *
 * Modalità demo: senza DATABASE_URL (o con BEATS_DEMO_MODE=1) il negozio gira su un catalogo
 * dimostrativo in memoria con audio sintetizzato. Nessun file reale viene mai servito in demo.
 */

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
  },
  r2: {
    get config() {
      const accountId = read("R2_ACCOUNT_ID");
      const accessKeyId = read("R2_ACCESS_KEY_ID");
      const secretAccessKey = read("R2_SECRET_ACCESS_KEY");
      const bucket = read("R2_BUCKET");
      if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
      return { accountId, accessKeyId, secretAccessKey, bucket };
    },
  },
};
