// Regia: Serata → Voti della gara. Nome e peso di ognuna delle quattro voci (con la percentuale che ne risulta) e voti ammessi
// per giudici e chat; «Salva voti» manda tutto al comando `votazione`, e un errore compare nell'avviso della regia.
// I campi in uso non si riscrivono (`riempi`). Le funzioni arrivano da regia.js: `$`, `invia`, `avviso`, `riempi` e `salvato`.
import { percentualiPesi } from "./votazione-logica.js";

const VOCI = ["beat", "voce", "mix", "chat"];

export function avviaRegiaVoti({ $, invia, avviso, riempi, salvato }) {
  const modulo = $("#f-votazione");
  const campo = (nome) => modulo.elements[nome];

  // Le percentuali seguono quello che c'è nei campi, anche prima di salvare.
  function mostraPercentuali() {
    const percentuali = percentualiPesi(Object.fromEntries(VOCI.map((voce) => [voce, campo(`peso-${voce}`).value])));
    for (const voce of VOCI) $(`[data-percento="${voce}"]`).textContent = `${percentuali[voce]}%`;
  }
  modulo.addEventListener("input", mostraPercentuali);

  modulo.addEventListener("submit", async (e) => {
    e.preventDefault();
    const esito = await invia("votazione", {
      pesi: Object.fromEntries(VOCI.map((voce) => [voce, campo(`peso-${voce}`).value])),
      min: campo("min").value,
      max: campo("max").value,
      etichette: Object.fromEntries(VOCI.map((voce) => [voce, campo(`etichetta-${voce}`).value])),
    });
    if (esito.ok) {
      salvato(modulo);
      avviso("Voti della gara aggiornati", "ok");
    }
  });

  return {
    disegna(s) {
      const v = s.votazione;
      for (const voce of VOCI) {
        riempi(campo(`peso-${voce}`), v.pesi[voce]);
        riempi(campo(`etichetta-${voce}`), v.etichette[voce]);
      }
      riempi(campo("min"), v.min);
      riempi(campo("max"), v.max);
      mostraPercentuali();
      // Dove la regia nomina una voce (casella del voto, nomi dei giudici) usa il nome scelto.
      for (const nodo of document.querySelectorAll("[data-nome-voce]")) nodo.textContent = v.etichette[nodo.dataset.nomeVoce];
    },
  };
}
