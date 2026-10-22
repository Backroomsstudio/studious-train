"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { z } from "zod";
import { signIn } from "@/lib/beats/server/auth";
import { storeEnv } from "@/lib/beats/server/env";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/lib/beats/server/password";
import { getDb } from "@/lib/beats/server/prisma";

export interface AuthFormState {
  error?: string;
  fields?: { email?: string; artistName?: string };
}

/** Limite di tentativi per indirizzo + IP (in memoria: basta contro i tentativi a raffica). */
const attempts = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

async function throttleKey(email: string) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${email}|${ip}`;
}

function isThrottled(key: string) {
  const entry = attempts.get(key);
  return Boolean(entry && entry.until > Date.now() && entry.count >= MAX_ATTEMPTS);
}

function recordFailure(key: string) {
  const entry = attempts.get(key);
  const fresh = !entry || entry.until <= Date.now();
  attempts.set(key, { count: fresh ? 1 : entry.count + 1, until: fresh ? Date.now() + WINDOW_MS : entry.until });
}

async function signInWithPassword(email: string, password: string, redirectTo: string): Promise<AuthFormState | never> {
  try {
    await signIn("credentials", { email, password, redirectTo });
    return {};
  } catch (error) {
    // Il redirect di successo è un'eccezione di Next: va rilanciato.
    if (error instanceof AuthError) return { error: "Email o password non corretti.", fields: { email } };
    throw error;
  }
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Inserisci un'email valida."),
  password: z.string().min(1, "Inserisci la password."),
});

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (storeEnv.demoMode) return { error: "Modalità demo: l'accesso con password si attiva con il database." };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields: { email: String(formData.get("email") ?? "") } };

  const key = await throttleKey(parsed.data.email);
  if (isThrottled(key)) return { error: "Troppi tentativi. Riprova tra qualche minuto.", fields: { email: parsed.data.email } };
  const result = await signInWithPassword(parsed.data.email, parsed.data.password, "/beats");
  if (result.error) recordFailure(key);
  return result;
}

const signupSchema = z
  .object({
    artistName: z
      .string()
      .trim()
      .min(2, "Il nome d'artista deve avere almeno 2 caratteri.")
      .max(32, "Il nome d'artista può avere al massimo 32 caratteri."),
    email: z.string().trim().toLowerCase().email("Inserisci un'email valida.").max(254),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `La password deve avere almeno ${PASSWORD_MIN_LENGTH} caratteri.`)
      .max(200)
      .regex(/[A-Za-z]/, "La password deve contenere almeno una lettera.")
      .regex(/\d/, "La password deve contenere almeno un numero."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Le due password non coincidono.", path: ["confirm"] });

export async function signupAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = Object.fromEntries(["artistName", "email", "password", "confirm"].map((k) => [k, String(formData.get(k) ?? "")]));
  const fields = { email: raw.email, artistName: raw.artistName };
  if (storeEnv.demoMode) return { error: "Modalità demo: la registrazione si attiva con il database.", fields };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields };

  const db = getDb();
  const { artistName, email, password } = parsed.data;
  // Mai aggiungere una password a un profilo esistente da qui: chi conosce solo l'email
  // potrebbe impossessarsi di un account creato con Google o con il link email.
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "Esiste già un profilo con questa email: accedi.", fields };

  // Invito: si collega a chi ha invitato; i crediti arrivano al primo pagamento (vedi rewardReferral).
  const inviteCode = String(formData.get("invite") ?? "").trim().toUpperCase().slice(0, 16);
  const inviter = inviteCode ? await db.user.findUnique({ where: { referralCode: inviteCode }, select: { id: true } }) : null;

  try {
    await db.user.create({
      data: {
        email,
        artistName,
        name: artistName,
        passwordHash: await hashPassword(password),
        referredById: inviter?.id,
      },
    });
  } catch {
    // Due registrazioni contemporanee con la stessa email: vince la prima (email unica nel DB).
    return { error: "Esiste già un profilo con questa email: accedi.", fields };
  }
  return signInWithPassword(email, password, "/beats?benvenuto=1");
}
