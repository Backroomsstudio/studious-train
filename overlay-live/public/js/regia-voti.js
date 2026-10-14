// Regia: Serata → Voti della gara. Nome e peso di ognuna delle quattro voci (con la percentuale che ne risulta) e voti ammessi
// per giudici e chat; «Salva voti» manda tutto al comando `votazione`, e un errore compare nell'avviso della regia.
// In più, in «In onda», i pulsanti del tabellone ad albero (comando `albero`: mostra per tot secondi, o nascondi).
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

  // Tabellone ad albero: «Mostra» usa i secondi scritti (campo vuoto = quelli di prima), «Nascondi» lo spegne subito.
  const durata = $("#albero-durata");
  $("#albero-mostra").addEventListener("click", () => {
    const secondi = durata.value.trim();
    invia("albero", { mostra: true, ...(secondi === "" ? {} : { durataSecondi: Number(secondi) }) });
  });
  $("#albero-nascondi").addEventListener("click", () => invia("albero", { mostra: false }));

  function disegnaAlbero(s) {
    const { disegno, durataSecondi } = s.albero;
    riempi(durata, durataSecondi);
    const partecipanti = disegno ? disegno.turni[0].partite.flatMap((p) => [p.a, p.b]).filter(Boolean).length : 0;
    $("#albero-nota").textContent = !disegno
      ? "Servono almeno 2 tracce confermate in classifica."
      : `${partecipanti} tracce nel tabellone${disegno.esclusi ? ` (altre ${disegno.esclusi} restano fuori)` : ""}${s.visibili.albero ? " · in onda" : ""}.`;
  }

  return {
    disegna(s) {
      disegnaAlbero(s);
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
