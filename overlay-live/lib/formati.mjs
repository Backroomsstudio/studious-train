// Regole dei layout «Studio Production» e «Reaction Release» (e, più avanti, del Back Rooms Podcast).
// Solo funzioni pure: i modificatori lavorano su `stato.<formato>`, come per lo studio e il battle.
import { corpo, oggetto, testo, velocitaFascia } from "./validazione.mjs";
import { controllaTesti, testiBase } from "./testi.mjs";

// ---------- Titolo con riga sopra e sotto (produzione e reaction) ----------

// I tre titoli pronti di Studio Production. `accento` e `icona` li usa la pagina per lo stile (restano a `titolo.preset`).
export const PRESET_TITOLI = {
  cooking: { sopra: "Backrooms Studio · Live", testo: "Cooking Beats", sotto: "Un beat da zero, in diretta", accento: "oro", icona: "cappello" },
  sessione: { sopra: "Backrooms Studio · Live", testo: "Sessione Beat", sotto: "In studio con il producer", accento: "magenta", icona: "cuffie" },
  mix: { sopra: "Backrooms Studio · Live", testo: "Mix & Master", sotto: "Mix e master in diretta", accento: "ciano", icona: "manopole" },
};

const LIMITI_PRODUZIONE = { sopra: 32, testo: 28, sotto: 48 };
const LIMITI_REACTION = { sopra: 40, testo: 60, sotto: 60 };
const CAMPI_TITOLO = ["sopra", "testo", "sotto"];

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

// Il titolo con le modifiche date (anche una sola riga): ogni campo con il suo limite, il titolo vero non può mancare.
function titoloCon(attuale, modifiche, limiti) {
  if (!oggetto(modifiche)) throw new Error("Titolo: servono i testi (sopra, testo, sotto)");
  const nuovo = { ...attuale };
  if (modifiche.sopra !== undefined) nuovo.sopra = testo(modifiche.sopra, limiti.sopra, "Riga sopra il titolo");
  if (modifiche.testo !== undefined) nuovo.testo = testo(modifiche.testo, limiti.testo, "Titolo", { obbligatorio: true });
  if (modifiche.sotto !== undefined) nuovo.sotto = testo(modifiche.sotto, limiti.sotto, "Riga sotto il titolo");
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
  if (titolo !== undefined) nuova.titolo = titoloCon(nuova.titolo, titolo, LIMITI_PRODUZIONE);
  if (velocita !== undefined) nuova.velocita = velocitaFascia(velocita);
  stato.produzione = nuova;
}

// Come la produzione, con i limiti della reaction e senza preset: il titolo si scrive a mano.
export function impostaReaction(stato, dati) {
  const { titolo, velocita } = corpo(dati, "Reaction");
  const nuova = { ...stato.reaction, titolo: { ...stato.reaction.titolo } };
  if (titolo !== undefined) nuova.titolo = titoloCon(nuova.titolo, titolo, LIMITI_REACTION);
  if (velocita !== undefined) nuova.velocita = velocitaFascia(velocita);
  stato.reaction = nuova;
}

// Stato salvato da una versione senza questo layout, o con valori rotti: partenza completa, i valori buoni restano
// campo per campo (un campo rotto non scarta gli altri). Dallo stato salvato il preset è solo lo stile: i testi non si
// riempiono da soli. Mai eccezioni.
function fondiTitolato(formato, iniziale, imposta, salvato) {
  const stato = { [formato]: iniziale };
  if (!oggetto(salvato)) return stato[formato];
  const titolo = oggetto(salvato.titolo) ? salvato.titolo : {};
  if (formato === "produzione" && presetNoto(titolo.preset)) stato.produzione.titolo.preset = titolo.preset;
  const pezzi = CAMPI_TITOLO.filter((campo) => titolo[campo] !== undefined).map((campo) => ({ titolo: { [campo]: titolo[campo] } }));
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

export const fondiProduzione = (salvato) => fondiTitolato("produzione", produzioneIniziale(), impostaProduzione, salvato);
export const fondiReaction = (salvato) => fondiTitolato("reaction", reactionIniziale(), impostaReaction, salvato);
