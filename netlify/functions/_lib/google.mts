// Accesso a Google con l'account di servizio: token firmato con node:crypto, chiamate REST con fetch.
import { createSign } from "node:crypto";
import { env } from "./config.mts";

const SCOPE = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

let chiave: { client_email: string; private_key: string } | null = null;
let token: { valore: string; scade: number } | null = null;

export function credenziali() {
  chiave ??= JSON.parse(Buffer.from(env("GOOGLE_SERVICE_ACCOUNT_JSON"), "base64").toString("utf8"));
  return chiave!;
}

async function accessToken(): Promise<string> {
  if (token && token.scade > Date.now() + 60_000) return token.valore;
  const { client_email, private_key } = credenziali();
  const ora = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const corpo = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: client_email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: ora,
    exp: ora + 3600,
  })}`;
  const firma = createSign("RSA-SHA256").update(corpo).sign(private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${corpo}.${firma}`,
    }),
  });
  if (!res.ok) throw new Error(`Google auth ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { valore: j.access_token, scade: Date.now() + j.expires_in * 1000 };
  return token.valore;
}

export type ErroreGoogle = Error & { stato?: number };

export async function google<T = unknown>(url: string, metodo = "GET", corpo?: unknown): Promise<T> {
  for (let tentativo = 0; ; tentativo++) {
    const res = await fetch(url, {
      method: metodo,
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (res.ok) return (await res.json()) as T;
    // Quota o errore temporaneo: un solo nuovo tentativo dopo 1,5 secondi.
    if ((res.status === 429 || res.status >= 500) && tentativo === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    const e: ErroreGoogle = new Error(`Google ${res.status}: ${(await res.text()).slice(0, 300)}`);
    e.stato = res.status;
    throw e;
  }
}
