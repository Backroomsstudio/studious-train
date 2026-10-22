/**
 * Autenticazione con Auth.js v5:
 * - email + password personale (hash scrypt nel DB, vedi `password.ts`);
 * - opzionali: Google e link magico via email (Resend), se configurati.
 * Le credenziali richiedono sessioni JWT (cookie firmato e cifrato, httpOnly); l'id utente
 * viaggia nel token e il saldo resta sempre letto dal database.
 * La configurazione è "pigra": Prisma viene inizializzato solo alla prima richiesta.
 */
import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { z } from "zod";
import { storeEnv } from "./env";
import { verifyPassword } from "./password";
import { getDb } from "./prisma";

export const SIGN_IN_PATH = "/beats/accedi";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

function providers(): NextAuthConfig["providers"] {
  const list: NextAuthConfig["providers"] = [];
  if (!storeEnv.demoMode) {
    list.push(
      Credentials({
        credentials: { email: { type: "email" }, password: { type: "password" } },
        async authorize(raw) {
          const parsed = credentialsSchema.safeParse(raw);
          if (!parsed.success) return null;
          const user = await getDb().user.findUnique({ where: { email: parsed.data.email } });
          if (!(await verifyPassword(parsed.data.password, user?.passwordHash))) return null;
          return { id: user!.id, name: user!.artistName ?? user!.name, email: user!.email };
        },
      }),
    );
  }
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) list.push(Google);
  if (process.env.AUTH_RESEND_KEY) {
    list.push(Resend({ from: process.env.AUTH_EMAIL_FROM ?? "Backrooms Beat Store <beats@backroomsstudio.it>" }));
  }
  return list;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  // In demo il database non c'è: Auth.js resta configurato ma senza provider.
  adapter: storeEnv.demoMode ? undefined : PrismaAdapter(getDb() as never),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: providers(),
  pages: { signIn: SIGN_IN_PATH },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? (storeEnv.demoMode ? "demo-only-auth-secret" : undefined),
}));

export function availableProviders(): Array<{ id: string; name: string }> {
  return [
    ...(storeEnv.demoMode ? [] : [{ id: "credentials", name: "Email e password" }]),
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [{ id: "google", name: "Google" }] : []),
    ...(process.env.AUTH_RESEND_KEY ? [{ id: "resend", name: "Email" }] : []),
  ];
}
