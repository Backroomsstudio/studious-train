// Controllo del setup: variabili, fogli, calendario, Telegram e Stripe. Mostra solo ok/errore, mai valori.
import { CONFIG_DEFAULT, VARIABILI, env } from "./_lib/config.mts";
import { google } from "./_lib/google.mts";
import { nomiFogli } from "./_lib/sheets.mts";
import { TABS } from "./_lib/sistema.mts";
import { stripe } from "./_lib/stripe.mts";

export default async () => {
  const esiti: Record<string, string> = {};
  const mancanti = VARIABILI.filter((v) => !process.env[v]);
  esiti.variabili = mancanti.length ? `mancano: ${mancanti.join(", ")}` : "ok";

  const prova = async (nome: string, fn: () => Promise<string>) => {
    try {
      esiti[nome] = await fn();
    } catch (e) {
      esiti[nome] = `ERRORE: ${(e as Error).message.slice(0, 160)}`;
    }
  };
  const contiene = async (id: string, fogli: string[]) => {
    const presenti = await nomiFogli(id);
    const assenti = fogli.filter((f) => !presenti.includes(f));
    return assenti.length ? `mancano i fogli: ${assenti.join(", ")}` : "ok";
  };

  await Promise.all([
    prova("contabilita", () => contiene(env("SHEET_CONTABILITA_ID"), ["Listino Servizi"])),
    prova("crm", () => contiene(env("SHEET_CRM_ID"), ["CRM", "VENDITE", "IMPOSTAZIONI"])),
    prova("sistema", async () => {
      const r = await contiene(env("SHEET_SISTEMA_ID"), Object.keys(TABS));
      return r === "ok" ? "ok" : `${r} (lancia npm run sistema:setup)`;
    }),
    prova("calendario", async () => {
      const cal = encodeURIComponent(env("CALENDAR_ID"));
      await google(`https://www.googleapis.com/calendar/v3/calendars/${cal}/events?maxResults=1&timeMin=${new Date().toISOString()}`);
      return "ok";
    }),
    prova("telegram", async () => {
      const r = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/getChat?chat_id=${env("TELEGRAM_CHAT_ID")}`);
      return r.ok ? "ok" : `ERRORE ${r.status}: scrivi prima un messaggio al bot`;
    }),
    prova("stripe", async () => {
      const b = await stripe().balance.retrieve();
      return `ok (${b.livemode ? "LIVE" : "modalità test"})`;
    }),
  ]);

  const ok = Object.values(esiti).every((v) => v.startsWith("ok"));
  return Response.json({ ok, esiti, chiavi_config: CONFIG_DEFAULT.length }, { status: ok ? 200 : 500 });
};
