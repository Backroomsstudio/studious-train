// Regole dei layout «Studio Production», «Reaction Release» e «Back Rooms Podcast».
// Solo funzioni pure: i modificatori lavorano su `stato.<formato>`, come per lo studio e il battle.
import { ICONE, corpo, oggetto, testo, velocitaFascia } from "./validazione.mjs";
import { controllaTesti, testiBase } from "./testi.mjs";

// ---------- Titolo del layout (produzione, reaction e podcast) ----------

// I tre titoli pronti di Studio Production. `accento` e `icona` li usa la pagina per lo stile (restano a `titolo.preset`).
export const PRESET_TITOLI = {
  cooking: { sopra: "Backrooms Studio · Live", testo: "Cooking Beats", sotto: "Un beat da zero, in diretta", accento: "oro", icona: "cappello" },
  sessione: { sopra: "Backrooms Studio · Live", testo: "Sessione Beat", sotto: "In studio con il producer", accento: "magenta", icona: "cuffie" },
  mix: { sopra: "Backrooms Studio · Live", testo: "Mix & Master", sotto: "Mix e master in diretta", accento: "ciano", icona: "manopole" },
};

// Righe del titolo di ogni formato con il loro limite di caratteri (il titolo vero non può mancare).
const LIMITI_TITOLO = {
  produzione: { sopra: 32, testo: 28, sotto: 48 },
  reaction: { sopra: 40, testo: 60, sotto: 60 },
  podcast: { testo: 32, sotto: 48 },
};
const NOMI_RIGHE = { sopra: "Riga sopra il titolo", testo: "Titolo", sotto: "Riga sotto il titolo" };

const presetNoto = (preset) => typeof preset === "string" && Object.hasOwn(PRESET_TITOLI, preset);

export function produzioneIniziale() {
  const { sopra, testo: titolo, sotto } = PRESET_TITOLI.cooking;
  return { titolo: { preset: "cooking", sopra, testo: titolo, sotto }, velocita: 80, testi: testiBase("produzione") };
}

export function reactionIniziale() {
  return {
    titolo: { sopra: "Ogni giovedì · ore 01:00", testo: "REACTION RELEASE DELLA SETTIMANA", sotto: "" },
    velocita: 80,
    testi: testiBase("reaction"),
  };
}

// Il titolo con le modifiche date (anche una sola riga): ogni riga con il suo limite, le altre non entrano.
function titoloCon(attuale, modifiche, formato) {
  if (!oggetto(modifiche)) throw new Error("Titolo: servono i testi (sopra, testo, sotto)");
  const nuovo = { ...attuale };
  for (const [riga, limite] of Object.entries(LIMITI_TITOLO[formato])) {
    if (modifiche[riga] !== undefined) nuovo[riga] = testo(modifiche[riga], limite, NOMI_RIGHE[riga], { obbligatorio: riga === "testo" });
  }
  return nuovo;
}

// Dalla regia: un preset riempie le tre righe (e ne sceglie lo stile), un `titolo` nella stessa chiamata prevale campo
// per campo, la velocità è quella della fascia social. Si controlla tutto su una copia: nessuna metà modifica.
export function impostaProduzione(stato, dati) {
  const { titolo, preset, velocita } = corpo(dati, "Produzione");
  const nuova = { ...stato.produzione, titolo: { ...stato.produzione.titolo } };
  if (preset !== undefined) {
    if (!presetNoto(preset)) throw new Error("Preset sconosciuto: cooking, sessione o mix");
    const { sopra, testo: scritta, sotto } = PRESET_TITOLI[preset];
    nuova.titolo = { preset, sopra, testo: scritta, sotto };
  }
  if (titolo !== undefined) nuova.titolo = titoloCon(nuova.titolo, titolo, "produzione");
  if (velocita !== undefined) nuova.velocita = velocitaFascia(velocita);
  stato.produzione = nuova;
}

// Come la produzione, con i limiti della reaction e senza preset: il titolo si scrive a mano.
export function impostaReaction(stato, dati) {
  const { titolo, velocita } = corpo(dati, "Reaction");
  const nuova = { ...stato.reaction, titolo: { ...stato.reaction.titolo } };
  if (titolo !== undefined) nuova.titolo = titoloCon(nuova.titolo, titolo, "reaction");
  if (velocita !== undefined) nuova.velocita = velocitaFascia(velocita);
  stato.reaction = nuova;
}

// Stato salvato da una versione senza questo layout, o con valori rotti: partenza completa, i valori buoni restano
// campo per campo (un campo rotto non scarta gli altri). Ogni pezzo salvato passa dal modificatore della regia; velocità e
// dimensione dei testi si controllano come lì. Mai eccezioni.
function fondiFormato(formato, iniziale, imposta, salvato, pezziDi = () => []) {
  const stato = { [formato]: iniziale };
  if (!oggetto(salvato)) return stato[formato];
  const titolo = oggetto(salvato.titolo) ? salvato.titolo : {};
  const pezzi = [
    ...Object.keys(LIMITI_TITOLO[formato]).filter((riga) => titolo[riga] !== undefined).map((riga) => ({ titolo: { [riga]: titolo[riga] } })),
    ...pezziDi(salvato),
  ];
  if (salvato.velocita !== undefined) pezzi.push({ velocita: salvato.velocita });
  for (const pezzo of pezzi) {
    try {
      imposta(stato, pezzo);
    } catch {
      // valore non valido: resta il predefinito
    }
  }
  try {
    stato[formato].testi = controllaTesti(formato, salvato.testi);
  } catch {
    // dimensioni non valide: tutte al 100%
  }
  return stato[formato];
}

// Dallo stato salvato il preset è solo lo stile (accento e icona): i testi non si riempiono da soli.
export function fondiProduzione(salvato) {
  const iniziale = produzioneIniziale();
  const preset = oggetto(salvato) && oggetto(salvato.titolo) ? salvato.titolo.preset : undefined;
  if (presetNoto(preset)) iniziale.titolo.preset = preset;
  return fondiFormato("produzione", iniziale, impostaProduzione, salvato);
}

export const fondiReaction = (salvato) => fondiFormato("reaction", reactionIniziale(), impostaReaction, salvato);

// ---------- Back Rooms Podcast ----------

const MAX_OSPITI = 4;
const MAX_TEMATICHE = 8;
const LATI_PANNELLO = ["sx", "dx"];

export function podcastIniziale() {
  return {
    titolo: { testo: "Back Rooms Podcast", sotto: "" },
    ospiti: [],
    tematiche: { titolo: "Tematiche di oggi", elenco: [], attiva: 0, lato: "sx" },
    velocita: 80,
    testi: testiBase("podcast"),
  };
}

// Gli ospiti sulla fascia social: nome, contatto e icona (instagram se manca). Si accetta l'elenco intero o niente.
function controllaOspiti(lista) {
  if (!Array.isArray(lista)) throw new Error("Ospiti: serve l'elenco");
  if (lista.length > MAX_OSPITI) throw new Error(`Ospiti: al massimo ${MAX_OSPITI}`);
  return Array.from(lista, (o, i) => {
    const n = `Ospite ${i + 1}`;
    if (!oggetto(o)) throw new Error(`${n}: servono nome, contatto e icona`);
    const icona = o.icona ?? "instagram";
    if (!ICONE.includes(icona)) throw new Error(`${n}: icona sconosciuta`);
    return { nome: testo(o.nome ?? "", 24, `${n} (nome)`, { obbligatorio: true }), handle: testo(o.handle ?? "", 40, `${n} (contatto)`), icona };
  });
}

// Il pannello Tematiche con le modifiche date; l'attiva resta sempre dentro l'elenco (con l'elenco vuoto è 0).
function tematicheCon(attuali, modifiche) {
  if (!oggetto(modifiche)) throw new Error("Tematiche: servono titolo, elenco, lato o attiva");
  const nuove = { ...attuali };
  if (modifiche.titolo !== undefined) nuove.titolo = testo(modifiche.titolo, 32, "Titolo del pannello Tematiche", { obbligatorio: true });
  if (modifiche.elenco !== undefined) {
    if (!Array.isArray(modifiche.elenco)) throw new Error("Tematiche: serve l'elenco delle voci");
    if (modifiche.elenco.length > MAX_TEMATICHE) throw new Error(`Tematiche: al massimo ${MAX_TEMATICHE} voci`);
    nuove.elenco = Array.from(modifiche.elenco, (voce, i) => testo(voce, 48, `Tematica ${i + 1}`, { obbligatorio: true }));
  }
  if (modifiche.lato !== undefined) {
    if (!LATI_PANNELLO.includes(modifiche.lato)) throw new Error("Lato del pannello: sx o dx");
    nuove.lato = modifiche.lato;
  }
  if (modifiche.attiva !== undefined) {
    if (!Number.isInteger(modifiche.attiva)) throw new Error("Tematica attiva: serve un numero intero");
    nuove.attiva = modifiche.attiva;
  }
  nuove.attiva = Math.min(Math.max(0, nuove.attiva), Math.max(0, nuove.elenco.length - 1));
  return nuove;
}

// Dalla regia: titolo (anche una riga sola), ospiti, tematiche e velocità della fascia. Tutto su una copia.
export function impostaPodcast(stato, dati) {
  const { titolo, ospiti, tematiche, velocita } = corpo(dati, "Podcast");
  const nuovo = { ...stato.podcast, titolo: { ...stato.podcast.titolo }, tematiche: { ...stato.podcast.tematiche } };
  if (titolo !== undefined) nuovo.titolo = titoloCon(nuovo.titolo, titolo, "podcast");
  if (ospiti !== undefined) nuovo.ospiti = controllaOspiti(ospiti);
  if (tematiche !== undefined) nuovo.tematiche = tematicheCon(nuovo.tematiche, tematiche);
  if (velocita !== undefined) nuovo.velocita = velocitaFascia(velocita);
  stato.podcast = nuovo;
}

// Stream Deck e scorciatoie: un passo avanti o indietro (senza giri) o una tematica precisa.
export function spostaTematica(stato, dati) {
  const { avanti, indietro, indice } = corpo(dati, "Tematica");
  const tematiche = stato.podcast.tematiche;
  const ultima = tematiche.elenco.length - 1;
  if (ultima < 0) throw new Error("Non ci sono tematiche");
  if ([avanti === true, indietro === true, indice !== undefined].filter(Boolean).length !== 1) {
    throw new Error("Tematica: serve avanti, indietro o indice (uno solo)");
  }
  if (avanti === true) tematiche.attiva = Math.min(ultima, tematiche.attiva + 1);
  else if (indietro === true) tematiche.attiva = Math.max(0, tematiche.attiva - 1);
  else {
    if (!Number.isInteger(indice) || indice < 0 || indice > ultima) throw new Error("Tematica inesistente");
    tematiche.attiva = indice;
  }
}

// Nuova serata: elenco, ospiti e titolo restano, si riparte dalla prima tematica.
export function podcastNuovaSerata(podcast) {
  const nuovo = structuredClone(podcast);
  nuovo.tematiche.attiva = 0;
  return nuovo;
}

// L'elenco dei pezzi del pannello va in questo ordine: l'attiva si riallinea all'elenco già fuso.
export const fondiPodcast = (salvato) =>
  fondiFormato("podcast", podcastIniziale(), impostaPodcast, salvato, (s) => [
    ...(s.ospiti !== undefined ? [{ ospiti: s.ospiti }] : []),
    ...(oggetto(s.tematiche) ? ["elenco", "lato", "titolo", "attiva"].filter((c) => s.tematiche[c] !== undefined).map((c) => ({ tematiche: { [c]: s.tematiche[c] } })) : []),
  ]);
