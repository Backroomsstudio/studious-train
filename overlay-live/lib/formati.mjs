// Regole dei layout «Studio Production», «Reaction Release» e «Back Rooms Podcast».
// Solo funzioni pure: i modificatori lavorano su `stato.<formato>`, come per lo studio e il battle.
import { randomUUID } from "node:crypto";
import { ICONE, corpo, numeroTra, oggetto, testo, velocitaFascia } from "./validazione.mjs";
import { controllaRichieste, impostaMappatura, richiesteIniziali } from "./regali.mjs";
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
  produzione: { sopra: 40, testo: 36, sotto: 60 },
  reaction: { sopra: 48, testo: 60, sotto: 60 },
  podcast: { testo: 40, sotto: 60 },
};
const NOMI_RIGHE = { sopra: "Riga sopra il titolo", testo: "Titolo", sotto: "Riga sotto il titolo" };

const presetNoto = (preset) => typeof preset === "string" && Object.hasOwn(PRESET_TITOLI, preset);

export function produzioneIniziale() {
  const { sopra, testo: titolo, sotto } = PRESET_TITOLI.cooking;
  return { titolo: { preset: "cooking", sopra, testo: titolo, sotto }, velocita: 80, testi: testiBase("produzione"), salvati: [] };
}

// Titoli che la regia si tiene da parte per riusarli con un tocco (accento e icona sono quelli del preset in onda).
export const MAX_SALVATI = 6;
const MAX_NOME_SALVATO = 24;

function titoloSalvato(voce, i) {
  const n = `Titolo salvato ${i + 1}`;
  if (!oggetto(voce)) throw new Error(`${n}: servono nome e righe`);
  const { sopra, testo: scritta, sotto } = LIMITI_TITOLO.produzione;
  const accento = typeof voce.accento === "string" ? voce.accento : "oro";
  const icona = typeof voce.icona === "string" ? voce.icona : "cappello";
  if (typeof voce.id !== "string" || !voce.id) throw new Error(`${n}: manca l'id`);
  return {
    id: voce.id.slice(0, 40),
    nome: testo(voce.nome, MAX_NOME_SALVATO, `${n} (nome)`, { obbligatorio: true }),
    sopra: testo(voce.sopra ?? "", sopra, n),
    testo: testo(voce.testo, scritta, n, { obbligatorio: true }),
    sotto: testo(voce.sotto ?? "", sotto, n),
    accento,
    icona,
  };
}

// L'elenco dei titoli salvati con le modifiche date (salva, usa e togli sono già stati scritti su `nuova`).
function salvaTitolo(nuova, dati) {
  if (!oggetto(dati)) throw new Error("Salva: serve il nome");
  const nome = testo(dati.nome ?? "", MAX_NOME_SALVATO, "Nome del titolo salvato", { obbligatorio: true });
  if (nuova.salvati.some((v) => v.nome.toLowerCase() === nome.toLowerCase())) throw new Error("Esiste già un titolo salvato con questo nome");
  if (nuova.salvati.length >= MAX_SALVATI) throw new Error(`Titoli salvati: al massimo ${MAX_SALVATI}, toglierne uno prima`);
  const { accento, icona } = PRESET_TITOLI[nuova.titolo.preset] ?? PRESET_TITOLI.cooking;
  const { sopra, testo: scritta, sotto } = nuova.titolo;
  nuova.salvati = [...nuova.salvati, { id: randomUUID(), nome, sopra, testo: scritta, sotto, accento, icona }];
}

function trovaSalvato(nuova, id) {
  const voce = typeof id === "string" ? nuova.salvati.find((v) => v.id === id) : undefined;
  if (!voce) throw new Error("Titolo salvato non trovato");
  return voce;
}

export function reactionIniziale() {
  return {
    titolo: { sopra: "Ogni giovedì · ore 01:00", testo: "REACTION RELEASE DELLA SETTIMANA", sotto: "" },
    velocita: 80,
    testi: testiBase("reaction"),
    // Le tracce della serata (scritte dalla regia): sempre in onda, oppure a comparsa ogni `ogniMinuti` per `durataSecondi`.
    scaletta: { titolo: "In scaletta stasera", voci: [], modo: "fisso", ogniMinuti: 5, durataSecondi: 15 },
    // Richieste dei donatori: `regalo` è il regalo che le fa partire; la regia scrive a mano il brano di ognuna.
    richieste: richiesteIniziali(),
    durataRichiesta: 10, // secondi in cui una richiesta resta in vista quando va in onda
  };
}

export const MAX_VOCI_SCALETTA = 8;
const MAX_VOCE = 60;

// La scaletta con le modifiche date (anche un solo campo), controllate su una copia.
function scalettaCon(attuale, modifiche) {
  if (!oggetto(modifiche)) throw new Error("Scaletta: servono titolo, voci, modo, ogniMinuti o durataSecondi");
  const nuova = { ...attuale, voci: [...attuale.voci] };
  if (modifiche.titolo !== undefined) nuova.titolo = testo(modifiche.titolo, 32, "Titolo della scaletta");
  if (modifiche.voci !== undefined) {
    if (!Array.isArray(modifiche.voci)) throw new Error("Scaletta: serve l'elenco delle voci");
    if (modifiche.voci.length > MAX_VOCI_SCALETTA) throw new Error(`Scaletta: al massimo ${MAX_VOCI_SCALETTA} voci`);
    nuova.voci = modifiche.voci.map((v, i) => testo(v, MAX_VOCE, `Scaletta, voce ${i + 1}`, { obbligatorio: true }));
  }
  if (modifiche.modo !== undefined) {
    if (!["fisso", "comparsa"].includes(modifiche.modo)) throw new Error("Modo della scaletta: fisso o comparsa");
    nuova.modo = modifiche.modo;
  }
  if (modifiche.ogniMinuti !== undefined) nuova.ogniMinuti = numeroTra(modifiche.ogniMinuti, 1, 60, "Ogni quanti minuti compare la scaletta");
  if (modifiche.durataSecondi !== undefined) nuova.durataSecondi = numeroTra(modifiche.durataSecondi, 5, 120, "Secondi in vista della scaletta");
  return nuova;
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
  const { titolo, preset, velocita, salva, usa, togli } = corpo(dati, "Produzione");
  const nuova = { ...stato.produzione, titolo: { ...stato.produzione.titolo }, salvati: [...(stato.produzione.salvati ?? [])] };
  if (preset !== undefined) {
    if (!presetNoto(preset)) throw new Error("Preset sconosciuto: cooking, sessione o mix");
    const { sopra, testo: scritta, sotto } = PRESET_TITOLI[preset];
    nuova.titolo = { preset, sopra, testo: scritta, sotto };
  }
  if (titolo !== undefined) nuova.titolo = titoloCon(nuova.titolo, titolo, "produzione");
  if (velocita !== undefined) nuova.velocita = velocitaFascia(velocita);
  if (usa !== undefined) {
    const { sopra, testo: scritta, sotto } = trovaSalvato(nuova, usa);
    nuova.titolo = { ...nuova.titolo, sopra, testo: scritta, sotto };
  }
  if (togli !== undefined) {
    const { id } = trovaSalvato(nuova, togli);
    nuova.salvati = nuova.salvati.filter((v) => v.id !== id);
  }
  if (salva !== undefined) salvaTitolo(nuova, salva);
  stato.produzione = nuova;
}

// Come la produzione, con i limiti della reaction e senza preset: il titolo si scrive a mano.
export function impostaReaction(stato, dati) {
  const { titolo, velocita, scaletta, regalo, durataRichiesta } = corpo(dati, "Reaction");
  const nuova = { ...stato.reaction, titolo: { ...stato.reaction.titolo }, richieste: structuredClone(stato.reaction.richieste) };
  if (titolo !== undefined) nuova.titolo = titoloCon(nuova.titolo, titolo, "reaction");
  if (velocita !== undefined) nuova.velocita = velocitaFascia(velocita);
  if (scaletta !== undefined) nuova.scaletta = scalettaCon(nuova.scaletta, scaletta);
  if (regalo !== undefined) impostaMappatura(nuova.richieste, regalo);
  if (durataRichiesta !== undefined) nuova.durataRichiesta = numeroTra(durataRichiesta, 3, 60, "Secondi della richiesta in onda");
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
  const produzione = fondiFormato("produzione", iniziale, impostaProduzione, salvato);
  // I titoli salvati si ritrovano uno a uno: le voci rotte o con un id già visto escono.
  const visti = new Set();
  const nomi = new Set();
  if (oggetto(salvato) && Array.isArray(salvato.salvati)) {
    salvato.salvati.forEach((voce, i) => {
      try {
        const v = titoloSalvato(voce, i);
        if (visti.has(v.id) || nomi.has(v.nome.toLowerCase()) || produzione.salvati.length >= MAX_SALVATI) return;
        visti.add(v.id);
        nomi.add(v.nome.toLowerCase());
        produzione.salvati.push(v);
      } catch {
        // voce rotta: si scarta
      }
    });
  }
  return produzione;
}

// Scaletta e durata della richiesta si ritrovano campo per campo; la coda delle richieste passa dal controllo di regali.mjs.
export function fondiReaction(salvato) {
  const pezziDi = (s) => [
    ...(oggetto(s.scaletta) ? ["titolo", "voci", "modo", "ogniMinuti", "durataSecondi"].filter((c) => s.scaletta[c] !== undefined).map((c) => ({ scaletta: { [c]: s.scaletta[c] } })) : []),
    ...(s.durataRichiesta !== undefined ? [{ durataRichiesta: s.durataRichiesta }] : []),
  ];
  const reaction = fondiFormato("reaction", reactionIniziale(), impostaReaction, salvato, pezziDi);
  if (oggetto(salvato)) reaction.richieste = controllaRichieste(salvato.richieste);
  return reaction;
}

// ---------- Back Rooms Podcast ----------

const MAX_OSPITI = 4;
const MAX_TEMATICHE = 8;
const LATI_PANNELLO = ["sx", "dx"];

export function podcastIniziale() {
  return {
    titolo: { testo: "Back Rooms Podcast", sotto: "" },
    ospiti: [],
    etichette: { ospite: "Ospite" },
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
  const { titolo, ospiti, tematiche, velocita, etichette } = corpo(dati, "Podcast");
  const nuovo = { ...stato.podcast, titolo: { ...stato.podcast.titolo }, tematiche: { ...stato.podcast.tematiche }, etichette: { ospite: "Ospite", ...stato.podcast.etichette } };
  if (etichette !== undefined) {
    if (!oggetto(etichette)) throw new Error("Diciture: serve l'oggetto con la dicitura dell'ospite");
    for (const [chiave, valore] of Object.entries(etichette)) {
      if (chiave !== "ospite") throw new Error(`Dicitura sconosciuta: ${chiave}`);
      nuovo.etichette.ospite = testo(valore, 40, "Dicitura degli ospiti", { obbligatorio: true });
    }
  }
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
    ...(oggetto(s.etichette) && s.etichette.ospite !== undefined ? [{ etichette: { ospite: s.etichette.ospite } }] : []),
    ...(oggetto(s.tematiche) ? ["elenco", "lato", "titolo", "attiva"].filter((c) => s.tematiche[c] !== undefined).map((c) => ({ tematiche: { [c]: s.tematiche[c] } })) : []),
  ]);
