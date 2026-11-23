import { createSign } from "node:crypto";
import { serverConfig } from "./server-config.ts";
import type { Interval } from "./slots.ts";

/**
 * Client minimo di Google Calendar con account di servizio (JWT firmato con la chiave privata).
 * Il calendario dello studio va condiviso con l'email dell'account di servizio con il permesso
 * "Apportare modifiche agli eventi".
 */

const API = "https://www.googleapis.com/calendar/v3";
let cachedToken: { value: string; expiresAt: number } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: serverConfig.googleClientEmail,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(serverConfig.googlePrivateKey));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export class CalendarError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new CalendarError(`Google Calendar ${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`, res.status);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Intervalli occupati su tutti i calendari configurati (solo inizio/fine: nessun dettaglio esce dal server). */
export async function busyIntervals(timeMin: Date, timeMax: Date): Promise<Interval[]> {
  const json = await call<{ calendars: Record<string, { busy?: Interval[]; errors?: unknown[] }> }>("/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: "Europe/Rome",
      items: serverConfig.busyCalendarIds.map((id) => ({ id })),
    }),
  });
  const out: Interval[] = [];
  for (const [id, cal] of Object.entries(json.calendars ?? {})) {
    if (cal.errors?.length) throw new Error(`Calendario non leggibile: ${id} ${JSON.stringify(cal.errors)}`);
    out.push(...(cal.busy ?? []));
  }
  return out.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  colorId?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  created?: string;
  status?: string;
  /** "transparent" = segnato come Disponibile: non occupa la sala */
  transparency?: string;
  reminders?: { useDefault: boolean; overrides?: { method: "popup" | "email"; minutes: number }[] };
  extendedProperties?: { private?: Record<string, string> };
}

const enc = encodeURIComponent;

export function insertEvent(event: CalendarEvent): Promise<CalendarEvent> {
  return call(`/calendars/${enc(serverConfig.calendarId)}/events`, { method: "POST", body: JSON.stringify(event) });
}

export function patchEvent(eventId: string, patch: Partial<CalendarEvent>): Promise<CalendarEvent> {
  return call(`/calendars/${enc(serverConfig.calendarId)}/events/${enc(eventId)}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function getEvent(eventId: string): Promise<CalendarEvent> {
  return call(`/calendars/${enc(serverConfig.calendarId)}/events/${enc(eventId)}`);
}

export async function deleteEvent(eventId: string): Promise<void> {
  try {
    await call(`/calendars/${enc(serverConfig.calendarId)}/events/${enc(eventId)}`, { method: "DELETE" });
  } catch (e) {
    if (e instanceof CalendarError && (e.status === 404 || e.status === 410)) return; // già cancellato
    throw e;
  }
}

/** Eventi del calendario delle prenotazioni con una certa proprietà privata (es. chi ha già fatto la prova). */
export async function eventsWithPrivate(key: string, value: string): Promise<CalendarEvent[]> {
  const q = new URLSearchParams({ privateExtendedProperty: `${key}=${value}`, maxResults: "5", singleEvents: "true" });
  const json = await call<{ items?: CalendarEvent[] }>(`/calendars/${enc(serverConfig.calendarId)}/events?${q}`);
  return (json.items ?? []).filter((e) => e.status !== "cancelled");
}

/** Eventi del calendario delle prenotazioni che si sovrappongono a un intervallo. */
export async function eventsBetween(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
  const q = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: "true", maxResults: "50" });
  const json = await call<{ items?: CalendarEvent[] }>(`/calendars/${enc(serverConfig.calendarId)}/events?${q}`);
  return (json.items ?? []).filter((e) => e.status !== "cancelled");
}
