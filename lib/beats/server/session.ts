import "server-only";
import { createHash } from "node:crypto";
import { connection } from "next/server";
import { auth } from "./auth";
import { DEMO_USER_ID } from "./demo-backend";
import { storeEnv } from "./env";
import { StoreError } from "./errors";

/** Id dell'utente collegato; in demo c'è sempre l'utente dimostrativo. */
export async function currentUserId(): Promise<string | null> {
  // Tutto ciò che dipende dall'utente si genera a ogni richiesta, anche in demo (niente prerender).
  await connection();
  if (storeEnv.demoMode) return DEMO_USER_ID;
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new StoreError("UNAUTHENTICATED");
  return id;
}

/** IP anonimizzato (hash con sale) per i log dei download: utile contro gli abusi, nessun dato personale in chiaro. */
export function hashIp(request: Request): string | undefined {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  if (!ip) return undefined;
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "beats"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}
