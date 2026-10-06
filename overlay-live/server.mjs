// Server locale dell'overlay live: pagine per TikTok LIVE Studio e regia, WebSocket per aggiornamenti
// istantanei, API per Stream Deck, voti dalla chat TikTok e webhook di Nero.fan.
// Avvio: npm start (oppure doppio clic su AVVIA.cmd)
import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import * as S from "./lib/stato.mjs";
import * as B from "./lib/battle.mjs";
import { avviaTikTok, leggiVoto } from "./lib/chat.mjs";
import { firmaValida, versoCoda, avviaNero } from "./lib/nero.mjs";

const CARTELLA = dirname(fileURLToPath(import.meta.url));
const PUBBLICA = join(CARTELLA, "public");
// OVERLAY_CONFIG e OVERLAY_DATI servono alle prove automatiche: un config e una cartella dati temporanei.
const FILE_STATO = join(process.env.OVERLAY_DATI ?? join(CARTELLA, "dati"), "stato.json");
// TikTok LIVE Studio accetta nella sorgente Link solo indirizzi con un ".parola" (es. ".html"):
// per questo l'overlay risponde anche come /overlay.html (il layout delle live giornaliere come /senza-premio.html,
// la live session in studio come /studio.html, il battle come /battle.html).
const PAGINE = {
  "/": "regia.html",
  "/regia": "regia.html",
  "/overlay": "overlay.html",
  "/overlay.html": "overlay.html",
  "/senza-premio": "senza-premio.html",
  "/senza-premio.html": "senza-premio.html",
  "/studio": "studio.html",
  "/studio.html": "studio.html",
  "/battle": "battle.html",
  "/battle.html": "battle.html",
};
const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
};

const config = caricaConfig();
// Dopo la conferma il pubblico vede punteggio e classifica; poi arriva da sola la traccia successiva di Nero.
const ATTESA_DOPO_CONFERMA_MS = Math.max(0, Number(config.nero.attesaDopoConfermaSecondi) || 0) * 1000;
let stato = caricaStato();

function caricaConfig() {
  const esempio = join(CARTELLA, "config.esempio.json");
  const file = process.env.OVERLAY_CONFIG ?? join(CARTELLA, "config.json");
  if (!process.env.OVERLAY_CONFIG && !existsSync(file)) {
    writeFileSync(file, readFileSync(esempio));
    console.log("Creato config.json dal modello.");
  }
  const base = JSON.parse(readFileSync(esempio, "utf8"));
  const tuo = JSON.parse(readFileSync(file, "utf8"));
  // I giudici sono un oggetto { beat, voce, mix }: un vecchio config con la lista viene ignorato.
  const giudici = tuo.giudici && !Array.isArray(tuo.giudici) ? tuo.giudici : {};
  return {
    ...base,
    ...tuo,
    giudici: { ...base.giudici, ...giudici },
    pesi: { ...base.pesi, ...tuo.pesi },
    nero: { ...base.nero, ...tuo.nero },
  };
}

function caricaStato() {
  if (!existsSync(FILE_STATO)) return S.statoIniziale(config);
  try {
    const iniziale = S.statoIniziale(config);
    const salvato = { ...iniziale, ...JSON.parse(readFileSync(FILE_STATO, "utf8")) };
    // Widget e impostazioni aggiunti dopo: chi ha uno stato salvato prima li trova accesi.
    salvato.visibili = { ...iniziale.visibili, ...salvato.visibili };
    salvato.suoni = { ...iniziale.suoni, ...salvato.suoni };
    if (S.INVITI_SUPERATI.includes(salvato.invito)) salvato.invito = iniziale.invito;
    // Layout senza premio (aggiunto dopo): impostazioni complete anche da uno stato vecchio.
    salvato.senzaPremio = S.fondiSenzaPremio(salvato.senzaPremio);
    salvato.studio = S.fondiStudio(salvato.studio);
    salvato.battle = B.fondiBattle(salvato.battle);
    if (!S.LAYOUT.includes(salvato.layout)) salvato.layout = iniziale.layout;
    salvato.ascoltate = Array.isArray(salvato.ascoltate) ? salvato.ascoltate.filter((a) => a && typeof a === "object") : [];
    // Stato di una versione precedente (tre voti per categoria): la traccia in corso riparte da zero.
    if (Array.isArray(salvato.corrente?.voti?.beat)) salvato.corrente = S.tracciaVuota();
    if (Array.isArray(salvato.giudici)) salvato.giudici = { ...config.giudici };
    return salvato;
  } catch (e) {
    console.error(`Stato salvato illeggibile (${e.message}): riparto da una serata vuota.`);
    return S.statoIniziale(config);
  }
}

// Salvataggio su disco al massimo ogni 500 ms, così un riavvio non perde la classifica.
let salvataggioInAttesa = false;
function salvaPresto() {
  if (salvataggioInAttesa) return;
  salvataggioInAttesa = true;
  setTimeout(async () => {
    salvataggioInAttesa = false;
    try {
      await mkdir(dirname(FILE_STATO), { recursive: true });
      await writeFile(`${FILE_STATO}.tmp`, JSON.stringify(stato));
      await rename(`${FILE_STATO}.tmp`, FILE_STATO);
    } catch (e) {
      console.error("Salvataggio dello stato non riuscito:", e.message);
    }
  }, 500);
}

// --- Diffusione dello stato -------------------------------------------------------------
// Le modifiche ravvicinate (raffiche di voti in chat) partono in un unico messaggio ogni 50 ms.
// Gli eventi (nuova entrata in classifica, vincitore, spareggio) viaggiano con lo stato che li contiene.
let eventiInAttesa = [];
let invioProgrammato = null;
let statoTikTok = { stato: "spento", messaggio: "" };
let statoNero = { stato: "spento", messaggio: "" };

function emetti(nome, dati) {
  eventiInAttesa.push({ nome, dati });
}

function cambiato() {
  S.registraAscolto(stato, Date.now());
  salvaPresto();
  invioProgrammato ??= setTimeout(inviaATutti, 50);
}

const istantanea = () => ({
  ...S.istantanea(stato, config, Date.now()),
  tiktok: { ...statoTikTok, utente: stato.tiktokUtente },
  neroUtente: config.nero.username,
  nero: { ...statoNero, automatico: stato.neroAutomatico, inArrivo: stato.neroInArrivo, attesaDopoConfermaSecondi: ATTESA_DOPO_CONFERMA_MS / 1000 },
});

function inviaATutti() {
  invioProgrammato = null;
  const msg = JSON.stringify({ tipo: "stato", stato: istantanea(), eventi: eventiInAttesa });
  eventiInAttesa = [];
  for (const client of wss.clients) if (client.readyState === 1) client.send(msg);
}

// --- Chat TikTok -------------------------------------------------------------------------
const pulisci = (testo, max = 120) => String(testo ?? "").trim().slice(0, max);

function registraCommento({ piattaforma, utente, testo }) {
  // Con il battle in onda i commenti votano un rapper («1», «2», «sx», «dx»), non un punteggio.
  if (stato.layout === "battle") {
    const preso = B.votoDaCommento(stato, { piattaforma: pulisci(piattaforma, 20), utente: pulisci(utente, 40), testo }, Date.now());
    if (preso) cambiato();
    return preso;
  }
  const valore = leggiVoto(testo);
  if (valore === null) return false;
  const preso = S.votoChat(stato, { piattaforma: pulisci(piattaforma, 20), utente: pulisci(utente, 40) }, valore, Date.now());
  if (preso) cambiato();
  return preso;
}

// --- Traccia in riproduzione su Nero.fan ------------------------------------------------
// Ogni 3 secondi legge la coda pubblica: quando su Nero parte un'altra traccia, va sul tabellone.
function collegaNero() {
  avviaNero(
    config.nero.username,
    (traccia) => S.tracciaDaNero(stato, traccia, { ora: Date.now(), attesaMs: ATTESA_DOPO_CONFERMA_MS }) && cambiato(),
    (s) => {
      if (s.stato === statoNero.stato && s.messaggio === statoNero.messaggio) return;
      statoNero = s;
      cambiato();
    },
  );
}

let fermaTikTok = () => {};
function collegaTikTok() {
  fermaTikTok();
  fermaTikTok = avviaTikTok(stato.tiktokUtente, registraCommento, (s) => {
    statoTikTok = s;
    cambiato();
  });
}

// --- Comandi (regia via WebSocket, Stream Deck e altri tool via POST /api/<comando>) -----
// Il richiamo dura 2,4 s nella pagina (RICHIAMO_MS in public/js/eventi-sonori.js): nel frattempo non se ne parte un altro.
const DURATA_RICHIAMO_MS = 2400;
let ultimoRichiamoAlle = -Infinity;
const schedaAccesa = () => {
  if (!stato.visibili.scheda) throw new Error("La scheda è spenta: accendetela in In onda");
};

// Pulsanti Prova: passano alle pagine solo i dati che gli effetti si aspettano.
function datiProva(dati) {
  const d = dati && typeof dati === "object" ? dati : {};
  const puliti = {};
  if (S.TIER_SCHEDA.includes(d.tier)) puliti.tier = d.tier;
  if (typeof d.valore === "number" && d.valore >= 0 && d.valore <= 10) puliti.valore = d.valore;
  if (Number.isInteger(d.posti) && d.posti >= 1 && d.posti <= 10) puliti.posti = d.posti;
  if (typeof d.ultimi === "boolean") puliti.ultimi = d.ultimi;
  return puliti;
}

function esito(fn) {
  const risultato = fn(stato, Date.now());
  if (risultato?.vincitore) emetti("vincitore", risultato.vincitore);
  if (risultato?.spareggio) emetti("spareggio", risultato.spareggio);
  return risultato;
}

const comandi = {
  traccia({ titolo, artista, tier = null }) {
    stato.corrente = S.tracciaVuota({ titolo: pulisci(titolo), artista: pulisci(artista), tier });
  },
  correggiTraccia({ titolo, artista }) {
    if (titolo !== undefined) stato.corrente.titolo = pulisci(titolo);
    if (artista !== undefined) stato.corrente.artista = pulisci(artista);
  },
  inCoda({ titolo, artista }) {
    if (!pulisci(titolo) && !pulisci(artista)) throw new Error("Scrivi almeno titolo o artista");
    stato.coda.push({ id: randomUUID(), titolo: pulisci(titolo), artista: pulisci(artista), tier: "standard", importo: null, ricevutoAlle: Date.now() });
  },
  daCoda({ id }) {
    const voce = stato.coda.find((v) => v.id === id);
    if (!voce) throw new Error("Traccia non più in coda");
    stato.coda = stato.coda.filter((v) => v.id !== id);
    stato.corrente = S.tracciaVuota(voce);
  },
  togliCoda({ id }) {
    stato.coda = stato.coda.filter((v) => v.id !== id);
  },
  voto(args) {
    S.impostaVoto(stato, args);
  },
  giudici(nomi) {
    for (const cat of S.CATEGORIE) if (nomi[cat] !== undefined) stato.giudici[cat] = pulisci(nomi[cat], 40);
  },
  nascondiVoti({ attivo }) {
    stato.nascondiVoti = Boolean(attivo);
  },
  widget({ nome, visibile }) {
    if (!S.WIDGET.includes(nome)) throw new Error("Widget sconosciuto");
    stato.visibili[nome] = Boolean(visibile);
  },
  apriChat({ secondi = config.durataVotoChatSecondi }) {
    S.apriVotoChat(stato, Number(secondi), Date.now());
  },
  chiudiChat() {
    S.chiudiVotoChat(stato);
  },
  azzeraChat() {
    Object.assign(stato.corrente.chat, { voti: {}, ultimi: [] });
    stato.corrente.confermato = false;
  },
  messaggioChat(args) {
    return { contato: registraCommento(args) };
  },
  simulaChat({ quanti = 10 }) {
    if (!stato.corrente.chat.aperta) throw new Error("Apri prima il voto della chat");
    for (let i = 0; i < Math.min(200, Number(quanti)); i++) {
      const voto = Math.max(0, Math.min(10, Math.round((5 + Math.random() * 3 + Math.random() * 3) * 2) / 2));
      S.votoChat(stato, { piattaforma: "test", utente: `spettatore${Math.floor(Math.random() * 5000)}` }, voto, Date.now());
    }
  },
  tiktok({ utente }) {
    stato.tiktokUtente = pulisci(utente, 40).replace(/^@/, "");
    collegaTikTok();
  },
  conferma() {
    const risultato = S.conferma(stato, config, Date.now());
    emetti("classifica", risultato);
    return risultato;
  },
  prossima() {
    S.prossima(stato);
  },
  neroAutomatico({ attivo }) {
    stato.neroAutomatico = Boolean(attivo);
    stato.neroInArrivo = null;
    // Riattivandola, la traccia che suona adesso su Nero torna a essere "nuova" e passa sul tabellone.
    if (stato.neroAutomatico) stato.neroUltimo = null;
  },
  togliRisultato({ id }) {
    stato.risultati = stato.risultati.filter((r) => r.id !== id);
  },
  countdown(args) {
    S.countdown(stato, { minuti: config.durataCountdownMinuti, ...args }, Date.now());
  },
  // Senza id proclama il primo; con più primi a pari merito apre lo spareggio. Con id: scelta dei giudici.
  proclama({ id = null }) {
    const risultato = esito((s, ora) => S.proclama(s, ora, id));
    if (!risultato) throw new Error("La classifica è vuota");
    return risultato;
  },
  nascondiVincitore() {
    if (stato.vincitore) stato.vincitore.visibile = false;
    stato.spareggio = null;
  },
  premio({ testo }) {
    stato.premio = pulisci(testo);
  },
  invito({ testo }) {
    stato.invito = pulisci(testo, 200);
  },
  suoni(args) {
    S.impostaSuoni(stato, args);
  },
  // Fa suonare un effetto su overlay o regia (dove sono attivi i suoni): per provarli prima della live.
  provaSuono({ nome = "entrata", dati = null }) {
    emetti("suono", { nome: pulisci(nome, 30), dati: datiProva(dati) });
  },
  // --- Layout senza premio (live giornaliere di ascolto) ---
  layout({ nome }) {
    S.impostaLayout(stato, nome);
  },
  senzaPremio(modifiche) {
    S.impostaSenzaPremio(stato, modifiche);
  },
  ripristinaSenzaPremio() {
    stato.senzaPremio = S.senzaPremioIniziale();
  },
  // Il link del banner «chiama» (con la campanella, se i suoni sono accesi).
  richiamo() {
    if (!stato.visibili.banner) throw new Error("Il banner è spento: accendetelo in In onda");
    const ora = Date.now();
    if (ora - ultimoRichiamoAlle < DURATA_RICHIAMO_MS) throw new Error("Richiamo già in corso");
    ultimoRichiamoAlle = ora;
    emetti("richiamo", { manuale: true });
  },
  // Rimostra la scheda della traccia in ascolto, senza suono.
  ripetiScheda() {
    schedaAccesa();
    const { titolo, artista, tier } = stato.corrente;
    if (!titolo) throw new Error("Nessuna traccia in ascolto da mostrare");
    emetti("scheda", { traccia: { titolo, artista, tier }, conSuono: false });
  },
  // Scheda di prova (non cambia la traccia in ascolto): per vedere come appare un invio Skip, Super Skip o Throne.
  provaScheda({ tier = "throne" }) {
    schedaAccesa();
    if (!S.TIER_SCHEDA.includes(tier)) throw new Error("Tipo di invio: standard, skip, superskip o throne");
    emetti("scheda", { traccia: { titolo: "Notti a Vicenza", artista: "Lince", tier }, conSuono: true });
  },
  spotStudio() {
    schedaAccesa();
    emetti("studio", {});
  },
  // --- Live session in studio (split screen fonico · artista · DAW, nessun suono) ---
  studio(modifiche) {
    S.impostaStudio(stato, modifiche);
  },
  ripristinaStudio() {
    // il nome dell'artista in onda resta: si ripristinano comparse e impostazioni
    const { artista, instagram } = stato.studio;
    stato.studio = { ...S.studioIniziale(), artista, instagram };
  },
  // Una comparsa sale dalla barra: quella scelta ({ id }) o, senza id, la prossima del giro.
  comparsa({ id = null }) {
    if (!stato.visibili.comparse) throw new Error("Le comparse sono spente: accendetele in In onda");
    if (id && !stato.studio.comparse.some((c) => c.id === id)) throw new Error("Comparsa non trovata: salvatela prima");
    if (!id && !stato.studio.comparse.some((c) => c.attiva)) throw new Error("Nessuna comparsa accesa");
    emetti("comparsa", id ? { id } : {});
  },
  // --- Battle (scontro tra due rapper: barre dal voto chat, giudici, tabellone) ---
  battleScontro(args) {
    B.impostaScontro(stato, args);
  },
  battleModalita(args) {
    B.impostaModalita(stato, args);
  },
  // { durataSecondi } cambia la durata del prossimo round; { azione: "pausa" | "riprendi" } ferma o fa ripartire quello in corso.
  battleTimer({ durataSecondi, azione }) {
    if (durataSecondi === undefined && azione === undefined) throw new Error("Serve durataSecondi oppure azione (pausa o riprendi)");
    if (azione !== undefined) B.timerAzione(stato, azione, Date.now());
    if (durataSecondi !== undefined) B.impostaTimer(stato, { durataSecondi });
  },
  battleAvvia() {
    B.avvia(stato, Date.now());
  },
  battleTermina() {
    for (const e of B.termina(stato, Date.now())) emetti(e.nome, e.dati);
  },
  battleReset() {
    B.reset(stato);
  },
  battleProssimo() {
    B.prossimo(stato);
  },
  battleVotoGiudice(args) {
    B.votoGiudice(stato, args);
  },
  battleGiudici(nomi) {
    B.impostaGiudici(stato, nomi);
  },
  battleRivela() {
    return B.rivela(stato, Date.now());
  },
  battleProclama({ lato }) {
    B.proclamaBattle(stato, lato);
  },
  tabellone(args) {
    B.impostaTabellone(stato, args);
  },
  torneo({ partecipanti, azione = "crea" }) {
    if (azione === "crea") B.creaTorneo(stato, partecipanti);
    else if (azione === "sorteggia") B.sorteggiaTorneo(stato);
    else if (azione === "azzera") B.azzeraTorneo(stato);
    else throw new Error("Azione del torneo non valida: crea, sorteggia o azzera");
  },
  torneoCarica({ id }) {
    B.caricaPartita(stato, id);
  },
  punti(args) {
    B.impostaPunti(stato, args);
  },
  // Con testi o tempi li salva; senza, mostra un pop-up: quello scelto ({ id }) o la prossima del giro.
  battlePopup({ elenco, ogniMinuti, durata, id = null }) {
    if (elenco !== undefined || ogniMinuti !== undefined || durata !== undefined) return B.impostaPopup(stato, { elenco, ogniMinuti, durata });
    if (!stato.visibili.popupBattle) throw new Error("I pop-up sono spenti: accendeteli in In onda");
    const { elenco: lista } = stato.battle.popup;
    if (id && !lista.some((c) => c.id === id)) throw new Error("Pop-up non trovato: salvatelo prima");
    if (!id && !lista.some((c) => c.attiva)) throw new Error("Nessun pop-up acceso");
    emetti("popupBattle", id ? { id } : {});
  },
  battleDemo({ fase, secondi }) {
    B.battleDemo(stato, fase, Date.now(), secondi === undefined ? {} : { secondi: Number(secondi) });
  },
  demo() {
    const ora = Date.now();
    const { premio, invito, suoni, giudici, tiktokUtente, neroAutomatico, neroUltimo, layout, senzaPremio, studio, battle } = stato;
    stato = { ...S.statoIniziale(config), premio, invito, suoni, giudici, tiktokUtente, neroAutomatico, neroUltimo, layout, senzaPremio, studio, battle };
    const finti = [
      ["Specchi Neri", "Nove", 8.4],
      ["Fuori Orario", "Kappa 23", 7.9],
      ["Satellite", "Mira", 7.35],
      ["Cromo", "Vale B", 6.8],
    ];
    finti.forEach(([titolo, artista, totale], i) => {
      const id = randomUUID();
      stato.risultati.push({ id, titolo, artista, tier: null, beat: totale, voce: totale, mix: totale, chat: totale, chatVoti: 40 + i * 7, totale, confermatoAlle: ora - (5 - i) * 600_000 });
      stato.ascoltate.push({ id, titolo, artista, tier: null, alle: ora - (5 - i) * 600_000 });
    });
    stato.corrente = S.tracciaVuota({ titolo: "Notti a Vicenza", artista: "Lince", tier: "throne" });
    Object.assign(stato.corrente.voti, { beat: 8.5, voce: 7.5, mix: 9 });
    S.apriVotoChat(stato, config.durataVotoChatSecondi, ora);
    comandi.simulaChat({ quanti: 37 });
    stato.coda = [
      { id: randomUUID(), titolo: "Asfalto", artista: "Dama", tier: "superskip", importo: 15, ricevutoAlle: ora - 60_000 },
      { id: randomUUID(), titolo: "Neon Blu", artista: "Rizzo", tier: "skip", importo: 8, ricevutoAlle: ora - 30_000 },
      { id: randomUUID(), titolo: "Ultimo Treno", artista: "Sole Nero", tier: "standard", importo: null, ricevutoAlle: ora - 10_000 },
    ];
    S.countdown(stato, { azione: "avvia", minuti: config.durataCountdownMinuti }, ora);
  },
  // La traccia che suona su Nero in quel momento torna sul tabellone al giro successivo.
  nuovaSerata() {
    const { premio, invito, suoni, giudici, tiktokUtente, neroAutomatico, layout, senzaPremio, studio, battle } = stato;
    stato = { ...S.statoIniziale(config), premio, invito, suoni, giudici, tiktokUtente, neroAutomatico, layout, senzaPremio, studio, battle: B.battleNuovaSerata(battle) };
  },
};

function esegui(nome, args, pin) {
  if (config.pinRegia && pin !== config.pinRegia) return { ok: false, errore: "PIN regia non valido" };
  if (!Object.hasOwn(comandi, nome)) return { ok: false, errore: `Comando sconosciuto: ${nome}` };
  try {
    const dati = comandi[nome](args && typeof args === "object" ? args : {}) ?? null;
    cambiato();
    return { ok: true, dati };
  } catch (e) {
    return { ok: false, errore: e.message };
  }
}

// Controlli a tempo: chiusura automatica del voto chat e scadenza del countdown.
setInterval(() => {
  const ora = Date.now();
  if (S.chiudiChatSeScaduta(stato, ora)) cambiato();
  if (S.passaSeTocca(stato, ora, ATTESA_DOPO_CONFERMA_MS)) {
    console.log(`Nero.fan: sul tabellone «${stato.corrente.titolo}» di ${stato.corrente.artista}`);
    cambiato();
  }
  // Battle: fine del 3-2-1 e fine del timer, con il gong che le pagine suonano.
  const gong = B.passaSeTocca(stato, ora);
  if (gong.length) {
    for (const e of gong) emetti(e.nome, e.dati);
    cambiato();
  }
  if (stato.countdown.fineAlle !== null && ora >= stato.countdown.fineAlle) {
    const risultato = esito((s) => S.scadenzaCountdown(s, ora));
    console.log(
      risultato?.vincitore
        ? `Countdown scaduto: vince "${risultato.vincitore.titolo}" di ${risultato.vincitore.artista}`
        : risultato?.spareggio
          ? `Countdown scaduto: spareggio tra ${risultato.spareggio.candidati.length} tracce, decidono i giudici`
          : "Countdown scaduto con classifica vuota",
    );
    cambiato();
  }
}, 250);

// --- HTTP ------------------------------------------------------------------------------
async function leggiCorpo(req, limite = 256 * 1024) {
  const pezzi = [];
  let totale = 0;
  for await (const pezzo of req) {
    totale += pezzo.length;
    if (totale > limite) throw new Error("Richiesta troppo grande");
    pezzi.push(pezzo);
  }
  return Buffer.concat(pezzi);
}

function json(res, codice, dati) {
  res.writeHead(codice, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(dati));
}

// Accetta solo indirizzi locali o di rete interna: blocca siti esterni che provano a pilotare la regia.
function hostValido(host = "") {
  const nome = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return /^(localhost|127\.\d+\.\d+\.\d+|::1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[\w-]+\.local)$/i.test(nome);
}

function origineDi(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

// LIVE Studio, prima di accettare una sorgente Link, scarica l'indirizzo con una richiesta dalla sua app:
// i file statici sono pubblici, quindi possono essere letti da qualunque origine.
async function serviFile(res, percorso, soloIntestazioni = false) {
  let file;
  try {
    file = normalize(join(PUBBLICA, PAGINE[percorso] ?? decodeURIComponent(percorso)));
  } catch {
    return res.writeHead(400).end();
  }
  if (!file.startsWith(PUBBLICA + sep)) return res.writeHead(403).end();
  try {
    const dati = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TIPI[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(soloIntestazioni ? undefined : dati);
  } catch {
    res.writeHead(404).end("non trovato");
  }
}

const server = http.createServer(async (req, res) => {
  if (!hostValido(req.headers.host)) return res.writeHead(403).end("host non ammesso");
  const url = new URL(req.url ?? "/", "http://locale");
  try {
    if (url.pathname === "/api/stato" && req.method === "GET") return json(res, 200, istantanea());
    const api = url.pathname.match(/^\/api\/(\w+)$/);
    if (api) {
      if (req.method !== "POST") return json(res, 405, { ok: false, errore: "Usa POST" });
      if (!req.headers["content-type"]?.startsWith("application/json")) {
        return json(res, 415, { ok: false, errore: "Serve Content-Type: application/json" });
      }
      const corpo = await leggiCorpo(req);
      let args;
      try {
        args = corpo.length ? JSON.parse(corpo) : {};
      } catch {
        return json(res, 400, { ok: false, errore: 'Corpo non valido: serve un JSON, es. {"nome": "senzaPremio"}' });
      }
      const risposta = esegui(api[1], args, req.headers["x-pin"]);
      return json(res, risposta.ok ? 200 : 400, risposta);
    }
    if (req.method === "GET" || req.method === "HEAD") return serviFile(res, url.pathname, req.method === "HEAD");
    res.writeHead(405).end();
  } catch (e) {
    json(res, 500, { ok: false, errore: e.message });
  }
});

const wss = new WebSocketServer({
  server,
  path: "/ws",
  // Una pagina di un altro sito non può aprire il WebSocket della regia.
  verifyClient: ({ origin, req }) => hostValido(req.headers.host) && (!origin || origineDi(origin) === req.headers.host),
});

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ tipo: "stato", stato: istantanea(), eventi: [] }));
  ws.on("message", (grezzo) => {
    let msg;
    try {
      msg = JSON.parse(grezzo);
    } catch {
      return;
    }
    if (msg?.tipo !== "comando") return;
    ws.send(JSON.stringify({ tipo: "esito", id: msg.id, ...esegui(msg.nome, msg.args, msg.pin) }));
  });
});

server.listen(config.porta, config.host, () => {
  const base = `http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${config.porta}`;
  console.log(
    `\nOverlay live pronto\n  Regia:   ${base}/regia\n  Overlay: ${base}/overlay.html   (sorgente Link in TikTok LIVE Studio, 1080x1920)\n` +
      `  Senza premio: ${base}/senza-premio.html   (live giornaliere di ascolto, 1080x1920)\n` +
      `  Live session in studio: ${base}/studio.html   (fonico, artista e DAW, 1080x1920)\n` +
      `  Battle: ${base}/battle.html   (scontro tra due rapper, 1080x1920)\n`,
  );
  if (config.host !== "127.0.0.1" && !config.pinRegia) console.warn("Attenzione: server visibile in rete senza pinRegia.");
});

collegaTikTok();
collegaNero();

// --- Webhook Nero.fan: porta separata, così il tunnel pubblico espone solo questo indirizzo --
if (config.nero.portaWebhook) {
  if (!config.nero.segreto) console.warn("Nero.fan: manca nero.segreto in config.json, i webhook verranno rifiutati.");
  http
    .createServer(async (req, res) => {
      if (req.method !== "POST" || new URL(req.url ?? "/", "http://locale").pathname !== "/webhook/nero") {
        return res.writeHead(404).end();
      }
      try {
        const corpo = await leggiCorpo(req, 64 * 1024);
        if (!firmaValida(corpo, req.headers["x-nero-signature"], config.nero.segreto)) {
          console.warn("Nero.fan: webhook con firma non valida, ignorato");
          return res.writeHead(401).end("firma non valida");
        }
        res.writeHead(200).end("ok");
        const voce = versoCoda(JSON.parse(corpo.toString("utf8")), Date.now());
        if (voce && !stato.coda.some((v) => v.id === voce.id)) {
          stato.coda.push(voce);
          emetti("coda", voce);
          cambiato();
          console.log(`Nero.fan: in coda "${voce.titolo}" di ${voce.artista} (${voce.tier})`);
        }
      } catch (e) {
        if (!res.headersSent) res.writeHead(400).end();
        console.error("Nero.fan: webhook non leggibile:", e.message);
      }
    })
    .listen(config.nero.portaWebhook, "127.0.0.1", () =>
      console.log(`Webhook Nero.fan in ascolto su http://127.0.0.1:${config.nero.portaWebhook}/webhook/nero`),
    );
}
