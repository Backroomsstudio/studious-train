// Webhook Stripe: ogni pagamento finisce da solo in Registro, CRM (+ VENDITE) e Saldi; i rimborsi con righe negative.
// Risponde 200 solo dopo aver scritto tutto; in caso di errore 500, così Stripe riprova (ogni passo è idempotente).
import type Stripe from "stripe";
import { configDa, env } from "./_lib/config.mts";
import { daSecondi, iso, nomeRegistro } from "./_lib/date.mts";
import { accoda, leggi, scrivi } from "./_lib/sheets.mts";
import { centesimi, euro, proporziona, testo } from "./_lib/match.mts";
import {
  RANGE_CRM, RANGE_SERVIZI_VENDITE, RANGE_VENDITE,
  scriviVendite, servizioVendite, trovaOCreaCliente, type RigaVendita,
} from "./_lib/crm.mts";
import {
  leggiMese, listinoDa, righeDaProdotto, scriviRegistro, type EsitoRegistro, type RigaRegistro,
} from "./_lib/registro.mts";
import { S, daTrascrivere, logEvento, saldiDellaSessione, sistema } from "./_lib/sistema.mts";
import { idBreve, nomeCliente, prodottiDa, stripe, tagStripe } from "./_lib/stripe.mts";
import { avvisaSenzaErrori, esc, link, linkWa } from "./_lib/telegram.mts";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Metodo non consentito", { status: 405 });

  // Firma verificata sul corpo grezzo (le functions v2 ricevono il body così com'è, senza base64).
  const corpo = Buffer.from(await req.arrayBuffer());
  let evento: Stripe.Event;
  try {
    evento = stripe().webhooks.constructEvent(corpo, req.headers.get("stripe-signature") ?? "", env("STRIPE_WEBHOOK_SECRET"));
  } catch {
    console.warn("stripe-webhook: firma non valida");
    return new Response("Firma non valida", { status: 400 });
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = evento.data.object;
        if (s.payment_status !== "paid") {
          console.log(`stripe-webhook ${evento.id}: sessione non ancora pagata, aspetto async_payment_succeeded`);
          break;
        }
        await registraPagamento(evento.id, s.id);
        break;
      }
      case "checkout.session.async_payment_failed":
        await pagamentoFallito(evento.id, evento.data.object);
        break;
      case "charge.refunded":
        await registraRimborsi(evento.id, evento.data.object);
        break;
    }
    return new Response("ok");
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`stripe-webhook ${evento.id}: errore`, msg);
    await avvisaSenzaErrori(
      `🛑 Errore nel registrare un evento Stripe (${esc(evento.type)}, ${esc(evento.id)}). Stripe riproverà da solo.\n<code>${esc(msg.slice(0, 300))}</code>`,
    );
    return new Response("Errore: Stripe riproverà", { status: 500 });
  }
};

async function registraPagamento(eventoId: string, sessionId: string) {
  const [[log, cfgCelle, saldi], s] = await Promise.all([
    leggi(sistema(), ["Log_Eventi!B2:E", "Config!A2:B", "Saldi!A2:R"]),
    stripe().checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product", "payment_intent.latest_charge"],
    }),
  ]);
  if (log.some((r) => r[0] === eventoId || (r[1] === sessionId && r[2] === "pagamento" && r[3] === "ok"))) {
    console.log(`stripe-webhook ${eventoId}: già registrato`);
    return;
  }

  const cfg = configDa(cfgCelle);
  const tag = tagStripe(sessionId);
  const { prodotti, sconosciuti } = prodottiDa(s.line_items?.data ?? []);
  const charge = ((s.payment_intent as Stripe.PaymentIntent | null)?.latest_charge ?? null) as Stripe.Charge | null;
  const tipoMetodo = charge?.payment_method_details?.type ?? "sconosciuto";
  const metodo = tipoMetodo === "card" ? "Carta" : "Altro";
  const notaMetodo = metodo === "Altro" ? ` · pagato con ${tipoMetodo}` : "";
  const data = daSecondi(charge?.created ?? s.created);
  const foglio = nomeRegistro(data);
  const incassatoDa = env("STRIPE_INCASSATO_DA");
  const totale = s.amount_total ?? 0;

  const [[listinoCelle], mese, [crmCelle, serviziCelle, venditeCelle]] = await Promise.all([
    leggi(env("SHEET_CONTABILITA_ID"), ["'Listino Servizi'!A5:B20"]),
    leggiMese(foglio),
    leggi(env("SHEET_CRM_ID"), [RANGE_CRM, RANGE_SERVIZI_VENDITE, RANGE_VENDITE]),
  ]);

  const cd = s.customer_details;
  const cliente = await trovaOCreaCliente(
    crmCelle,
    { crmId: s.metadata?.crm_id, telefono: cd?.phone, email: cd?.email, nome: nomeCliente(s) },
    data,
    "Stripe",
  );

  // Registro: le righe di tutti i prodotti; i nomi dei servizi devono esistere nel Listino (letto ogni volta).
  const riga = (servizio: string, importo: number, descrizione: string): RigaRegistro => ({
    data, cliente: cliente.nome, servizio, importo, stato: "PAGATO", incassatoDa, metodo,
    note: `${tag} ${descrizione}${notaMetodo}`,
  });
  const righe = prodotti.flatMap((p) => righeDaProdotto(p, cfg).map((r) => riga(r.servizio, r.importo, r.descrizione)));
  const listino = new Set(listinoDa(listinoCelle).map((l) => l.nome));
  const fuoriListino = [...new Set(righe.map((r) => r.servizio).filter((n) => !listino.has(n)))];
  const problemi: string[] = [];

  let esito: EsitoRegistro | null = null;
  if (righe.length) {
    esito = fuoriListino.length
      ? { foglio, motivo: `servizi non presenti nel Listino: ${fuoriListino.join(", ")}` }
      : await scriviRegistro(righe, tag, mese);
    if ("motivo" in esito) {
      await daTrascrivere(righe, foglio, esito.motivo);
      problemi.push(`Registro: ${esito.motivo}. Le righe sono in Sistema → Da_trascrivere.`);
    }
  }
  if (sconosciuti.length) {
    await daTrascrivere(
      sconosciuti.map((x) => riga(x.nome, x.importo, "prodotto senza metadata")),
      foglio,
      "prodotto Stripe senza metadata linea/pezzi/servizio",
    );
    problemi.push(`Prodotti non riconosciuti (${sconosciuti.map((x) => x.nome).join(", ")}): trascrivili da Sistema → Da_trascrivere.`);
  }
  const somma = righe.reduce((a, r) => a + r.importo, 0) + sconosciuti.reduce((a, x) => a + x.importo, 0);
  if (somma !== totale) problemi.push(`La somma delle righe (${euro(somma)} €) è diversa dal totale pagato (${euro(totale)} €).`);

  // VENDITE (una riga per prodotto) e Saldi (un saldo per pacchetto o blocco).
  const lista = serviziCelle.map((r) => String(r[0] ?? "").trim()).filter(Boolean);
  const vendite: RigaVendita[] = prodotti.map((p) => ({
    data, crmId: cliente.id, servizio: servizioVendite(p, lista), importo: p.importo, stato: "PAGATO",
    nota: `${tag} ${p.etichetta}${notaMetodo}`, origine: "Stripe (automatico)",
  }));
  const tot = (p: (typeof prodotti)[number], serv: string) =>
    p.linea === "pacchetto" ? p.pezzi : p.servizio === serv ? p.quantita : 0;
  const nuoviSaldi = saldiDellaSessione(saldi, sessionId).length
    ? []
    : prodotti.map((p, i) => [
        `S-${data.toFormat("yyMMdd")}-${idBreve(sessionId)}-${i + 1}`, iso(data), cliente.id, testo(cliente.nome),
        cliente.telefono ? `'${cliente.telefono}` : "", p.etichetta, p.importo / 100,
        tot(p, "sessione"), 0, tot(p, "beat"), 0, tot(p, "mix_master"), 0,
        "aperto", "", iso(data), sessionId, "",
      ]);
  await Promise.all([
    vendite.length ? scriviVendite(venditeCelle, vendite, tag) : null,
    accoda(sistema(), "Saldi!A:R", nuoviSaldi),
  ]);

  const dove = esito && "righe" in esito
    ? `Registrato in «${esito.foglio}», ${esito.righe.length === 1 ? "riga" : "righe"} ${esito.righe.join(", ")}.`
    : "⚠️ Non scritto nel Registro.";
  await logEvento(eventoId, sessionId, "pagamento", "ok", dove);

  const nomiProdotti = [...prodotti.map((p) => p.etichetta), ...sconosciuti.map((x) => x.nome)].join(" + ");
  const testoWa = `Ciao ${cliente.nome}, grazie! Hai preso ${nomiProdotti}. Fissiamo la prima sessione? Dimmi quali giorni ti vanno meglio questa settimana.`;
  await avvisaSenzaErrori(
    [
      `💶 <b>Nuovo incasso</b>: ${esc(cliente.nome)} — ${esc(nomiProdotti)} — ${euro(totale)} € (${metodo}${notaMetodo ? `: ${esc(tipoMetodo)}` : ""}).`,
      esc(dove),
      cliente.nuovo ? `👤 Contatto nuovo nel CRM: ${cliente.id}.` : "",
      cliente.doppioni.length
        ? `⚠️ Possibile doppione: «${esc(nomeCliente(s))}» corrisponde a ${cliente.doppioni.join(", ")}. Ho creato ${cliente.id}: controlla.`
        : "",
      ...problemi.map((p) => `⚠️ ${esc(p)}`),
      link(linkWa(cliente.telefono, testoWa), `✍️ Scrivi a ${cliente.nome} su WhatsApp`),
    ].filter(Boolean).join("\n"),
  );
}

async function pagamentoFallito(eventoId: string, s: Stripe.Checkout.Session) {
  const [log] = await leggi(sistema(), ["Log_Eventi!B2:B"]);
  if (log.some((r) => r[0] === eventoId)) return;
  const nome = nomeCliente(s);
  await avvisaSenzaErrori(
    `❌ <b>Pagamento non riuscito</b>: ${esc(nome)} — ${euro(s.amount_total ?? 0)} €. ` +
      link(linkWa(s.customer_details?.phone, `Ciao ${nome}, il pagamento non è andato a buon fine. Vuoi riprovare dallo stesso link?`), "Scrivigli su WhatsApp"),
  );
  await logEvento(eventoId, s.id, "pagamento_fallito", "avvisato", "");
}

async function registraRimborsi(eventoId: string, charge: Stripe.Charge) {
  const [log, saldi] = await leggi(sistema(), ["Log_Eventi!B2:E", "Saldi!A2:R"]);
  if (log.some((r) => r[0] === eventoId)) return;

  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  const [rimborsi, sessioni] = await Promise.all([
    stripe().refunds.list({ charge: charge.id, limit: 100 }),
    piId ? stripe().checkout.sessions.list({ payment_intent: piId, limit: 1 }) : Promise.resolve(null),
  ]);
  const s = sessioni?.data[0];
  if (!s) {
    await logEvento(eventoId, "", "rimborso", "ignorato", "pagamento non fatto da un link Stripe");
    await avvisaSenzaErrori(`↩️ Rimborso di ${euro(charge.amount_refunded)} € su un pagamento che non viene da un link Stripe: registralo a mano.`);
    return;
  }

  const fatti = new Set(log.filter((r) => String(r[2]).startsWith("rimborso re_")).map((r) => String(r[2]).slice(9)));
  const nuovi = rimborsi.data.filter((r) => r.status !== "failed" && r.status !== "canceled" && !fatti.has(r.id)).reverse();
  const tag = tagStripe(s.id);
  const meseAcquisto = nomeRegistro(daSecondi(charge.created));
  const [origMese, [venditeIniziali]] = await Promise.all([
    leggiMese(meseAcquisto),
    leggi(env("SHEET_CRM_ID"), [RANGE_VENDITE]),
  ]);
  const originali = (origMese ?? []).filter((r) => String(r?.[10] ?? "").startsWith(tag));
  const vendOrig = venditeIniziali.filter((r) => String(r?.[8] ?? "").startsWith(tag));
  const cliente = String(originali[0]?.[1] ?? nomeCliente(s));
  const messaggi: string[] = [];

  for (const rf of nuovi) {
    const data = daSecondi(rf.created);
    const tagR = `[AUTO-STRIPE RIMBORSO ${idBreve(s.id)} ${rf.id.slice(-6)}]`;
    let dove: string;
    if (!originali.length) {
      dove = `Non trovo le righe originali (${tag}) in «${meseAcquisto}»: registra il rimborso a mano.`;
    } else {
      const quote = proporziona(originali.map((r) => centesimi(r[3])), rf.amount);
      const righe: RigaRegistro[] = originali.map((r, i) => ({
        data, cliente: String(r[1] ?? ""), servizio: String(r[2] ?? ""), importo: -quote[i], stato: "PAGATO",
        incassatoDa: String(r[5] ?? ""), metodo: String(r[6] ?? ""),
        note: `${tagR} ${String(r[10]).slice(tag.length).trim()}`,
      }));
      const esito = await scriviRegistro(righe, tagR);
      if ("motivo" in esito) {
        await daTrascrivere(righe, esito.foglio, esito.motivo);
        dove = `Registro: ${esito.motivo} (righe in Sistema → Da_trascrivere).`;
      } else {
        dove = `Righe negative in «${esito.foglio}»: ${esito.righe.join(", ")}.`;
      }
    }
    if (vendOrig.length) {
      const [venditeOra] = await leggi(env("SHEET_CRM_ID"), [RANGE_VENDITE]);
      const quote = proporziona(vendOrig.map((r) => centesimi(r[4])), rf.amount);
      await scriviVendite(
        venditeOra,
        vendOrig.map((r, i) => ({
          data, crmId: String(r[1] ?? ""), servizio: String(r[3] ?? "Altro"), importo: -quote[i], stato: "PAGATO",
          nota: `${tagR} rimborso ${String(r[8]).slice(tag.length).trim()}`, origine: "Stripe (automatico)",
        })),
        tagR,
      );
    }
    await logEvento(eventoId, s.id, `rimborso ${rf.id}`, "ok", dove);
    messaggi.push(`↩️ <b>Rimborso</b>: ${esc(cliente)} — ${euro(rf.amount)} €. ${esc(dove)}`);
  }

  // Rimborso totale → i saldi di quell'acquisto vengono annullati.
  if (charge.amount_refunded >= charge.amount) {
    const righeSaldi = saldiDellaSessione(saldi, s.id).filter((n) => saldi[n - 2]?.[S.stato] !== "annullato");
    if (righeSaldi.length) {
      await scrivi(sistema(), righeSaldi.map((n) => ({ range: `Saldi!N${n}`, values: [["annullato"]] })));
      messaggi.push("Rimborso totale: il saldo del pacchetto è stato annullato.");
    }
  }
  if (!nuovi.length) await logEvento(eventoId, s.id, "rimborso", "nessun rimborso nuovo", "");
  if (messaggi.length) await avvisaSenzaErrori(messaggi.join("\n"));
}
