// Logica della serata: voto dei giudici (uno per categoria), voto della chat, totale, classifica,
// countdown e spareggio. Solo funzioni sullo stato, senza I/O: il server le chiama e salva su disco.
import { randomUUID } from "node:crypto";
import { ICONE, oggetto, testo, numeroTra, siNo, arrotonda, normalizzaVoto, pulisciInstagram, controllaComparse } from "./validazione.mjs";
import { battleIniziale, istantaneaBattle } from "./battle.mjs";
import { drumIniziale, istantaneaDrum } from "./drum.mjs";
import { produzioneIniziale, reactionIniziale, podcastIniziale } from "./formati.mjs";

// Questi cinque restano esportati da qui: li usano server, regia e test.
export { ICONE, arrotonda, normalizzaVoto, pulisciInstagram };

export const CATEGORIE = ["beat", "voce", "mix"];
// banner, barra e scheda sono del layout senza premio (banner in alto, barra che scorre, scheda «Ora in ascolto»);
// targa, barraStudio e comparse della live session in studio (nome dell'artista, barra dei social, comparse dello studio);
// barreVita, modalita, timerBattle, giudiciBattle, popupBattle, vittoriaBattle (la schermata del vincitore a tutta pagina)
// e bracket (il tabellone a torneo o a punti) del battle;
// drum* (cornice con equalizzatore, colonna dei traguardi, brano in esecuzione, «Dona un…», fascia social) del Drum Challenge,
// pr* (titolo, fascia) di Studio Production, re* (titolo, fascia) di Reaction Release,
// po* (targa, linea di divisione, pannello Tematiche, fascia) del Back Rooms Podcast.
export const WIDGET = [
  "premio", "tabellone", "classifica", "timer", "banner", "barra", "scheda", "targa", "barraStudio", "comparse",
  "barreVita", "modalita", "timerBattle", "giudiciBattle", "popupBattle", "vittoriaBattle", "bracket",
  "drumCornice", "drumTraguardi", "drumBrano", "drumPriorita", "drumBarra",
  "prTitolo", "prBarra", "reTitolo", "reBarra",
  "poTitolo", "poLinea", "poTematiche", "poBarra",
];
// Partono spenti: il tabellone del battle e i due moduli «a comando» del podcast (linea di divisione, pannello Tematiche).
export const WIDGET_SPENTI = ["bracket", "poLinea", "poTematiche"];
export const DOVE_SUONI = ["overlay", "regia", "spenti"];
// Sotto il premio, a rotazione: spiega a chi entra in live come partecipare. Righe separate da "|".
export const INVITO_PREDEFINITO = "La traccia più votata vince | Manda la tua traccia su nero.fan/backrooms";
// Frasi predefinite delle versioni precedenti: chi non le ha cambiate passa a quella nuova.
export const INVITI_SUPERATI = ["La traccia più votata vince | Manda la tua traccia: link in bio"];
const ORDINE_TIER = { throne: 0, superskip: 1, skip: 2, standard: 3 };
// Layout in onda: la gara con premio (overlay.html), la live giornaliera di ascolto (senza-premio.html)
// la live session in studio (studio.html, split screen fonico · artista · DAW, senza suoni)
// lo scontro tra due rapper (battle.html, barre della vita dal voto della chat, giudici e tabellone),
// la sfida alla batteria (drum.html, Like che sbloccano i brani), Studio Production (produzione.html, webcam e DAW),
// il Back Rooms Podcast (podcast.html, anche 16:9) o la Reaction Release (reaction.html, anche 16:9).
// Suona solo la pagina del layout scelto, così due sorgenti caricate in LIVE Studio non suonano insieme.
export const LAYOUT = ["gara", "senzaPremio", "studio", "battle", "drum", "produzione", "podcast", "reaction"];
const MAX_COMPARSE = 8;
export const TIER_SCHEDA = ["standard", "skip", "superskip", "throne"];
// Suono quando parte una traccia nel layout senza premio: leggero, quello della gara, oppure niente.
export const SUONI_TRACCIA = ["delicato", "pieno", "nessuno"];
const MAX_VOCI = 12;
const MAX_VOCI_ACCESE = 8;
const MAX_ASCOLTATE = 500;
// «Oggi abbiamo ascoltato N tracce» conta la live in corso: se tra una traccia e l'altra passano più di 4 ore
// è un'altra live (il giorno dopo) e il conto riparte. Niente data del calendario: una live a cavallo
// di mezzanotte non si azzera a metà.
export const PAUSA_NUOVA_LIVE_MS = 4 * 3600_000;

export function statoIniziale(config) {
  return {
    corrente: tracciaVuota(),
    risultati: [],
    coda: [],
    countdown: countdownVuoto(),
    vincitore: null,
    spareggio: null,
    premio: config.premio,
    invito: config.invito ?? INVITO_PREDEFINITO,
    suoni: suoniIniziali(config),
    giudici: { ...config.giudici },
    nascondiVoti: false,
    // Il tabellone del battle (bracket) e i moduli a comando del podcast restano spenti finché la regia non li accende.
    visibili: { ...Object.fromEntries(WIDGET.map((w) => [w, true])), ...Object.fromEntries(WIDGET_SPENTI.map((w) => [w, false])) },
    tiktokUtente: config.tiktok ?? "",
    // Traccia in riproduzione su Nero: l'ultima vista e quella in attesa se la traccia attuale ha voti da confermare.
    neroAutomatico: config.nero?.automatico ?? true,
    neroUltimo: null,
    neroInArrivo: null,
    ultimaConfermaAlle: null,
    layout: LAYOUT.includes(config.layout) ? config.layout : "gara",
    senzaPremio: senzaPremioIniziale(),
    studio: studioIniziale(),
    battle: battleIniziale(),
    drum: drumIniziale(),
    produzione: produzioneIniziale(),
    reaction: reactionIniziale(),
    podcast: podcastIniziale(),
    // Tracce ascoltate nella serata (per «Oggi abbiamo ascoltato N tracce»).
    ascoltate: [],
  };
}

// Live giornaliere senza premio: banner «Mandaci la tua musica», barra dei social che scorre,
// scheda «Ora in ascolto» quando su Nero parte una traccia, spot dello studio.
export function senzaPremioIniziale() {
  return {
    sopra: "Mandaci",
    titolo: "La tua musica!",
    pillola: "Link in bio",
    link: "nero.fan/backrooms",
    voci: [
      { id: "nero", attiva: true, icona: "nero", etichetta: "Manda la tua traccia", testo: "nero.fan/backrooms" },
      { id: "social", attiva: true, icona: "instagram+tiktok", etichetta: "Seguici", testo: "@backrooms.studios" },
      { id: "twitch", attiva: true, icona: "twitch", etichetta: "Twitch", testo: "@backrooms_studio" },
      { id: "kick", attiva: true, icona: "kick", etichetta: "Kick", testo: "@backrooms_studio" },
      { id: "sito", attiva: true, icona: "microfono", etichetta: "Registra da noi", testo: "backroomsstudio.it" },
    ],
    velocita: 80, // pixel al secondo
    inAscoltoNellaBarra: true,
    ascoltateNellaBarra: true, // «Oggi abbiamo ascoltato N tracce», da 3 tracce in su
    loghiBarra: true,
    filoCamera: true,
    // Secondi in cui resta la scheda «Ora in ascolto»: chi paga si vede più a lungo.
    durate: { standard: 8, skip: 10, superskip: 12, throne: 15 },
    suonoTraccia: "delicato",
    richiamoOgniMinuti: 5, // il link del banner «chiama» da solo, senza suono (0 = mai)
    spot: { sopra: "Backrooms Studio · Vicenza", titolo: "Vuoi suonare così?", sotto: "Registrazione, mix e master · backroomsstudio.it" },
  };
}

// Uno stato salvato da una versione precedente (senza questi campi, o con solo una parte) li ritrova completi.
// Ogni valore salvato passa dagli stessi controlli della regia: quelli rotti tornano al predefinito.
export function fondiSenzaPremio(salvato) {
  const prova = { senzaPremio: senzaPremioIniziale() };
  if (!oggetto(salvato)) return prova.senzaPremio;
  for (const chiave of Object.keys(prova.senzaPremio)) {
    const valore = salvato[chiave];
    if (valore === undefined) continue;
    // durate e spot campo per campo: una durata rotta non butta via le altre
    const pezzi = (chiave === "durate" || chiave === "spot") && oggetto(valore) ? Object.entries(valore).map(([k, v]) => ({ [chiave]: { [k]: v } })) : [{ [chiave]: valore }];
    for (const modifica of pezzi) {
      try {
        impostaSenzaPremio(prova, modifica);
      } catch {
        // valore non valido: resta il predefinito
      }
    }
  }
  return prova.senzaPremio;
}

// Modifiche dalla regia (o dall'API). Si controlla tutto su una copia: un errore non lascia metà modifica.
export function impostaSenzaPremio(stato, modifiche = {}) {
  const sp = JSON.parse(JSON.stringify(stato.senzaPremio));
  if (modifiche.sopra !== undefined) sp.sopra = testo(modifiche.sopra, 24, "Riga sopra il titolo");
  if (modifiche.titolo !== undefined) sp.titolo = testo(modifiche.titolo, 28, "Titolo del banner", { obbligatorio: true });
  if (modifiche.pillola !== undefined) sp.pillola = testo(modifiche.pillola, 24, "Riga «link in bio»");
  if (modifiche.link !== undefined) sp.link = testo(modifiche.link, 40, "Link del banner", { obbligatorio: true });
  if (modifiche.voci !== undefined) {
    if (!Array.isArray(modifiche.voci)) throw new Error("Barra: serve l'elenco delle voci");
    if (modifiche.voci.length > MAX_VOCI) throw new Error(`Barra: al massimo ${MAX_VOCI} voci`);
    sp.voci = modifiche.voci.map((v, i) => {
      const n = `Barra, voce ${i + 1}`;
      if (!ICONE.includes(v?.icona)) throw new Error(`${n}: icona sconosciuta`);
      const voce = {
        id: typeof v.id === "string" && v.id ? v.id.slice(0, 40) : randomUUID(),
        attiva: v.attiva !== false,
        icona: v.icona,
        etichetta: testo(v.etichetta ?? "", 28, `${n} (etichetta)`),
        testo: testo(v.testo ?? "", 40, `${n} (testo)`),
      };
      if (voce.attiva && !voce.testo) throw new Error(`${n}: manca il testo`);
      return voce;
    });
    const accese = sp.voci.filter((v) => v.attiva).length;
    if (accese > MAX_VOCI_ACCESE) throw new Error(`Barra: al massimo ${MAX_VOCI_ACCESE} voci accese, spegnetene una`);
  }
  if (modifiche.velocita !== undefined) sp.velocita = numeroTra(modifiche.velocita, 40, 160, "Velocità della barra (pixel al secondo)");
  for (const chiave of ["inAscoltoNellaBarra", "ascoltateNellaBarra", "loghiBarra", "filoCamera"]) {
    if (modifiche[chiave] !== undefined) sp[chiave] = siNo(modifiche[chiave], chiave);
  }
  if (modifiche.durate !== undefined) {
    if (!oggetto(modifiche.durate)) throw new Error("Durata della scheda: serve un elenco per tipo di invio, es. {\"throne\": 15}");
    for (const [tier, secondi] of Object.entries(modifiche.durate)) {
      if (!TIER_SCHEDA.includes(tier)) throw new Error("Durata della scheda: tipo di invio sconosciuto");
      sp.durate[tier] = numeroTra(secondi, 4, 20, "Durata della scheda (secondi)");
    }
  }
  if (modifiche.suonoTraccia !== undefined) {
    if (!SUONI_TRACCIA.includes(modifiche.suonoTraccia)) throw new Error("Suono della traccia: delicato, pieno o nessuno");
    sp.suonoTraccia = modifiche.suonoTraccia;
  }
  if (modifiche.richiamoOgniMinuti !== undefined) sp.richiamoOgniMinuti = numeroTra(modifiche.richiamoOgniMinuti, 0, 30, "Richiamo automatico (minuti)");
  if (modifiche.spot !== undefined) {
    if (!oggetto(modifiche.spot)) throw new Error("Spot: servono i testi, es. {\"titolo\": \"Vuoi suonare così?\"}");
    const spot = modifiche.spot;
    if (spot.sopra !== undefined) sp.spot.sopra = testo(spot.sopra, 40, "Spot, riga sopra");
    if (spot.titolo !== undefined) sp.spot.titolo = testo(spot.titolo, 28, "Spot, titolo", { obbligatorio: true });
    if (spot.sotto !== undefined) sp.spot.sotto = testo(spot.sotto, 60, "Spot, riga sotto");
  }
  stato.senzaPremio = sp;
}

export function impostaLayout(stato, nome) {
  if (!LAYOUT.includes(nome)) throw new Error("Layout sconosciuto: gara, senzaPremio, studio, battle, drum, produzione, podcast o reaction");
  stato.layout = nome;
}

// Live session in studio: targa con nome e Instagram dell'artista (scritti dalla regia a ogni sessione),
// barra dei social (gli stessi del layout senza premio) e comparse dello studio, una alla volta e mute.
export function studioIniziale() {
  return {
    etichetta: "Live session in studio",
    artista: "",
    instagram: "", // senza @
    comparse: [
      { id: "studio", attiva: true, icona: "microfono", sopra: "Backrooms Studio · Vicenza", titolo: "Vieni a trovarci in studio", sotto: "Registrazione, mix e master · backroomsstudio.it" },
      { id: "dm", attiva: true, icona: "dm", sopra: "Vuoi una sessione come questa?", titolo: "Scrivici in DM", sotto: "per prenotare la tua sessione · @backrooms.studios" },
    ],
    comparsaOgniMinuti: 4, // le comparse salgono da sole, a turno (0 = solo a mano)
    durataComparsa: 10, // secondi
    velocita: 80, // pixel al secondo della barra
    artistaNellaBarra: true, // «In studio ora: nome · @instagram» tra i social
  };
}

// Modifiche dalla regia (o dall'API), controllate su una copia come per il layout senza premio.
export function impostaStudio(stato, modifiche = {}) {
  const st = JSON.parse(JSON.stringify(stato.studio));
  if (modifiche.etichetta !== undefined) st.etichetta = testo(modifiche.etichetta, 32, "Riga sopra il nome");
  if (modifiche.artista !== undefined) st.artista = testo(modifiche.artista, 32, "Nome dell'artista");
  if (modifiche.instagram !== undefined) st.instagram = pulisciInstagram(modifiche.instagram);
  if (modifiche.comparse !== undefined) st.comparse = controllaComparse(modifiche.comparse, MAX_COMPARSE);
  if (modifiche.comparsaOgniMinuti !== undefined) st.comparsaOgniMinuti = numeroTra(modifiche.comparsaOgniMinuti, 0, 30, "Comparse automatiche (minuti)");
  if (modifiche.durataComparsa !== undefined) st.durataComparsa = numeroTra(modifiche.durataComparsa, 4, 20, "Durata della comparsa (secondi)");
  if (modifiche.velocita !== undefined) st.velocita = numeroTra(modifiche.velocita, 40, 160, "Velocità della barra (pixel al secondo)");
  if (modifiche.artistaNellaBarra !== undefined) st.artistaNellaBarra = siNo(modifiche.artistaNellaBarra, "artistaNellaBarra");
  stato.studio = st;
}

// Stato salvato prima della live session (o con valori rotti): impostazioni complete, quelli buoni restano.
export function fondiStudio(salvato) {
  const prova = { studio: studioIniziale() };
  if (!oggetto(salvato)) return prova.studio;
  for (const chiave of Object.keys(prova.studio)) {
    if (salvato[chiave] === undefined) continue;
    try {
      impostaStudio(prova, { [chiave]: salvato[chiave] });
    } catch {
      // valore non valido: resta il predefinito
    }
  }
  return prova.studio;
}

// Ogni traccia andata in ascolto (con un titolo) conta una volta sola, anche se la regia la rimette.
export function registraAscolto(stato, ora) {
  const t = stato.corrente;
  if (!t.titolo) return false;
  const giaVista = stato.ascoltate.find((a) => a?.id === t.id);
  if (giaVista) {
    // la regia ha corretto il nome: si aggiorna, così rimettendola non conta due volte
    Object.assign(giaVista, { titolo: t.titolo, artista: t.artista, tier: t.tier });
    return false;
  }
  const ultima = stato.ascoltate[stato.ascoltate.length - 1];
  if (ultima && ultima.titolo === t.titolo && ultima.artista === t.artista) return false;
  if (ultima && ora - ultima.alle > PAUSA_NUOVA_LIVE_MS) stato.ascoltate = [];
  stato.ascoltate.push({ id: t.id, titolo: t.titolo, artista: t.artista, tier: t.tier, alle: ora });
  if (stato.ascoltate.length > MAX_ASCOLTATE) stato.ascoltate.splice(0, stato.ascoltate.length - MAX_ASCOLTATE);
  return true;
}

// Quante tracce si sono ascoltate nella live in corso (0 se l'ultima è di un'altra live).
export function ascoltateNellaLive(stato, ora) {
  const ultima = stato.ascoltate[stato.ascoltate.length - 1];
  return ultima && ora - ultima.alle <= PAUSA_NUOVA_LIVE_MS ? stato.ascoltate.length : 0;
}

export const suoniIniziali = (config) => ({ dove: config.suoni?.dove ?? "overlay", volume: config.suoni?.volume ?? 0.8 });

export function impostaSuoni(stato, { dove, volume }) {
  if (dove !== undefined) {
    if (!DOVE_SUONI.includes(dove)) throw new Error("Scegli dove suonano: overlay, regia o spenti");
    stato.suoni.dove = dove;
  }
  if (volume !== undefined) {
    const v = Number(volume);
    if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error("Volume tra 0 e 1");
    stato.suoni.volume = Math.round(v * 100) / 100;
  }
}

export const haVoti = (traccia) => CATEGORIE.some((c) => traccia.voti[c] !== null) || Object.keys(traccia.chat.voti).length > 0;

// Nuova traccia in riproduzione su Nero: va da sola sul tabellone. Nella gara aspetta in neroInArrivo se quella
// attuale ha voti non ancora confermati (la regia conferma con F4), oppure se è stata confermata da meno
// di `attesaMs` (il pubblico vede il punteggio e la classifica che si muove); poi passa con passaSeTocca.
export function tracciaDaNero(stato, traccia, { ora = 0, attesaMs = 0 } = {}) {
  if (!traccia || traccia.neroId === stato.neroUltimo) return false;
  stato.neroUltimo = traccia.neroId;
  if (!stato.neroAutomatico) return true;
  const { titolo, artista, tier } = traccia;
  stato.coda = stato.coda.filter((v) => !(v.titolo === titolo && v.artista === artista));
  if (stato.corrente.titolo === titolo && stato.corrente.artista === artista) return true;
  // Si vota solo nella gara: negli altri layout la traccia passa subito, anche se restano voti di una gara.
  const aspetta =
    stato.layout === "gara" &&
    (stato.corrente.confermato ? attesaMs > 0 && ora - (stato.ultimaConfermaAlle ?? -Infinity) < attesaMs : haVoti(stato.corrente));
  if (aspetta) {
    stato.neroInArrivo = { titolo, artista, tier };
  } else {
    stato.corrente = tracciaVuota({ titolo, artista, tier });
    stato.neroInArrivo = null;
  }
  return true;
}

// La traccia arrivata da Nero durante il voto passa sul tabellone da sola `attesaMs` dopo la conferma.
// Se dopo la conferma la regia cambia un voto (non più confermata), aspetta la nuova conferma.
// Fuori dalla gara passa subito (per esempio se la regia cambia layout con una traccia in attesa).
export function passaSeTocca(stato, ora, attesaMs) {
  if (!stato.neroAutomatico || !stato.neroInArrivo) return false;
  if (stato.layout === "gara") {
    if (!stato.corrente.confermato) return false;
    if (ora - (stato.ultimaConfermaAlle ?? -Infinity) < attesaMs) return false;
  }
  prossima(stato);
  return true;
}

// «Prossima»: se da Nero è arrivata una traccia mentre si votava, passa a quella.
export function prossima(stato) {
  stato.corrente = tracciaVuota(stato.neroInArrivo ?? {});
  stato.neroInArrivo = null;
}

export function tracciaVuota(dati = {}) {
  return {
    id: randomUUID(),
    titolo: dati.titolo ?? "",
    artista: dati.artista ?? "",
    tier: dati.tier ?? null,
    voti: Object.fromEntries(CATEGORIE.map((c) => [c, null])),
    chat: { aperta: false, chiudeAlle: null, voti: {}, ultimi: [] },
    confermato: false,
  };
}

const countdownVuoto = () => ({ fineAlle: null, rimanenteMs: null, scaduto: false });
const countdownChiuso = () => ({ fineAlle: null, rimanenteMs: null, scaduto: true });

export function media(valori) {
  const numeri = valori.filter((v) => typeof v === "number");
  return numeri.length ? numeri.reduce((a, b) => a + b, 0) / numeri.length : null;
}

// Voto di ogni categoria e totale pesato (0–10). Le categorie ancora senza voto non pesano.
export function punteggi(traccia, pesi) {
  const votiChat = Object.values(traccia.chat.voti);
  const parti = { ...traccia.voti, chat: media(votiChat) };
  let somma = 0;
  let pesoTotale = 0;
  for (const [nome, valore] of Object.entries(parti)) {
    if (valore === null || !(pesi[nome] > 0)) continue;
    somma += valore * pesi[nome];
    pesoTotale += pesi[nome];
  }
  return { ...parti, chatVoti: votiChat.length, totale: pesoTotale ? somma / pesoTotale : null };
}

// Ordine di classifica: totale, poi chi è stato confermato prima.
// I pari merito in testa non si risolvono qui: alla fine decidono i giudici (spareggio).
export function confronta(a, b) {
  return b.totale - a.totale || a.confermatoAlle - b.confermatoAlle;
}

export const classifica = (risultati, n) => [...risultati].sort(confronta).slice(0, n);

export function primiPariMerito(risultati) {
  const ordinati = [...risultati].sort(confronta);
  return ordinati.filter((r) => r.totale === ordinati[0]?.totale);
}

export const ordinaCoda = (coda) =>
  [...coda].sort((a, b) => (ORDINE_TIER[a.tier] ?? 9) - (ORDINE_TIER[b.tier] ?? 9) || a.ricevutoAlle - b.ricevutoAlle);

export function impostaVoto(stato, { categoria, valore }) {
  if (!CATEGORIE.includes(categoria)) throw new Error("Categoria non valida");
  stato.corrente.voti[categoria] = normalizzaVoto(valore);
  stato.corrente.confermato = false;
}

export function apriVotoChat(stato, secondi, ora) {
  const chat = stato.corrente.chat;
  chat.aperta = true;
  chat.chiudeAlle = secondi > 0 ? ora + secondi * 1000 : null;
  stato.corrente.confermato = false;
}

export function chiudiVotoChat(stato) {
  stato.corrente.chat.aperta = false;
  stato.corrente.chat.chiudeAlle = null;
}

export function chiudiChatSeScaduta(stato, ora) {
  const chat = stato.corrente.chat;
  if (!chat.aperta || chat.chiudeAlle === null || ora < chat.chiudeAlle) return false;
  chiudiVotoChat(stato);
  return true;
}

// Un voto per utente: se riscrive, vale l'ultimo. Fuori dalla finestra di voto non conta.
export function votoChat(stato, { piattaforma, utente }, valore, ora) {
  const chat = stato.corrente.chat;
  if (!chat.aperta || !utente || valore === null) return false;
  if (chat.chiudeAlle !== null && ora >= chat.chiudeAlle) return false;
  const chiave = `${piattaforma}:${String(utente).toLowerCase()}`;
  chat.voti[chiave] = valore;
  chat.ultimi = [{ chiave, utente, piattaforma, valore }, ...chat.ultimi.filter((u) => u.chiave !== chiave)].slice(0, 8);
  return true;
}

// Fissa il punteggio della traccia in ascolto e dice come cambia la classifica.
// Riconfermare la stessa traccia (dopo una correzione) aggiorna il risultato senza duplicarlo.
export function conferma(stato, config, ora) {
  const traccia = stato.corrente;
  const p = punteggi(traccia, config.pesi);
  if (p.totale === null) throw new Error("Nessun voto inserito per questa traccia");
  chiudiVotoChat(stato);

  const primaTop = classifica(stato.risultati, config.topN).map((r) => r.id);
  const precedente = stato.risultati.find((r) => r.id === traccia.id);
  const risultato = {
    id: traccia.id,
    titolo: traccia.titolo || "Senza titolo",
    artista: traccia.artista || "Artista sconosciuto",
    tier: traccia.tier,
    beat: traccia.voti.beat,
    voce: traccia.voti.voce,
    mix: traccia.voti.mix,
    chat: arrotonda(p.chat, 2),
    chatVoti: p.chatVoti,
    totale: arrotonda(p.totale, 2),
    confermatoAlle: precedente?.confermatoAlle ?? ora,
  };
  stato.risultati = [...stato.risultati.filter((r) => r.id !== traccia.id), risultato];
  traccia.confermato = true;
  stato.ultimaConfermaAlle = ora;

  const ordinati = [...stato.risultati].sort(confronta);
  const posizione = ordinati.findIndex((r) => r.id === traccia.id) + 1;
  const dopoTop = ordinati.slice(0, config.topN).map((r) => r.id);
  return {
    risultato,
    posizione,
    inTop: posizione <= config.topN,
    entrata: posizione <= config.topN && !primaTop.includes(traccia.id),
    uscito: primaTop.find((id) => !dopoTop.includes(id)) ?? null,
  };
}

export function countdown(stato, { azione, minuti = 0 }, ora) {
  const c = stato.countdown;
  const ms = Number(minuti) * 60_000;
  switch (azione) {
    case "avvia":
      if (!(ms > 0)) throw new Error("Durata del countdown non valida");
      stato.countdown = { fineAlle: ora + ms, rimanenteMs: null, scaduto: false };
      stato.vincitore = null;
      stato.spareggio = null;
      break;
    case "pausa":
      if (c.fineAlle !== null) stato.countdown = { ...c, fineAlle: null, rimanenteMs: Math.max(0, c.fineAlle - ora) };
      break;
    case "riprendi":
      if (c.rimanenteMs !== null) stato.countdown = { ...c, fineAlle: ora + c.rimanenteMs, rimanenteMs: null };
      break;
    case "aggiungi":
      if (c.fineAlle !== null) c.fineAlle = Math.max(ora, c.fineAlle + ms);
      else if (c.rimanenteMs !== null) c.rimanenteMs = Math.max(0, c.rimanenteMs + ms);
      break;
    case "azzera":
      stato.countdown = countdownVuoto();
      break;
    default:
      throw new Error("Azione countdown non valida");
  }
}

// Allo scadere chiude la gara. Restituisce l'esito di proclama, oppure undefined se non è ancora scaduto.
export function scadenzaCountdown(stato, ora) {
  const c = stato.countdown;
  if (c.fineAlle === null || ora < c.fineAlle) return undefined;
  return proclama(stato, ora);
}

// Chiude la gara. Con un solo primo lo proclama; con più primi a pari merito apre lo spareggio
// (scelgono i giudici dalla regia, passando l'id). Restituisce null se la classifica è vuota.
export function proclama(stato, ora, id = null) {
  const candidati = id ? stato.risultati.filter((r) => r.id === id) : primiPariMerito(stato.risultati);
  if (id && !candidati.length) throw new Error("Traccia non trovata in classifica");
  stato.countdown = countdownChiuso();
  if (!candidati.length) return null;
  if (candidati.length > 1) {
    stato.spareggio = { candidati, dal: ora };
    stato.vincitore = null;
    return { spareggio: stato.spareggio };
  }
  stato.spareggio = null;
  stato.vincitore = { ...candidati[0], premio: stato.premio, proclamatoAlle: ora, visibile: true };
  return { vincitore: stato.vincitore };
}

// Quello che ricevono overlay e regia a ogni aggiornamento.
export function istantanea(stato, config, ora) {
  const t = stato.corrente;
  const ordinati = [...stato.risultati].sort(confronta);
  const posizione = ordinati.findIndex((r) => r.id === t.id) + 1;
  return {
    ora,
    giudici: stato.giudici,
    topN: config.topN,
    premio: stato.premio,
    invito: stato.invito,
    suoni: stato.suoni,
    durataCountdownMinuti: config.durataCountdownMinuti,
    nascondiVoti: stato.nascondiVoti,
    visibili: stato.visibili,
    corrente: {
      id: t.id,
      titolo: t.titolo,
      artista: t.artista,
      tier: t.tier,
      confermato: t.confermato,
      punteggi: punteggi(t, config.pesi),
      posizione: t.confermato && posizione > 0 ? posizione : null,
      chat: { aperta: t.chat.aperta, chiudeAlle: t.chat.chiudeAlle, ultimi: t.chat.ultimi },
    },
    classifica: ordinati.slice(0, config.topN),
    risultati: ordinati,
    coda: ordinaCoda(stato.coda),
    countdown: stato.countdown,
    vincitore: stato.vincitore,
    spareggio: stato.spareggio,
    layout: stato.layout,
    senzaPremio: stato.senzaPremio,
    studio: stato.studio,
    battle: istantaneaBattle(stato.battle),
    drum: istantaneaDrum(stato.drum),
    produzione: stato.produzione,
    reaction: stato.reaction,
    podcast: stato.podcast,
    ascoltate: ascoltateNellaLive(stato, ora),
  };
}
