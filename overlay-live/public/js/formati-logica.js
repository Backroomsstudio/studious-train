// Parti pure delle pagine dei quattro layout nuovi (drum, produzione, podcast, reaction): voci della fascia social,
// velocità e dimensione dei testi. Niente DOM: le usano le pagine, la regia e i test.
import { vociSocial } from "./barra.js";

// Etichette dei gruppi di testo di ogni layout (dimensione regolabile dalla regia): le stesse di lib/testi.mjs, che il
// browser non può importare (un test le tiene uguali).
export const ETICHETTE_TESTI = {
  drum: { contatore: "Contatore Like", traguardi: "Colonna traguardi", brano: "Brano in esecuzione", priorita: "Dona un…", sblocco: "Banner di sblocco" },
  produzione: { sopra: "Riga sopra", titolo: "Titolo", sotto: "Riga sotto" },
  reaction: { sopra: "Riga sopra", titolo: "Titolo", sotto: "Riga sotto" },
  podcast: { targa: "Targa", tematiche: "Pannello Tematiche" },
};

// I nomi con cui la regia mostra le icone: quelle dei social (le stesse di ICONE in lib/validazione.mjs) e quelle dei regali di
// «Dona un…» (ICONE_REGALO in lib/drum.mjs). Il browser non può importare la lib: un test li tiene uguali.
export const NOMI_ICONE = {
  nero: "Nero.fan (nota)",
  instagram: "Instagram",
  tiktok: "TikTok",
  "instagram+tiktok": "Instagram+TikTok",
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
  spotify: "Spotify",
  whatsapp: "WhatsApp",
  dm: "DM (aeroplanino)",
  sito: "Sito (globo)",
  microfono: "Studio (microfono)",
  logo: "Logo BR",
};
export const NOMI_ICONE_REGALO = { rosa: "Rosa", corona: "Corona", cuore: "Cuore", regalo: "Regalo", stella: "Stella", diamante: "Diamante", logo: "Logo BR" };

// Accento e icona della targa del titolo per ogni preset di Studio Production (come PRESET_TITOLI in lib/formati.mjs: un test li
// tiene uguali). La reaction non ha preset: la sua targa è sempre magenta e senza icona.
export const STILE_PRESET = {
  cooking: { accento: "oro", icona: "cappello" },
  sessione: { accento: "magenta", icona: "cuffie" },
  mix: { accento: "ciano", icona: "manopole" },
};
export function stileTitolo(formato, titolo) {
  if (formato !== "produzione") return { accento: "magenta", icona: null };
  return Object.hasOwn(STILE_PRESET, titolo?.preset) ? STILE_PRESET[titolo.preset] : STILE_PRESET.cooking;
}

// Il titolo con cui parte la Reaction Release (come reactionIniziale in lib/formati.mjs: un test li tiene uguali): «Ripristina»
// della regia lo rimanda.
export const TITOLO_REACTION_PREDEFINITO = { sopra: "Ogni giovedì · ore 01:00", testo: "REACTION RELEASE DELLA SETTIMANA", sotto: "" };

// Dimensione di un gruppo di testi scelta in regia, come moltiplicatore (100% → 1).
export const scalaTesto = (testi, id) => (testi?.[id] ?? 100) / 100;

// Lo stato di ogni voce del pannello Tematiche del podcast: le precedenti all'attiva sono fatte, l'attiva è una, le altre prossime.
export const statiTematiche = (quante = 0, attiva) =>
  Array.from({ length: quante }, (_, i) => (i < attiva ? "fatta" : i === attiva ? "attiva" : "prossima"));

// Velocità della fascia social del layout, in pixel al secondo.
export const velocitaFascia = (s, layout) => s[layout]?.velocita ?? 80;

const voceOspite = (chiave, icona, etichetta, testo) => ({ tipo: "social", chiave, icone: icona.split("+"), etichetta, testo, oro: false });

// Le voci della fascia: i social accesi della regia e, dopo il primo, quelle del layout: l'artista ospite del Drum (se ha
// un contatto) e gli ospiti del Podcast. Produzione e reaction hanno solo i social. Ogni voce ha una «chiave»: se cambia,
// la fascia rifà il pezzo (solo quando non è in vista).
export function vociFascia(s, layout) {
  const [primo, ...resto] = vociSocial(s.senzaPremio);
  let ospiti = [];
  if (layout === "drum") {
    const o = s.drum?.ospite;
    if (o?.handle) ospiti = [voceOspite(`ospite|drum|${o.icona}|${o.etichetta}|${o.handle}`, o.icona, o.etichetta, o.handle)];
  } else if (layout === "podcast") {
    ospiti = (s.podcast?.ospiti ?? []).map((o) => voceOspite(`ospite|${o.nome}|${o.handle}|${o.icona}`, o.icona, "Ospite", o.handle ? `${o.nome} · ${o.handle}` : o.nome));
  }
  return primo ? [primo, ...ospiti, ...resto] : ospiti;
}
