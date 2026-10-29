import { defineConfig } from "prisma/config";

/**
 * Prisma 7: l'URL del database vive qui e non nello schema.
 * `prisma generate` non si collega al database, quindi la build funziona anche senza DATABASE_URL.
 * Le migrazioni usano DIRECT_URL se c'è (es. il pooler di Supabase in modalità sessione, porta 5432):
 * il pooler in modalità transazione, che va bene per il sito, non regge i lock delle migrazioni.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
