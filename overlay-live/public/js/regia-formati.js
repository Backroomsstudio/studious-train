// Regia: parti dei quattro layout nuovi (drum, produzione, podcast, reaction). Qui stanno quelle comuni: la sezione
// accesa per il layout in onda, la scheda «Social del brand» (accesa per i layout con la barra), la velocità della fascia,
// la dimensione di ogni gruppo di testi e l'anteprima verticale/orizzontale. Ogni cursore manda il suo comando con un
// piccolo ritardo (120 ms: durante il trascinamento parte solo l'ultimo valore) e appena lo si lascia.
// Le funzioni arrivano da regia.js (che le usa per tutte le sezioni): `$`, `el`, `invia`, `avviso`, `riempi`, `mostra`
// e `conn` (la connessione, per l'audio di FL Studio).
import { ETICHETTE_TESTI, vociFascia, velocitaFascia } from "./formati-logica.js";
import { stimaGiroSecondi } from "./barra.js";

const SEZIONI = { drum: "#dr-regia", produzione: "#pr-regia", podcast: "#po-regia", reaction: "#re-regia" };
// «Social del brand» è la lista che alimenta tutte le barre che scorrono.
const LAYOUT_CON_SOCIAL = ["senzaPremio", "studio", "drum", "produzione", "podcast", "reaction"];
const INVIO_MS = 120;

export function avviaRegiaFormati({ $, el, invia, avviso, riempi, mostra, conn }) {
  let stato = null;
  const invii = {};

  // Un cursore: mentre lo si trascina (input) il valore parte dopo 120 ms dall'ultimo movimento, quando lo si lascia (change) subito.
  function collegaCursore(cursore, chiave, scrivi, manda) {
    cursore.addEventListener("input", () => {
      scrivi();
      clearTimeout(invii[chiave]);
      invii[chiave] = setTimeout(manda, INVIO_MS);
    });
    cursore.addEventListener("change", () => {
      clearTimeout(invii[chiave]);
      cursore.blur();
      scrivi();
      manda();
    });
  }

  // ----- Velocità della fascia -----
  function scriviVelocita(formato, valore) {
    const box = $(`.fm-velocita[data-formato="${formato}"]`);
    const giro = stato ? stimaGiroSecondi(vociFascia(stato, formato), valore) : 0;
    box.querySelector(".fm-velocita-testo").textContent = `${valore} px/s · un giro ≈ ${giro} s`;
    box.querySelector(".fm-velocita-nota").textContent =
      valore > 120 ? "Sopra 120 il testo in movimento si legge peggio nella diretta." : giro > 75 ? "Giro lungo: spegnete una voce o alzate la velocità." : "";
  }

  for (const box of document.querySelectorAll(".fm-velocita")) {
    const formato = box.dataset.formato;
    const cursore = el("input", { type: "range", min: "40", max: "160", step: "10", "data-velocita": formato, "aria-label": "Velocità della fascia" });
    box.append(el("label", { class: "sp-riga" }, "Velocità ", cursore, " ", el("span", { class: "fm-velocita-testo" })), el("p", { class: "nota fm-velocita-nota" }));
    collegaCursore(cursore, `velocita|${formato}`, () => scriviVelocita(formato, Number(cursore.value)), () => invia("formatoVelocita", { formato, velocita: Number(cursore.value) }));
  }

  // ----- Dimensione dei testi: un cursore per gruppo -----
  for (const box of document.querySelectorAll(".fm-testi")) {
    const formato = box.dataset.formato;
    for (const [id, etichetta] of Object.entries(ETICHETTE_TESTI[formato])) {
      const cursore = el("input", { type: "range", min: "60", max: "200", step: "5", "data-testo": id, "aria-label": etichetta });
      const valore = el("span", { class: "bt-testi-valore" });
      box.append(el("label", { class: "sp-riga" }, el("span", { class: "bt-testi-nome" }, etichetta), " ", cursore, " ", valore));
      collegaCursore(cursore, `testi|${formato}|${id}`, () => (valore.textContent = `${cursore.value}%`), () => invia("formatoTesti", { formato, valori: { [id]: Number(cursore.value) } }));
    }
  }
  for (const bottone of document.querySelectorAll("[data-testi-azzera]")) {
    bottone.addEventListener("click", () => invia("formatoTesti", { formato: bottone.dataset.testiAzzera, azzera: true }));
  }

  // ----- Anteprima: verticale o orizzontale (podcast e reaction) -----
  for (const bottone of document.querySelectorAll("[data-anteprima-formato]")) {
    bottone.addEventListener("click", () => {
      const sezione = bottone.closest(".fm-regia");
      const orizzontale = bottone.dataset.anteprimaFormato === "orizzontale";
      const link = sezione.querySelector("[data-anteprima-link]");
      const pagina = link.dataset.anteprimaLink;
      const iframe = sezione.querySelector(".sp-anteprima iframe");
      iframe.setAttribute("src", `/${pagina}.html?anteprima=1&muto=1${orizzontale ? "&formato=orizzontale" : ""}`);
      iframe.setAttribute("width", orizzontale ? "1920" : "1080");
      iframe.setAttribute("height", orizzontale ? "1080" : "1920");
      sezione.querySelector(".sp-anteprima").classList.toggle("orizzontale", orizzontale);
      link.setAttribute("href", `/${pagina}.html?anteprima=1&muto=1${orizzontale ? "&formato=orizzontale" : "&guide=1"}`);
      for (const altro of sezione.querySelectorAll("[data-anteprima-formato]")) altro.classList.toggle("attivo", altro === bottone);
    });
  }

  return {
    // Ridisegna dallo stato: sezione accesa, scheda sociale, velocità e testi (senza toccare il cursore in mano all'operatore).
    disegna(s) {
      stato = s;
      $("#social-regia").classList.toggle("attivo", LAYOUT_CON_SOCIAL.includes(s.layout));
      for (const [formato, sezione] of Object.entries(SEZIONI)) {
        const radice = $(sezione);
        radice.classList.toggle("attivo", s.layout === formato);
        const velocita = radice.querySelector("[data-velocita]");
        if (velocita !== document.activeElement) velocita.value = velocitaFascia(s, formato);
        scriviVelocita(formato, Number(velocita.value));
        for (const campo of radice.querySelectorAll("[data-testo]")) {
          if (campo !== document.activeElement) campo.value = s[formato].testi?.[campo.dataset.testo] ?? 100;
          campo.parentElement.querySelector(".bt-testi-valore").textContent = `${campo.value}%`;
        }
      }
    },
    // Scorciatoie da tastiera di un layout: una funzione da chiamare, o null se il tasto non è suo.
    scorciatoia(tasto, layout) {
      return null;
    },
  };
}
