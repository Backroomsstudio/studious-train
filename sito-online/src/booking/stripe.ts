import Stripe from "stripe";
import { serverConfig } from "./server-config.ts";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!serverConfig.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY mancante");
  client ??= new Stripe(serverConfig.stripeSecretKey);
  return client;
}
