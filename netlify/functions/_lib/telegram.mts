// Messaggi a Luca su Telegram. Il bot scrive solo a TELEGRAM_CHAT_ID e non legge niente.
import { env } from "./config.mts";
import { normTel } from "./match.mts";

const MAX = 4000; // Telegram accetta 4.096 caratteri: teniamo un margine.

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const link = (href: string, testo: string) => `<a href="${esc(href)}">${esc(testo)}</a>`;

// Link WhatsApp con il messaggio già scritto; senza telefono Luca sceglie il contatto.
export function linkWa(telefono: unknown, messaggio: string): string {
  const t = normTel(telefono);
  return `https://wa.me/${t}?text=${encodeURIComponent(messaggio)}`;
}

function spezza(html: string): string[] {
  const pezzi: string[] = [];
  let corrente = "";
  for (const riga of html.split("\n")) {
    if (corrente && corrente.length + riga.length + 1 > MAX) {
      pezzi.push(corrente);
      corrente = "";
    }
    corrente = corrente ? `${corrente}\n${riga}` : riga.slice(0, MAX);
  }
  if (corrente) pezzi.push(corrente);
  return pezzi;
}

export async function inviaTelegram(html: string) {
  const url = `https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/sendMessage`;
  for (const pezzo of spezza(html)) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env("TELEGRAM_CHAT_ID"),
        text: pezzo,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

// Un avviso non deve mai far fallire la scrittura dei dati.
export async function avvisaSenzaErrori(html: string) {
  try {
    await inviaTelegram(html);
  } catch (e) {
    console.error("telegram: invio non riuscito", (e as Error).message);
  }
}
