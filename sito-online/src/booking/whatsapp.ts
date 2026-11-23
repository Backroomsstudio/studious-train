import { serverConfig, whatsappConfigured } from "./server-config.ts";
import { whatsappText, type Order } from "./order.ts";

/**
 * Messaggio WhatsApp automatico allo studio a ogni prenotazione confermata (contanti o pagata online).
 * Usa CallMeBot: il numero dello studio attiva il servizio una volta e riceve la chiave (WHATSAPP_APIKEY).
 * Se la chiave manca il messaggio viene saltato: la prenotazione resta comunque nel calendario.
 */
export async function notifyWhatsApp(order: Order, headline: string) {
  if (!whatsappConfigured) {
    console.warn(`[whatsapp] non configurato, messaggio non inviato: ${headline}`);
    return;
  }
  const url = new URL("https://api.callmebot.com/whatsapp.php");
  url.searchParams.set("phone", serverConfig.whatsappPhone);
  url.searchParams.set("text", whatsappText(order, headline));
  url.searchParams.set("apikey", serverConfig.whatsappApiKey);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body = await res.text();
    // CallMeBot risponde sempre con una pagina: l'errore si capisce dal testo.
    if (!res.ok || /error|invalid|not\s+activated/i.test(body)) console.error("[whatsapp] invio fallito", res.status, body.replace(/<[^>]+>/g, " ").slice(0, 200));
  } catch (e) {
    // Un messaggio non partito non deve far fallire la prenotazione.
    console.error("[whatsapp] invio fallito", e);
  }
}
