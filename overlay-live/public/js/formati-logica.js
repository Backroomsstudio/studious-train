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

// Dimensione di un gruppo di testi scelta in regia, come moltiplicatore (100% → 1).
export const scalaTesto = (testi, id) => (testi?.[id] ?? 100) / 100;

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
