import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { storeEnv } from "./env";

export type Db = PrismaClient;

const globalForPrisma = globalThis as unknown as { beatsPrisma?: PrismaClient };

/** Client creato al primo uso: la build non richiede un database raggiungibile. */
export function getDb(): PrismaClient {
  if (globalForPrisma.beatsPrisma) return globalForPrisma.beatsPrisma;
  const connectionString = storeEnv.databaseUrl;
  if (!connectionString) throw new Error("DATABASE_URL non impostato");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  // In sviluppo l'hot reload ricarica i moduli: riusa la stessa connessione.
  globalForPrisma.beatsPrisma = client;
  return client;
}
