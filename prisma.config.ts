import { defineConfig } from "prisma/config";

/**
 * Prisma 7: l'URL del database vive qui e non nello schema.
 * `prisma generate` non si collega al database, quindi la build funziona anche senza DATABASE_URL.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
