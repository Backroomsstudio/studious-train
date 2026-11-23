import { serverConfig, telegramConfigured } from "./server-config.ts";
import { telegramText, type Order } from "./order.ts";

/**
 * Messaggio Telegram automatico allo studio a ogni prenotazione confermata (contanti o pagata online).
 * Gratis: un bot creato con @BotFather (TELEGRAM_BOT_TOKEN) scrive alle chat in TELEGRAM_CHAT_ID.
 * Ogni destinatario deve aver scritto /start al bot almeno una volta.
 * Se manca la configurazione il messaggio viene saltato: la prenotazione resta comunque nel calendario.
 */
export async function notifyTelegram(order: Order, headline: string) {
  if (!telegramConfigured) {
    console.warn(`[telegram] non configurato, messaggio non inviato: ${headline}`);
    return;
  }
  const text = telegramText(order, headline);
  await Promise.all(
    serverConfig.telegramChatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${serverConfig.telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) console.error(`[telegram] invio a ${chatId} fallito`, res.status, (await res.text()).slice(0, 200));
      } catch (e) {
        // Un messaggio non partito non deve far fallire la prenotazione.
        console.error(`[telegram] invio a ${chatId} fallito`, e);
      }
    }),
  );
}

/** Per /api/stato: controlla il token e chiede a Telegram il nome del bot. */
export async function telegramBotName(): Promise<string> {
  const res = await fetch(`https://api.telegram.org/bot${serverConfig.telegramToken}/getMe`, { signal: AbortSignal.timeout(8_000) });
  const json = (await res.json()) as { ok: boolean; result?: { username?: string } };
  if (!json.ok) throw new Error(String(res.status));
  return json.result?.username ?? "bot";
}
