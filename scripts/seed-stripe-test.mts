// Crea in MODALITÀ TEST gli stessi prodotti (con gli stessi metadata) e i payment link dell'Appendice B.
// Uso: npm run sistema:seed-stripe. Rifiuta di partire con una chiave live. Rilanciabile: riusa i prodotti già creati.
import type Stripe from "stripe";
import { env } from "../netlify/functions/_lib/config.mts";
import { stripe } from "../netlify/functions/_lib/stripe.mts";
import { leggi, scrivi } from "../netlify/functions/_lib/sheets.mts";
import { sistema } from "../netlify/functions/_lib/sistema.mts";

if (!/^(sk|rk)_test_/.test(env("STRIPE_SECRET_KEY"))) throw new Error("Serve una chiave di TEST (sk_test_...).");

const PRODOTTI: { nome: string; euro: number; metadata: Record<string, string> }[] = [
  { nome: "ZINCO · 1 pezzo finito", euro: 180, metadata: { linea: "pacchetto", pezzi: "1" } },
  { nome: "SMERALDO · 2 pezzi finiti", euro: 280, metadata: { linea: "pacchetto", pezzi: "2" } },
  { nome: "ZAFFIRO · 3 pezzi finiti", euro: 370, metadata: { linea: "pacchetto", pezzi: "3" } },
  ...(["sessione", "beat", "mix_master"] as const).flatMap((servizio) =>
    ([3, 5, 10] as const).map((q) => ({
      nome: {
        sessione: `Blocco ${q} sessioni in sala (1 h)`,
        beat: `Blocco ${q} beat su misura`,
        mix_master: `Blocco ${q} mix e master`,
      }[servizio],
      euro: { sessione: { 3: 195, 5: 305, 10: 595 }, beat: { 3: 205, 5: 325, 10: 635 }, mix_master: { 3: 220, 5: 350, 10: 680 } }[servizio][q],
      metadata: { linea: "blocco", servizio, quantita: String(q) },
    })),
  ),
];

const s = stripe();
const esistenti = (await s.products.list({ active: true, limit: 100, expand: ["data.default_price"] })).data;
const prezzi: Record<string, string> = {};
for (const p of PRODOTTI) {
  let prod = esistenti.find((e) => e.name === p.nome);
  if (!prod) {
    prod = await s.products.create({
      name: p.nome,
      metadata: p.metadata,
      default_price_data: { currency: "eur", unit_amount: p.euro * 100 },
      expand: ["default_price"],
    });
  }
  prezzi[p.nome] = (prod.default_price as Stripe.Price).id;
}

async function creaLink(nome: string, prezziLink: string[], metadata: Record<string, string> = {}) {
  const base = {
    line_items: prezziLink.map((price) => ({ price, quantity: 1 })),
    phone_number_collection: { enabled: true },
    customer_creation: "always",
    metadata,
    after_completion: {
      type: "redirect",
      redirect: { url: `https://wa.me/393248911607?text=${encodeURIComponent("Ciao! Ho appena pagato " + nome)}` },
    },
  } as Stripe.PaymentLinkCreateParams;
  try {
    return await s.paymentLinks.create({ ...base, name_collection: { individual: { enabled: true } } } as Stripe.PaymentLinkCreateParams);
  } catch (e) {
    console.warn(`name_collection non accettato (${(e as Error).message}): creo il link senza.`);
    return s.paymentLinks.create(base);
  }
}

const link: Record<string, string> = {};
for (const p of PRODOTTI) link[p.nome] = (await creaLink(p.nome, [prezzi[p.nome]])).url;
link["Proposta Diego (ZAFFIRO + Blocco 10 sessioni)"] = (
  await creaLink("proposta Diego", [prezzi["ZAFFIRO · 3 pezzi finiti"], prezzi["Blocco 10 sessioni in sala (1 h)"]], {
    linea: "proposta", cliente: "Diego Giacintucci", crm_id: "C0002",
  })
).url;

for (const [nome, url] of Object.entries(link)) console.log(`${nome.padEnd(48)} ${url}`);

// Nel foglio Sistema di TEST i link dei pacchetti puntano ai link di test.
const [config] = await leggi(sistema(), ["Config!A2:A"]);
const aggiorna = { LINK_ZINCO: "ZINCO · 1 pezzo finito", LINK_SMERALDO: "SMERALDO · 2 pezzi finiti", LINK_ZAFFIRO: "ZAFFIRO · 3 pezzi finiti" };
await scrivi(
  sistema(),
  config.flatMap((r, i) => {
    const k = String(r[0]) as keyof typeof aggiorna;
    return aggiorna[k] ? [{ range: `Config!B${i + 2}`, values: [[link[aggiorna[k]]]] }] : [];
  }),
);
console.log("Link di test scritti nel tab Config del foglio Sistema.");
