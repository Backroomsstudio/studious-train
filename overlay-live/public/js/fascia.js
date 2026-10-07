// La fascia social dei quattro layout nuovi: la barra che scorre del layout senza premio (stessi pezzi e stile),
// larga 1080 (verticale) o 1920 (orizzontale). Le voci le decide formati-logica.js.
import { creaNastro } from "./nastro.js";
import { nodo, simbolo, logo } from "./pagina.js";

function icona(nome) {
  const cerchio = nodo("span", `sp-icona ${nome}`);
  if (nome === "logo") cerchio.append(logo());
  else cerchio.append(simbolo(`ic-${nome}`));
  return cerchio;
}

// Un pezzo del nastro: la voce (icone, etichetta, testo) e il suo separatore.
function creaPezzo(voce) {
  const pezzo = nodo("div", "sp-pezzo");
  const v = nodo("div", `sp-voce ${voce.tipo}`);
  v.dataset.colore = voce.icone[0];
  const icone = nodo("span", "sp-icone");
  for (const nome of voce.icone) icone.append(icona(nome));
  v.append(icone);
  if (voce.etichetta) v.append(nodo("span", "sp-etichetta", voce.etichetta));
  v.append(nodo("span", `sp-testo${voce.oro ? " oro" : ""}`, voce.testo));
  pezzo.append(v, simbolo("punta", "sp-sep"));
  return pezzo;
}

// Oltre `bordoVisibile` un pezzo non si vede ancora (si può rifare); il nastro si riempie fino a `riempiFino`.
const MISURE = { 1080: { bordoVisibile: 980, riempiFino: 1500 }, 1920: { bordoVisibile: 1800, riempiFino: 2400 } };

// voci(s) → le voci in ordine di passaggio; velocita(s) → pixel al secondo. aggiorna(s) a ogni stato, rimisura() a font caricati.
export function creaFascia({ radice, nastro, larghezza, voci, velocita, statico = false }) {
  const misure = MISURE[larghezza] ?? { bordoVisibile: larghezza - 100, riempiFino: larghezza + 420 };
  let stato = null;
  const scorrevole = creaNastro({ nastro, creaPezzo, inizio: () => 236, velocita: () => (stato ? velocita(stato) : 0), statico, ...misure });
  return {
    radice,
    aggiorna(s) {
      stato = s;
      scorrevole.aggiorna(voci(s));
    },
    rimisura: () => scorrevole.rimisura(),
  };
}
