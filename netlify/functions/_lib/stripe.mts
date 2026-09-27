// Client Stripe e lettura dei prodotti dai metadata (linea / pezzi / servizio / quantita).
import Stripe from "stripe";
import { env } from "./config.mts";
import type { Prodotto } from "./registro.mts";

let client: Stripe | null = null;
export const stripe = () => (client ??= new Stripe(env("STRIPE_SECRET_KEY")));

export const idBreve = (sessionId: string) => sessionId.slice(-10);
export const tagStripe = (sessionId: string) => `[AUTO-STRIPE ${idBreve(sessionId)}]`;

const NOMI_BLOCCO = { sessione: "sessioni", beat: "beat", mix_master: "mix e master" } as const;

export function prodottiDa(items: Stripe.LineItem[]): { prodotti: Prodotto[]; sconosciuti: { nome: string; importo: number }[] } {
  const prodotti: Prodotto[] = [];
  const sconosciuti: { nome: string; importo: number }[] = [];
  for (const it of items) {
    const prod = it.price?.product as Stripe.Product | undefined;
    const md = prod?.metadata ?? {};
    const qta = it.quantity ?? 1;
    const nome = prod?.name ?? it.description ?? "prodotto";
    if (md.linea === "pacchetto" && Number(md.pezzi) > 0) {
      prodotti.push({
        linea: "pacchetto",
        etichetta: nome.split("·")[0].trim().toUpperCase(),
        pezzi: Number(md.pezzi) * qta,
        servizio: null,
        quantita: 0,
        importo: it.amount_total,
      });
    } else if (md.linea === "blocco" && md.servizio && md.servizio in NOMI_BLOCCO && Number(md.quantita) > 0) {
      const servizio = md.servizio as keyof typeof NOMI_BLOCCO;
      const quantita = Number(md.quantita) * qta;
      prodotti.push({
        linea: "blocco",
        etichetta: `Blocco ${quantita} ${NOMI_BLOCCO[servizio]}`,
        pezzi: 0,
        servizio,
        quantita,
        importo: it.amount_total,
      });
    } else {
      sconosciuti.push({ nome, importo: it.amount_total });
    }
  }
  return { prodotti, sconosciuti };
}

// Nome raccolto da name_collection.individual (API 2025-09-30.clover e successive), poi i ripieghi.
export function nomeCliente(s: Stripe.Checkout.Session): string {
  const cd = s.customer_details as (Stripe.Checkout.Session.CustomerDetails & { individual_name?: string | null }) | null;
  const ci = (s as unknown as { collected_information?: { individual_name?: string | null } }).collected_information;
  return (
    cd?.individual_name || ci?.individual_name || cd?.name || s.metadata?.cliente || cd?.email || "Cliente Stripe"
  ).trim();
}
