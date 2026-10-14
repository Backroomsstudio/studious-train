// Reaction Release: la scaletta della serata (vetro semitrasparente con le voci numerate, fissa o a comparsa come il Goal) e la
// fascia «Richiesta di @nome: Titolo — Artista» che la regia mette in onda per `durataRichiesta` secondi. Le parti si accendono con
// i widget reScaletta e reRichiesta; la scaletta non mostra nulla finché l'elenco è vuoto.
import { nodo, adattaTesto } from "./pagina.js";
import { vociScaletta, testoRichiesta } from "./formati-logica.js";
import { goalVisibile, daFarComparire } from "./goal-logica.js";

export function creaPannelliReaction({ orizzontale = false, statico = false } = {}) {
  const scaletta = document.querySelector("#rc-scaletta");
  const titolo = document.querySelector("#rc-sc-titolo");
  const elenco = document.querySelector("#rc-sc-voci");
  const richiesta = document.querySelector("#rc-richiesta");
  const testoR = document.querySelector("#rc-richiesta-testo");
  if (!scaletta || !richiesta) return { aggiorna() {} };

  let stato = null;
  let ultimaComparsaAlle = null;
  let mostraOraAlle = null;
  let firmaVoci = "";
  let idRichiesta = null;
  let richiestaDalle = 0;

  const CORPI = orizzontale ? { voce: [26, 16], titolo: [26, 16], richiesta: [32, 18] } : { voce: [30, 16], titolo: [30, 16], richiesta: [36, 18] };

  function disegnaScaletta(s, voci) {
    const sc = s.reaction.scaletta;
    const firma = JSON.stringify([sc.titolo, voci]);
    if (firma !== firmaVoci) {
      firmaVoci = firma;
      titolo.textContent = sc.titolo;
      elenco.replaceChildren(...voci.map((v, i) => nodo("li", "", "")));
      [...elenco.children].forEach((li, i) => li.append(nodo("b", "", String(i + 1)), nodo("span", "", voci[i])));
      scaletta.style.setProperty("--n", String(voci.length));
      scaletta.hidden = voci.length === 0;
      riadatta();
    }
  }

  function riadatta() {
    if (titolo.textContent) adattaTesto(titolo, ...CORPI.titolo);
    for (const span of elenco.querySelectorAll("span")) adattaTesto(span, ...CORPI.voce);
  }

  function visibilita() {
    if (!stato) return;
    const ora = Date.now();
    const voci = vociScaletta(stato.reaction);
    const acceso = stato.visibili.reScaletta !== false && voci.length > 0;
    if (acceso && daFarComparire(stato.reaction.scaletta, ora, ultimaComparsaAlle)) ultimaComparsaAlle = ora;
    scaletta.classList.toggle("fuori", !goalVisibile(stato.reaction.scaletta, acceso, ora, ultimaComparsaAlle, mostraOraAlle));
    // la richiesta in onda (una sola) resta in vista `durataRichiesta` secondi dal momento in cui va in onda
    const inOnda = stato.reaction.richieste.coda.find((r) => r.stato === "inOnda" && r.brano);
    const visibile = Boolean(inOnda) && stato.visibili.reRichiesta !== false && (statico || ora - richiestaDalle < stato.reaction.durataRichiesta * 1000);
    richiesta.classList.toggle("fuori", !visibile);
  }
  setInterval(visibilita, 500);

  return {
    aggiorna(s, eventi = []) {
      stato = s;
      if (eventi.some((e) => e.nome === "scalettaMostra")) mostraOraAlle = Date.now();
      disegnaScaletta(s, vociScaletta(s.reaction));
      const inOnda = s.reaction.richieste.coda.find((r) => r.stato === "inOnda" && r.brano);
      if ((inOnda?.id ?? null) !== idRichiesta) {
        idRichiesta = inOnda?.id ?? null;
        richiestaDalle = Date.now();
      }
      richiesta.hidden = !inOnda;
      if (inOnda) {
        const t = testoRichiesta(inOnda);
        if (testoR.textContent !== t) {
          testoR.textContent = t;
          adattaTesto(testoR, ...CORPI.richiesta);
        }
      }
      visibilita();
    },
    rimisura: riadatta,
  };
}
