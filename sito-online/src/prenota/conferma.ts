/**
 * Pagina /prenota/confermata/ al ritorno da Stripe: chiede al server il riepilogo dell'ordine
 * e lo mostra nel pop-up di conferma. Se qualcosa non va resta il testo della pagina.
 */
import type { OrderRecap } from "../booking/order.ts";
import { showRecap } from "./recap.ts";

async function init() {
  const sessionId = new URLSearchParams(location.search).get("session_id");
  if (!sessionId) return;
  try {
    const res = await fetch(`/api/riepilogo?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { riepilogo?: OrderRecap };
    if (!json.riepilogo) return;
    const btn = document.getElementById("ok-recap");
    if (btn) {
      btn.hidden = false;
      btn.addEventListener("click", () => showRecap(json.riepilogo!));
    }
    showRecap(json.riepilogo);
  } catch {
    // resta il testo statico della pagina
  }
}

void init();
