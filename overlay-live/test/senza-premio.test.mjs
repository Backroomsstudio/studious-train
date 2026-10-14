import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../lib/stato.mjs";
import { suoniSenzaPremio, richiesteScheda, suonaIn, suoniTraccia, PAUSA_MIN_TRACCIA_MS } from "../public/js/eventi-sonori.js";
import { vociBarra, breve, stimaGiroSecondi, avanzamentoCoda, MIN_ASCOLTATE } from "../public/js/barra.js";
import { inAttesaInCoda } from "../lib/nero.mjs";
import { prossimaScheda, creaSchedaVuota } from "../public/js/scheda-logica.js";

const config = { giudici: { beat: "A", voce: "B", mix: "C" }, pesi: { beat: 1, voce: 1, mix: 1, chat: 1 }, topN: 3, premio: "Mix" };
const foto = (stato, ora = 0) => structuredClone(S.istantanea(stato, config, ora));
const nomi = (suoni) => suoni.map((s) => s.nome);

function statoSenzaPremio() {
  const stato = S.statoIniziale(config);
  S.impostaLayout(stato, "senzaPremio");
  return stato;
}

test("partenza: i social dello studio nella barra, gara come layout predefinito, nuove parti in onda", () => {
  const stato = S.statoIniziale(config);
  assert.equal(stato.layout, "gara");
  assert.deepEqual(stato.senzaPremio, S.senzaPremioIniziale());
  const sp = stato.senzaPremio;
  assert.deepEqual([sp.sopra, sp.titolo, sp.pillola, sp.link], ["Mandaci", "La tua musica!", "Link in bio", "nero.fan/backrooms"]);
  assert.deepEqual(
    sp.voci.map((v) => [v.icona, v.testo]),
    [
      ["nero", "nero.fan/backrooms"],
      ["instagram+tiktok", "@backrooms.studios"],
      ["twitch", "@backrooms_studio"],
      ["kick", "@backrooms_studio"],
      ["microfono", "backroomsstudio.it"],
    ],
  );
  for (const parte of ["banner", "barra", "scheda"]) assert.equal(stato.visibili[parte], true);
  const istantanea = S.istantanea(stato, config, 0);
  assert.equal(istantanea.layout, "gara");
  assert.equal(istantanea.senzaPremio, stato.senzaPremio);
  assert.equal(istantanea.ascoltate, 0);
});

test("modifiche dalla regia: controllate tutte prima di applicarle", () => {
  const stato = S.statoIniziale(config);
  S.impostaSenzaPremio(stato, { titolo: "  Fatti sentire! ", velocita: 120, durate: { throne: 20 }, suonoTraccia: "pieno", loghiBarra: false });
  assert.equal(stato.senzaPremio.titolo, "Fatti sentire!");
  assert.equal(stato.senzaPremio.velocita, 120);
  assert.deepEqual(stato.senzaPremio.durate, { standard: 8, skip: 10, superskip: 12, throne: 20 });
  assert.equal(stato.senzaPremio.suonoTraccia, "pieno");
  assert.equal(stato.senzaPremio.loghiBarra, false);

  for (const sbagliata of [
    { velocita: 39 },
    { velocita: 161 },
    { durate: { skip: 3 } },
    { durate: { skip: 21 } },
    { durate: { gratis: 8 } },
    { suonoTraccia: "forte" },
    { richiamoOgniMinuti: -1 },
    { richiamoOgniMinuti: 31 },
    { titolo: "" },
    { link: "   " },
    { spot: { titolo: "" } },
    { titolo: "x".repeat(29) },
  ]) {
    assert.throws(() => S.impostaSenzaPremio(stato, sbagliata), Error, JSON.stringify(sbagliata));
  }
  // Una parte giusta e una sbagliata: non cambia niente.
  const prima = structuredClone(stato.senzaPremio);
  assert.throws(() => S.impostaSenzaPremio(stato, { velocita: 60, durate: { throne: 99 } }));
  assert.deepEqual(stato.senzaPremio, prima);
});

test("voci della barra: icone note, testo per le voci accese, al massimo 8 accese", () => {
  const stato = S.statoIniziale(config);
  const voci = [...stato.senzaPremio.voci, { attiva: false, icona: "whatsapp", etichetta: "Prenota", testo: "" }];
  S.impostaSenzaPremio(stato, { voci });
  assert.equal(stato.senzaPremio.voci.length, 6);
  assert.ok(stato.senzaPremio.voci[5].id, "una voce nuova riceve un id");

  assert.throws(() => S.impostaSenzaPremio(stato, { voci: [{ icona: "facebook", testo: "x" }] }), /icona sconosciuta/);
  assert.throws(() => S.impostaSenzaPremio(stato, { voci: [{ icona: "kick", etichetta: "Kick", testo: "" }] }), /manca il testo/);
  assert.throws(() => S.impostaSenzaPremio(stato, { voci: [{ icona: "kick", testo: "x".repeat(41) }] }), /40 caratteri/);
  const nove = Array.from({ length: 9 }, (_, i) => ({ icona: "sito", testo: `voce ${i}` }));
  assert.throws(() => S.impostaSenzaPremio(stato, { voci: nove }), /8 voci accese/);
  const tredici = Array.from({ length: 13 }, (_, i) => ({ icona: "sito", testo: `voce ${i}`, attiva: false }));
  assert.throws(() => S.impostaSenzaPremio(stato, { voci: tredici }), /12 voci/);
});

test("stato salvato da una versione precedente: impostazioni senza premio complete", () => {
  assert.deepEqual(S.fondiSenzaPremio(undefined), S.senzaPremioIniziale());
  assert.deepEqual(S.fondiSenzaPremio("x"), S.senzaPremioIniziale());
  const fuso = S.fondiSenzaPremio({ velocita: 120, durate: { throne: 20 }, voci: "x", suonoTraccia: "boh" });
  assert.equal(fuso.velocita, 120);
  assert.deepEqual(fuso.durate, { standard: 8, skip: 10, superskip: 12, throne: 20 });
  assert.deepEqual(fuso.voci, S.senzaPremioIniziale().voci);
  assert.equal(fuso.suonoTraccia, "delicato");
  assert.deepEqual(fuso.spot, S.senzaPremioIniziale().spot);
});

test("layout in onda: solo gara o senzaPremio", () => {
  const stato = S.statoIniziale(config);
  S.impostaLayout(stato, "senzaPremio");
  assert.equal(stato.layout, "senzaPremio");
  assert.throws(() => S.impostaLayout(stato, "orizzontale"), /Layout sconosciuto/);
  assert.equal(stato.layout, "senzaPremio");
});

test("senza premio la traccia di Nero passa subito, anche con voti rimasti da una gara", () => {
  const gara = S.statoIniziale(config);
  S.impostaVoto(gara, { categoria: "beat", valore: 8 });
  S.tracciaDaNero(gara, { neroId: "n1", titolo: "Asfalto", artista: "Dama", tier: "skip" }, { ora: 0, attesaMs: 10_000 });
  assert.equal(gara.corrente.titolo, "", "nella gara aspetta la conferma");
  assert.equal(gara.neroInArrivo.titolo, "Asfalto");

  const ascolto = statoSenzaPremio();
  S.impostaVoto(ascolto, { categoria: "beat", valore: 8 });
  S.tracciaDaNero(ascolto, { neroId: "n1", titolo: "Asfalto", artista: "Dama", tier: "skip" }, { ora: 0, attesaMs: 10_000 });
  assert.equal(ascolto.corrente.titolo, "Asfalto");
  assert.equal(ascolto.neroInArrivo, null);
});

test("tracce ascoltate: ognuna una volta sola, quelle senza titolo non contano", () => {
  const stato = statoSenzaPremio();
  assert.equal(S.registraAscolto(stato, 1), false);
  stato.corrente = S.tracciaVuota({ titolo: "Satellite", artista: "Mira" });
  assert.equal(S.registraAscolto(stato, 2), true);
  assert.equal(S.registraAscolto(stato, 3), false, "stessa traccia");
  stato.corrente = S.tracciaVuota({ titolo: "Satellite", artista: "Mira" });
  assert.equal(S.registraAscolto(stato, 4), false, "rimessa dalla regia subito dopo");
  stato.corrente = S.tracciaVuota({ titolo: "Cromo", artista: "Vale B", tier: "throne" });
  assert.equal(S.registraAscolto(stato, 5), true);
  assert.deepEqual(stato.ascoltate.map((a) => [a.titolo, a.tier]), [["Satellite", null], ["Cromo", "throne"]]);
  assert.equal(S.istantanea(stato, config, 6).ascoltate, 2);
});

test("barra: in ascolto dopo la prima voce, tracce di oggi prima dell'ultima, voci spente escluse", () => {
  const stato = statoSenzaPremio();
  let voci = vociBarra(foto(stato));
  assert.deepEqual(voci.map((v) => v.tipo), ["social", "social", "social", "social", "social"]);
  assert.deepEqual(voci[1].icone, ["instagram", "tiktok"]);
  assert.equal(voci[0].oro, true, "nero.fan/backrooms in oro");

  stato.corrente = S.tracciaVuota({ titolo: "Notti a Vicenza (feat. Kappa 23) versione estesa", artista: "Lince", tier: "throne" });
  for (let i = 0; i < MIN_ASCOLTATE; i++) stato.ascoltate.push({ id: `a${i}`, titolo: `T${i}`, artista: "A", alle: 0 });
  stato.senzaPremio.voci[3].attiva = false; // Kick spento
  voci = vociBarra(foto(stato));
  assert.deepEqual(voci.map((v) => v.tipo), ["social", "ascolto", "social", "social", "ascoltate", "social"]);
  assert.equal(voci[1].titolo.length, 40);
  assert.ok(voci[1].titolo.endsWith("…"));
  assert.equal(voci[1].tier, "throne");
  assert.equal(voci[4].testo, `${MIN_ASCOLTATE} tracce`);
  assert.ok(!voci.some((v) => v.testo === "@backrooms_studio" && v.icone[0] === "kick"));

  stato.senzaPremio.inAscoltoNellaBarra = false;
  stato.senzaPremio.ascoltateNellaBarra = false;
  assert.ok(vociBarra(foto(stato)).every((v) => v.tipo === "social"));
  assert.equal(breve("  ciao  ", 10), "ciao");
  assert.ok(stimaGiroSecondi(vociBarra(foto(stato)), 80) > stimaGiroSecondi(vociBarra(foto(stato)), 160));
});

test("suona solo la pagina del layout in onda", () => {
  const stato = statoSenzaPremio();
  const s = foto(stato);
  assert.equal(suonaIn(s, "senzaPremio", "overlay"), true);
  assert.equal(suonaIn(s, "gara", "overlay"), false);
  assert.equal(suonaIn(s, "senzaPremio", "regia"), false);
  assert.equal(suonaIn({ suoni: { dove: "overlay" } }, "gara", "overlay"), true, "stato senza layout: gara");
});

test("traccia nuova: scheda e suono delicato col tier; niente al primo disegno né senza titolo", () => {
  const stato = statoSenzaPremio();
  const prima = foto(stato);
  assert.deepEqual(suoniSenzaPremio(null, prima), []);
  assert.deepEqual(richiesteScheda(null, prima), []);

  stato.corrente = S.tracciaVuota({ titolo: "Cromo", artista: "Vale B", tier: "throne" });
  const dopo = foto(stato);
  assert.deepEqual(suoniSenzaPremio(prima, dopo), [{ nome: "inAscolto", dati: { tier: "throne" }, parte: "scheda", traccia: true }]);
  const [richiesta] = richiesteScheda(prima, dopo);
  assert.equal(richiesta.tipo, "ascolto");
  assert.deepEqual(richiesta.traccia, { titolo: "Cromo", artista: "Vale B", tier: "throne" });

  stato.corrente = S.tracciaVuota({ titolo: "", artista: "" });
  assert.deepEqual(suoniSenzaPremio(dopo, foto(stato)), []);
  assert.deepEqual(richiesteScheda(dopo, foto(stato)), []);
});

test("suono della traccia: pieno, nessuno, scheda fuori onda, correzione del nome", () => {
  const stato = statoSenzaPremio();
  const prima = foto(stato);
  stato.corrente = S.tracciaVuota({ titolo: "Satellite", artista: "Mira" });

  stato.senzaPremio.suonoTraccia = "pieno";
  assert.deepEqual(nomi(suoniSenzaPremio(prima, foto(stato))), ["nuovaTraccia"]);
  stato.senzaPremio.suonoTraccia = "nessuno";
  assert.deepEqual(suoniSenzaPremio(prima, foto(stato)), []);
  assert.equal(richiesteScheda(prima, foto(stato)).length, 1, "la scheda compare anche senza suono");
  stato.senzaPremio.suonoTraccia = "delicato";
  stato.visibili.scheda = false;
  assert.deepEqual(suoniSenzaPremio(prima, foto(stato)), []);
  assert.deepEqual(richiesteScheda(prima, foto(stato)), []);
  stato.visibili.scheda = true;

  const conTraccia = foto(stato);
  stato.corrente.titolo = "Satellite (remix)"; // stesso id: la regia ha corretto il nome
  assert.deepEqual(suoniSenzaPremio(conTraccia, foto(stato)), []);
});

test("più tracce di fila: al massimo un suono ogni 8 secondi", () => {
  const stato = statoSenzaPremio();
  const a = foto(stato);
  stato.corrente = S.tracciaVuota({ titolo: "Uno", artista: "A" });
  const b = foto(stato);
  stato.corrente = S.tracciaVuota({ titolo: "Due", artista: "B" });
  const c = foto(stato);
  assert.deepEqual(nomi(suoniSenzaPremio(a, b, [], { ora: 0 })), ["inAscolto"]);
  assert.deepEqual(suoniSenzaPremio(b, c, [], { ora: 3000, ultimaTracciaAlle: 0 }), []);
  assert.deepEqual(nomi(suoniSenzaPremio(b, c, [], { ora: PAUSA_MIN_TRACCIA_MS, ultimaTracciaAlle: 0 })), ["inAscolto"]);
});

test("richiamo, prove, ripeti scheda e spot", () => {
  const stato = statoSenzaPremio();
  const prima = foto(stato);
  const dopo = foto(stato);
  assert.deepEqual(nomi(suoniSenzaPremio(prima, dopo, [{ nome: "richiamo", dati: { manuale: true } }])), ["premio"]);
  assert.deepEqual(suoniSenzaPremio(prima, dopo, [{ nome: "suono", dati: { nome: "inAscolto", dati: { tier: "skip" } } }]), [
    { nome: "inAscolto", dati: { tier: "skip" }, parte: "scheda" },
  ]);
  const traccia = { titolo: "Notti a Vicenza", artista: "Lince", tier: "throne" };
  assert.deepEqual(suoniSenzaPremio(prima, dopo, [{ nome: "scheda", dati: { traccia, conSuono: false } }]), [], "ripeti scheda: muta");
  assert.deepEqual(nomi(suoniSenzaPremio(prima, dopo, [{ nome: "scheda", dati: { traccia, conSuono: true } }])), ["inAscolto"], "prova scheda");
  assert.deepEqual(suoniSenzaPremio(prima, dopo, [{ nome: "studio", dati: {} }]), [], "spot: muto");

  stato.corrente = S.tracciaVuota({ titolo: "Cromo", artista: "Vale B" });
  const richieste = richiesteScheda(prima, foto(stato), [{ nome: "studio", dati: {} }]);
  assert.deepEqual(richieste.map((r) => r.tipo), ["ascolto", "studio"]);
});

test("nella gara il pulsante Prova conserva i dati dell'effetto", () => {
  const stato = S.statoIniziale(config);
  const s = foto(stato);
  assert.deepEqual(suoniTraccia(s, s, [{ nome: "suono", dati: { nome: "voto", dati: { valore: 9 } } }]), [{ nome: "voto", dati: { valore: 9 } }]);
  assert.deepEqual(suoniTraccia(s, s, [{ nome: "suono", dati: { nome: "primo", dati: {} } }]), [{ nome: "primo" }]);
});

test("cambio da gara a senza premio con una traccia di Nero in attesa: passa subito", () => {
  const stato = S.statoIniziale(config);
  S.tracciaDaNero(stato, { neroId: "n1", titolo: "Uno", artista: "A" }, { ora: 0, attesaMs: 10_000 });
  S.impostaVoto(stato, { categoria: "beat", valore: 8 });
  S.tracciaDaNero(stato, { neroId: "n2", titolo: "Due", artista: "B", tier: "throne" }, { ora: 1, attesaMs: 10_000 });
  assert.equal(S.passaSeTocca(stato, 2, 10_000), false, "nella gara aspetta la conferma");
  S.impostaLayout(stato, "senzaPremio");
  assert.equal(S.passaSeTocca(stato, 3, 10_000), true);
  assert.deepEqual([stato.corrente.titolo, stato.corrente.tier, stato.neroInArrivo], ["Due", "throne", null]);
});

test("«Oggi abbiamo ascoltato»: conta la live in corso, riparte dopo 4 ore di pausa", () => {
  const stato = statoSenzaPremio();
  const ora = 1_000_000;
  for (let i = 0; i < 5; i++) {
    stato.corrente = S.tracciaVuota({ titolo: `T${i}`, artista: "A" });
    S.registraAscolto(stato, ora + i * 60_000);
  }
  assert.equal(S.istantanea(stato, config, ora + 10 * 60_000).ascoltate, 5);
  // il giorno dopo, prima ancora della prima traccia, il conto vecchio non si vede
  const domani = ora + 20 * 3600_000;
  assert.equal(S.istantanea(stato, config, domani).ascoltate, 0);
  stato.corrente = S.tracciaVuota({ titolo: "Prima di oggi", artista: "B" });
  S.registraAscolto(stato, domani);
  assert.equal(S.istantanea(stato, config, domani).ascoltate, 1);
  assert.equal(S.ascoltateNellaLive(stato, domani + S.PAUSA_NUOVA_LIVE_MS + 1), 0);
});

test("nome corretto dalla regia: la traccia ascoltata si aggiorna e non conta due volte", () => {
  const stato = statoSenzaPremio();
  stato.corrente = S.tracciaVuota({ titolo: "Tre", artista: "C" });
  S.registraAscolto(stato, 1);
  stato.corrente.titolo = "Tre (remix)";
  assert.equal(S.registraAscolto(stato, 2), false);
  assert.equal(stato.ascoltate[0].titolo, "Tre (remix)");
  stato.corrente = S.tracciaVuota({ titolo: "Tre (remix)", artista: "C" });
  assert.equal(S.registraAscolto(stato, 3), false);
  assert.equal(stato.ascoltate.length, 1);
});

test("stato salvato con valori rotti: tornano ai predefiniti, quelli buoni restano", () => {
  const base = S.senzaPremioIniziale();
  const fuso = S.fondiSenzaPremio({
    velocita: "veloce",
    durate: { throne: "x", skip: 11 },
    spot: "ciao",
    richiamoOgniMinuti: -5,
    titolo: 42,
    loghiBarra: "no",
    sopra: "Mandateci",
  });
  assert.equal(fuso.velocita, base.velocita);
  assert.deepEqual(fuso.durate, { ...base.durate, skip: 11 });
  assert.deepEqual(fuso.spot, base.spot);
  assert.equal(fuso.richiamoOgniMinuti, base.richiamoOgniMinuti);
  assert.equal(fuso.titolo, base.titolo);
  assert.equal(fuso.loghiBarra, true);
  assert.equal(fuso.sopra, "Mandateci");
});

test("tipi sbagliati dall'API: errore chiaro invece di un valore a caso", () => {
  const stato = S.statoIniziale(config);
  for (const sbagliata of [
    { richiamoOgniMinuti: "  " },
    { richiamoOgniMinuti: false },
    { velocita: [80] },
    { spot: "ciao" },
    { durate: [] },
    { durate: 5 },
    { loghiBarra: "false" },
  ]) {
    assert.throws(() => S.impostaSenzaPremio(stato, sbagliata), Error, JSON.stringify(sbagliata));
  }
  S.impostaSenzaPremio(stato, { velocita: "120", loghiBarra: false });
  assert.equal(stato.senzaPremio.velocita, 120);
});

test("richiamo con il banner spento: niente campanella", () => {
  const stato = statoSenzaPremio();
  stato.visibili.banner = false;
  const s = foto(stato);
  assert.deepEqual(suoniSenzaPremio(s, s, [{ nome: "richiamo", dati: { manuale: true } }]), []);
});

test("le prove della scheda suonano sempre e non fanno partire la pausa delle tracce", () => {
  const stato = statoSenzaPremio();
  const s = foto(stato);
  const prova = (tier) => [{ nome: "scheda", dati: { traccia: { titolo: "Notti a Vicenza", artista: "Lince", tier }, conSuono: true } }];
  const [primo] = suoniSenzaPremio(s, s, prova("throne"), { ora: 0 });
  assert.equal(primo.traccia, undefined, "una prova non conta come traccia");
  assert.deepEqual(nomi(suoniSenzaPremio(s, s, prova("skip"), { ora: 1000, ultimaTracciaAlle: 500 })), ["inAscolto"]);
});

test("richiamo: niente campanella se ce n'è già uno in corso; ogni suono dice la sua parte", () => {
  const stato = statoSenzaPremio();
  const s = foto(stato);
  const richiamo = [{ nome: "richiamo", dati: { manuale: true } }];
  assert.deepEqual(suoniSenzaPremio(s, s, richiamo, { richiamoInCorso: true }), []);
  assert.deepEqual(suoniSenzaPremio(s, s, richiamo), [{ nome: "premio", parte: "banner" }]);
  stato.corrente = S.tracciaVuota({ titolo: "Cromo", artista: "Vale B" });
  assert.equal(suoniSenzaPremio(s, foto(stato))[0].parte, "scheda");
});

test("coda Nero: «Traccia 15 di 38 · mancano 23» con il totale vero della coda", () => {
  const stato = statoSenzaPremio();
  assert.equal(foto(stato).codaNero, null, "senza lettura dalla coda il totale non si conosce");
  assert.equal(S.impostaCodaNero(stato, 23), true);
  assert.equal(S.impostaCodaNero(stato, 23), false, "stesso valore: niente cambio");
  assert.equal(S.impostaCodaNero(stato, -4), true, "valore non valido: totale sconosciuto");
  assert.equal(foto(stato).codaNero, null);
  S.impostaCodaNero(stato, 23);
  for (let i = 0; i < 15; i++) stato.ascoltate.push({ id: `a${i}`, titolo: `T${i}`, artista: "A", alle: 0 });
  stato.corrente = S.tracciaVuota({ titolo: "Satellite", artista: "Mira" });
  const foto15 = foto(stato);
  assert.equal(foto15.codaNero, 23);
  assert.deepEqual(avanzamentoCoda({ ascoltate: 15, codaNero: 23 }), { numero: 15, totale: 38, mancano: 23, testo: "Traccia 15 di 38 · mancano 23 canzoni" });
  assert.equal(avanzamentoCoda({ ascoltate: 38, codaNero: 0 }).testo, "Traccia 38 di 38 · è l'ultima");
  assert.equal(avanzamentoCoda({ ascoltate: 4, codaNero: 1 }).testo, "Traccia 4 di 5 · manca 1 canzone");
  assert.equal(avanzamentoCoda({ ascoltate: 4, codaNero: null }), null);
  assert.equal(avanzamentoCoda({ ascoltate: 0, codaNero: 9 }), null);
  const voci = vociBarra(foto15);
  assert.equal(voci.find((v) => v.tipo === "ascoltate").testo, "Traccia 15 di 38 · mancano 23 canzoni");
});

test("Nero: le tracce in coda si leggono da queueCount o dalla lunghezza di queue", () => {
  assert.equal(inAttesaInCoda({ meta: { queueCount: 23 }, queue: [] }), 23);
  assert.equal(inAttesaInCoda({ queue: [{}, {}, {}] }), 3);
  assert.equal(inAttesaInCoda({ meta: { queueCount: "x" } }), null);
  assert.equal(inAttesaInCoda(null), null);
});

test("senza premio: scheda fissa di partenza, etichette modificabili (40 caratteri, non vuote), stato vecchio → predefiniti", () => {
  const stato = statoSenzaPremio();
  assert.equal(stato.senzaPremio.schedaFissa, true);
  assert.deepEqual(stato.senzaPremio.etichette, { inAscolto: "Ora in ascolto", ascoltate: "Oggi abbiamo ascoltato", tracce: "tracce" });
  S.impostaSenzaPremio(stato, { schedaFissa: false, etichette: { inAscolto: "Sul palco adesso" } });
  assert.equal(stato.senzaPremio.schedaFissa, false);
  assert.deepEqual(stato.senzaPremio.etichette, { inAscolto: "Sul palco adesso", ascoltate: "Oggi abbiamo ascoltato", tracce: "tracce" });
  const prima = structuredClone(stato.senzaPremio);
  assert.throws(() => S.impostaSenzaPremio(stato, { etichette: { inAscolto: "x".repeat(41) } }), /40|Ora in ascolto|etichetta/i);
  assert.throws(() => S.impostaSenzaPremio(stato, { schedaFissa: true, etichette: { ascoltate: "  " } }), /vuot|obblig|scrivi/i);
  assert.throws(() => S.impostaSenzaPremio(stato, { etichette: { sconosciuta: "x" } }), /sconosciut/i);
  assert.deepEqual(stato.senzaPremio, prima, "un errore non cambia niente (nemmeno schedaFissa)");
  // uno stato salvato prima di questi campi, o con valori rotti: predefiniti, tenendo i campi buoni
  const vecchio = S.fondiSenzaPremio({ velocita: 100 });
  assert.equal(vecchio.schedaFissa, true);
  assert.equal(vecchio.etichette.inAscolto, "Ora in ascolto");
  const rotto = S.fondiSenzaPremio({ schedaFissa: "boh", etichette: { inAscolto: "x".repeat(50), tracce: "brani" } });
  assert.equal(rotto.schedaFissa, true);
  assert.deepEqual(rotto.etichette, { inAscolto: "Ora in ascolto", ascoltate: "Oggi abbiamo ascoltato", tracce: "brani" });
});

test("Instagram della traccia in ascolto: vuoto di partenza, in istantanea; una traccia nuova da Nero lo azzera; correggiTraccia non tocca i voti", () => {
  const stato = statoSenzaPremio();
  assert.equal(stato.corrente.instagram, "");
  assert.equal(foto(stato).corrente.instagram, "");
  stato.corrente = S.tracciaVuota({ titolo: "Satellite", artista: "Mira", instagram: "mira.music" });
  stato.corrente.voti.beat = 7;
  assert.equal(foto(stato).corrente.instagram, "mira.music");
  delete stato.corrente.instagram; // uno stato salvato prima del campo
  assert.equal(foto(stato).corrente.instagram, "", "campo mancante → vuoto");
  stato.corrente = S.tracciaVuota({ titolo: "Satellite", artista: "Mira", instagram: "mira.music" });
  stato.neroAutomatico = true;
  S.tracciaDaNero(stato, { neroId: "n2", titolo: "Cromo", artista: "Vale B", tier: "skip", instagram: "vale.b" }, { ora: 1e9, attesaMs: 0 });
  assert.deepEqual([stato.corrente.titolo, stato.corrente.instagram], ["Cromo", "vale.b"], "la traccia nuova da Nero porta il suo Instagram (non quello di prima)");
  S.tracciaDaNero(stato, { neroId: "n3", titolo: "Asfalto", artista: "Dama", tier: "standard" }, { ora: 2e9, attesaMs: 0 });
  assert.equal(stato.corrente.instagram, "", "senza Instagram da Nero resta vuoto: quello scritto a mano non passa alla traccia dopo");
});

// ---------- Scheda «Ora in ascolto»: la macchina a stati (public/js/scheda-logica.js) ----------
const OPZ = { schedaFissa: true, durate: { standard: 8, skip: 10, superskip: 12, throne: 15 }, durataSpotMs: 10_000, uscitaMs: 500 };
const tr = (id, tier = null, extra = {}) => ({ id, tier, titolo: `Titolo ${id}`, artista: `Artista ${id}`, instagram: "", ...extra });
const vuota = () => creaSchedaVuota();
const passo = (stato, evento, ora = 0, opz = OPZ) => prossimaScheda(stato, evento, ora, opz);
const tipi = (azioni) => azioni.map((a) => a.tipo);

test("scheda fissa: dopo una traccia nessuna scadenza; una traccia nuova cambia la scheda; la stessa (nomi corretti) la aggiorna", () => {
  let { stato, azioni } = passo(vuota(), { tipo: "traccia", traccia: tr("a", "skip") });
  assert.deepEqual(tipi(azioni), ["entra-ascolto"], "nessun «programma»: non scade");
  assert.equal(azioni[0].traccia.id, "a");
  ({ stato, azioni } = passo(stato, { tipo: "traccia", traccia: tr("b") }, 5000));
  assert.deepEqual(tipi(azioni), ["entra-ascolto"]);
  assert.equal(azioni[0].cambia, true, "con la scheda già su è un cambio, non un'entrata");
  ({ stato, azioni } = passo(stato, { tipo: "traccia", traccia: tr("b", null, { artista: "Corretto" }) }, 6000));
  assert.deepEqual(tipi(azioni), ["aggiorna-ascolto"]);
  assert.equal(azioni[0].traccia.artista, "Corretto");
  ({ stato, azioni } = passo(stato, { tipo: "traccia", traccia: tr("b", null, { titolo: "" }) }, 7000));
  assert.deepEqual(tipi(azioni), ["esce"], "la regia ha svuotato il titolo: la scheda scende");
});

test("scheda a tempo: scade dopo 8, 10, 12, 15 secondi per tipo", () => {
  const aTempo = { ...OPZ, schedaFissa: false };
  for (const [tier, secondi] of [[null, 8], ["standard", 8], ["skip", 10], ["superskip", 12], ["throne", 15]]) {
    let { stato, azioni } = passo(vuota(), { tipo: "traccia", traccia: tr("a", tier) }, 1000, aTempo);
    const programma = azioni.find((a) => a.tipo === "programma");
    assert.equal(programma.quando, 1000 + secondi * 1000, String(tier));
    ({ stato, azioni } = passo(stato, { tipo: "scadenza", token: programma.token }, programma.quando, aTempo));
    assert.deepEqual(tipi(azioni), ["esce"]);
    assert.equal(stato.aperta, null);
  }
  // un timer vecchio (token superato da una traccia più nuova) non chiude la scheda
  let { stato, azioni } = passo(vuota(), { tipo: "traccia", traccia: tr("a") }, 0, aTempo);
  const vecchio = azioni.find((a) => a.tipo === "programma");
  ({ stato } = passo(stato, { tipo: "traccia", traccia: tr("b") }, 3000, aTempo));
  ({ azioni } = passo(stato, { tipo: "scadenza", token: vecchio.token }, 8000, aTempo));
  assert.deepEqual(azioni, [], "timer vecchio: ignorato");
});

test("spot con scheda fissa: esce la traccia, entra lo spot per 10 secondi, poi rientra la traccia più recente", () => {
  let { stato } = passo(vuota(), { tipo: "traccia", traccia: tr("a", "throne") }, 0);
  let r = passo(stato, { tipo: "spot" }, 20_000);
  assert.deepEqual(tipi(r.azioni), ["esce", "programma"], "prima scende la traccia");
  const uscita = r.azioni.find((a) => a.tipo === "programma");
  assert.equal(uscita.quando, 20_500);
  r = passo(r.stato, { tipo: "uscita-finita", token: uscita.token }, 20_500);
  assert.deepEqual(tipi(r.azioni), ["entra-spot", "programma"]);
  const fineSpot = r.azioni.find((a) => a.tipo === "programma");
  assert.equal(fineSpot.quando, 30_500, "lo spot resta 10 secondi");
  r = passo(r.stato, { tipo: "scadenza", token: fineSpot.token }, 30_500);
  assert.deepEqual(tipi(r.azioni), ["esce", "programma"]);
  const rientro = r.azioni.find((a) => a.tipo === "programma");
  r = passo(r.stato, { tipo: "uscita-finita", token: rientro.token }, 31_000);
  assert.deepEqual(tipi(r.azioni), ["entra-ascolto"]);
  assert.equal(r.azioni[0].traccia.id, "a");
});

test("traccia nuova durante lo spot: dopo lo spot rientra la nuova, e lo spot non si interrompe", () => {
  let { stato } = passo(vuota(), { tipo: "traccia", traccia: tr("a") }, 0);
  let r = passo(stato, { tipo: "spot" }, 1000);
  r = passo(r.stato, { tipo: "uscita-finita", token: r.azioni.find((a) => a.tipo === "programma").token }, 1500);
  const fineSpot = r.azioni.find((a) => a.tipo === "programma");
  r = passo(r.stato, { tipo: "traccia", traccia: tr("b", "skip") }, 5000);
  assert.deepEqual(r.azioni, [], "durante lo spot non succede niente");
  r = passo(r.stato, { tipo: "scadenza", token: fineSpot.token }, 11_500);
  r = passo(r.stato, { tipo: "uscita-finita", token: r.azioni.find((a) => a.tipo === "programma").token }, 12_000);
  assert.equal(r.azioni[0].traccia.id, "b");
});

test("scheda nascosta dalla regia: nessuna entrata; riaccesa, rientra l'ultima traccia", () => {
  let { stato } = passo(vuota(), { tipo: "traccia", traccia: tr("a") }, 0);
  let r = passo(stato, { tipo: "nascondi" }, 1000);
  assert.deepEqual(tipi(r.azioni), ["esce"]);
  r = passo(r.stato, { tipo: "traccia", traccia: tr("b") }, 2000);
  assert.deepEqual(r.azioni, [], "nascosta: nessuna entrata");
  assert.deepEqual(passo(r.stato, { tipo: "spot" }, 2500).azioni, [], "nemmeno lo spot");
  r = passo(r.stato, { tipo: "mostra" }, 3000);
  assert.deepEqual(tipi(r.azioni), ["entra-ascolto"]);
  assert.equal(r.azioni[0].traccia.id, "b", "l'ultima traccia");
  assert.deepEqual(passo(passo(vuota(), { tipo: "nascondi" }, 0).stato, { tipo: "mostra" }, 1).azioni, [], "riaccesa senza traccia: niente");
});

test("spot senza una traccia in scheda: entra subito e poi la scheda resta chiusa; due spot di fila non si sommano", () => {
  let r = passo(vuota(), { tipo: "spot" }, 0);
  assert.deepEqual(tipi(r.azioni), ["entra-spot", "programma"], "subito, senza far scendere niente");
  assert.deepEqual(passo(r.stato, { tipo: "spot" }, 1000).azioni, [], "già su: il secondo non si somma");
  const fine = r.azioni.find((a) => a.tipo === "programma");
  r = passo(r.stato, { tipo: "scadenza", token: fine.token }, 10_000);
  r = passo(r.stato, { tipo: "uscita-finita", token: r.azioni.find((a) => a.tipo === "programma").token }, 10_500);
  assert.deepEqual(r.azioni, []);
  assert.equal(r.stato.aperta, null);
});

test("barra: le diciture scelte in regia sostituiscono «Oggi abbiamo ascoltato» e «tracce»", () => {
  const stato = statoSenzaPremio();
  for (let i = 0; i < MIN_ASCOLTATE; i++) stato.ascoltate.push({ id: `a${i}`, titolo: `T${i}`, artista: "A", alle: 0 });
  S.impostaSenzaPremio(stato, { etichette: { ascoltate: "Stasera sono passati", tracce: "brani" } });
  const voce = vociBarra(foto(stato)).find((v) => v.tipo === "ascoltate");
  assert.deepEqual([voce.etichetta, voce.testo], ["Stasera sono passati", `${MIN_ASCOLTATE} brani`]);
});
