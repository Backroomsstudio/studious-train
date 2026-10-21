/**
 * Autenticazione con Auth.js v5: Google e link magico via email (Resend), sessioni su database.
 * La configurazione è "pigra": Prisma viene inizializzato solo alla prima richiesta.
 */
import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { storeEnv } from "./env";
import { getDb } from "./prisma";

export const SIGN_IN_PATH = "/beats/accedi";

function providers(): NextAuthConfig["providers"] {
  const list: NextAuthConfig["providers"] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) list.push(Google);
  if (process.env.AUTH_RESEND_KEY) {
    list.push(Resend({ from: process.env.AUTH_EMAIL_FROM ?? "Backrooms Beat Store <beats@backroomsstudio.it>" }));
  }
  return list;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  // In demo il database non c'è: Auth.js resta configurato ma senza provider.
  adapter: storeEnv.demoMode ? undefined : PrismaAdapter(getDb() as never),
  session: { strategy: storeEnv.demoMode ? "jwt" : "database" },
  providers: providers(),
  pages: { signIn: SIGN_IN_PATH },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? (storeEnv.demoMode ? "demo-only-auth-secret" : undefined),
}));

export function availableProviders(): Array<{ id: string; name: string }> {
  return [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [{ id: "google", name: "Google" }] : []),
    ...(process.env.AUTH_RESEND_KEY ? [{ id: "resend", name: "Email" }] : []),
  ];
}
