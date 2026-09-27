// Prende gli eventi Stripe di TEST delle ultime 24 ore e li manda, firmati, al webhook locale.
// Sostituisce "stripe listen": non serve installare la Stripe CLI né fare login.
// Uso: npm run sistema:eventi                 → tutti gli eventi utili delle ultime 24 ore
//      npm run sistema:eventi -- evt_123 2    → solo quell'evento, inviato 2 volte (test dei doppioni)
import { env } from "../netlify/functions/_lib/config.mts";
import { stripe } from "../netlify/functions/_lib/stripe.mts";

if (!/^(sk|rk)_test_/.test(env("STRIPE_SECRET_KEY"))) throw new Error("Solo in modalità test.");

const TIPI = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "charge.refunded",
];
const [soloId, volte = "1"] = process.argv.slice(2);
const s = stripe();
const eventi = soloId
  ? [await s.events.retrieve(soloId)]
  : (await s.events.list({ types: TIPI, limit: 50, created: { gte: Math.floor(Date.now() / 1000) - 86400 } })).data.reverse();

for (const ev of eventi) {
  for (let i = 0; i < Number(volte); i++) {
    const payload = JSON.stringify(ev);
    const firma = s.webhooks.generateTestHeaderString({ payload, secret: env("STRIPE_WEBHOOK_SECRET") });
    const r = await fetch("http://localhost:8888/.netlify/functions/stripe-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": firma },
      body: payload,
    });
    console.log(`${ev.id} ${ev.type} → ${r.status} ${await r.text()}`);
  }
}
