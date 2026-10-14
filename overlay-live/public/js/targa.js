// Le righe di una targa di titolo (Studio Production, Reaction Release, Back Rooms Podcast). Ogni riga si scrive, si adatta al
// suo riquadro (adattaTesto, mai più alta della sua scatola) e, se il testo cambia mentre è in onda, entra con un breve flip
// (classe .flip rilanciata, parole cambiate a metà): due cambi di fila → vince l'ultimo. Mai flip al primo disegno né con
// ?statico=1. Una riga che si chiama `nascondiSeVuota` sparisce (hidden) quando non ha testo.
import { adattaTesto, rilancia, ts } from "./pagina.js";

export const FLIP_MS = 380;

// righe: { nome: { el, gruppo, massimo, minimo, aria?, nascondiSeVuota? } } — `gruppo` è il gruppo di testo scelto in regia
// (--ts-<gruppo>), `massimo` e `minimo` i corpi tra cui adattarsi, `aria` i pixel che il corpo lascia liberi nella scatola della
// riga (di solito 0). Dà { aggiorna(titolo, testi, primo), rimisura() }.
export function creaTarga({ righe, statico = false }) {
  let voluto = {}; // quello che lo stato vuole, per riga
  let testi = {}; // le dimensioni dei testi scelte in regia
  let firmaTesti = "";
  const scritto = {}; // quello che c'è scritto ora in ogni riga (cambia a metà del flip)
  const timer = {};

  // Una riga cresce con la dimensione scelta in regia (60–200%) ma mai più alta della sua scatola (meno l'`aria`): la riga ha
  // un'altezza fissa e un testo più grande sporgerebbe sopra e sotto.
  function adatta(nome) {
    const { el, gruppo, massimo, minimo, aria = 0 } = righe[nome];
    if (!el.hidden) adattaTesto(el, Math.min(massimo * ts(testi, gruppo), el.clientHeight - aria), minimo);
  }

  // Scrive una riga (sempre il valore voluto di adesso) e la adatta.
  function scrivi(nome) {
    const { el, nascondiSeVuota } = righe[nome];
    scritto[nome] = voluto[nome];
    el.textContent = voluto[nome];
    if (nascondiSeVuota) el.hidden = !voluto[nome];
    adatta(nome);
  }

  return {
    // titolo: { nome: testo } per le righe della targa; testi: le dimensioni dei testi; primo: è il primo disegno.
    aggiorna(titolo, testiRegia, primo = false) {
      voluto = Object.fromEntries(Object.keys(righe).map((nome) => [nome, titolo[nome] ?? ""]));
      testi = testiRegia ?? {};
      const dimensioniCambiate = JSON.stringify(testi) !== firmaTesti;
      firmaTesti = JSON.stringify(testi);
      for (const nome of Object.keys(righe)) {
        if (scritto[nome] === undefined || primo || statico) scrivi(nome);
        else if (scritto[nome] !== voluto[nome]) {
          // le parole cambiano a metà del flip; un altro cambio mentre gira rimette in moto il timer e vince l'ultimo
          rilancia(righe[nome].el, "flip");
          clearTimeout(timer[nome]);
          timer[nome] = setTimeout(() => scrivi(nome), FLIP_MS / 2);
        } else if (dimensioniCambiate) adatta(nome); // stesso testo: cambia solo la dimensione scelta in regia
      }
    },
    // Con i font caricati le larghezze cambiano: si riadattano le righe.
    rimisura() {
      for (const nome of Object.keys(righe)) adatta(nome);
    },
  };
}
