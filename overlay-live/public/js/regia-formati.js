// Regia: parti dei quattro layout nuovi (drum, produzione, podcast, reaction). Qui stanno quelle comuni: la sezione
// accesa per il layout in onda, la scheda «Social del brand» (accesa per i layout con la barra), la velocità della fascia,
// la dimensione di ogni gruppo di testi e l'anteprima verticale/orizzontale; per il Drum anche l'ascolto dell'audio di FL Studio
// (sorgente, avvia/ferma, indicatore di livello, sensibilità, stile, respiro e «Prova» dell'equalizzatore). Ogni cursore manda il
// suo comando con un piccolo ritardo (120 ms: durante il trascinamento parte solo l'ultimo valore) e appena lo si lascia.
// Le funzioni arrivano da regia.js (che le usa per tutte le sezioni): `$`, `el`, `invia`, `avviso`, `riempi`, `mostra`
// e `conn` (la connessione, per l'audio di FL Studio).
import { ETICHETTE_TESTI, vociFascia, velocitaFascia } from "./formati-logica.js";
import { stimaGiroSecondi } from "./barra.js";
import { avviaAscolto, elencaIngressi } from "./regia-audio.js";

const SEZIONI = { drum: "#dr-regia", produzione: "#pr-regia", podcast: "#po-regia", reaction: "#re-regia" };
// «Social del brand» è la lista che alimenta tutte le barre che scorrono.
const LAYOUT_CON_SOCIAL = ["senzaPremio", "studio", "drum", "produzione", "podcast", "reaction"];
const INVIO_MS = 120;
const CHIAVE_SORGENTE = "drum-audio-sorgente";
const CHIAVE_INGRESSO = "drum-audio-ingresso";
const PROVA_MS = 4000; // la «Prova» dell'equalizzatore dura 4 s, a 30 Hz

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

  // ----- Equalizzatore del Drum: ascolto dell'audio di FL Studio -----
  const sorgente = $("#dr-audio-sorgente");
  const ingresso = $("#dr-audio-ingresso");
  const bottoneAscolto = $("#dr-audio-avvia");
  const misuratore = $("#dr-audio-livello");
  const statoAscolto = $("#dr-audio-stato");
  const sensibilita = $("#dr-eq-sens");
  const stileEq = $("#dr-eq-stile");
  const respiroEq = $("#dr-eq-idle");
  const provaEq = $("#dr-eq-prova");
  let ascolto = null;
  let giroLivello = 0;
  let giroProva = 0;

  const leggi = (chiave) => {
    try {
      return localStorage.getItem(chiave);
    } catch {
      return null;
    }
  };
  const scrivi = (chiave, valore) => {
    try {
      localStorage.setItem(chiave, valore);
    } catch {
      // senza memoria del browser si riparte dalle impostazioni di base
    }
  };
  const scriviLivello = (valore) => {
    misuratore.setAttribute("aria-valuenow", String(valore));
    misuratore.firstElementChild.style.width = `${valore}%`;
  };

  // L'ingresso scelto si ricorda con identificatore e nome: l'identificatore cambia se si cancellano i dati del browser, il nome no.
  let scelta = {};
  try {
    scelta = JSON.parse(leggi(CHIAVE_INGRESSO) ?? "{}") ?? {};
  } catch {
    // memoria illeggibile: si riparte da «Predefinito»
  }
  const ricordaScelta = () => scrivi(CHIAVE_INGRESSO, JSON.stringify(scelta));

  // Gli ingressi audio del PC: «Predefinito» e quelli con un nome (i nomi arrivano dopo il permesso del microfono).
  async function aggiornaIngressi() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    let elenco = [];
    try {
      elenco = (await elencaIngressi()).filter((d) => d.id && d.id !== "default" && d.id !== "communications");
    } catch {
      // nessun elenco: resta «Predefinito»
    }
    const trovato = elenco.find((d) => d.id === scelta.id) ?? (scelta.nome ? elenco.find((d) => d.nome === scelta.nome) : undefined);
    // Prima del permesso il browser non dà gli identificatori: l'ingresso ricordato resta scelto (se non c'è più, l'avvio lo dirà).
    const segnaposto = scelta.id && !elenco.length ? el("option", { value: scelta.id, "data-segnaposto": "" }, "Ingresso scelto in precedenza") : null;
    ingresso.replaceChildren(el("option", { value: "" }, "Predefinito"), ...elenco.map((d) => el("option", { value: d.id }, d.nome)), ...(segnaposto ? [segnaposto] : []));
    ingresso.value = trovato?.id ?? (segnaposto ? scelta.id : "");
    if (trovato && trovato.id !== scelta.id) {
      scelta = { id: trovato.id, nome: trovato.nome };
      ricordaScelta();
    }
  }

  function scriviStatoAscolto() {
    bottoneAscolto.textContent = ascolto ? "Ferma ascolto" : "Avvia ascolto";
    bottoneAscolto.classList.toggle("attivo", Boolean(ascolto));
    $("#dr-audio-ingresso-riga").hidden = sorgente.value !== "ingresso";
    statoAscolto.textContent = ascolto ? `In ascolto: ${sorgente.value === "sistema" ? "Audio del PC" : ingresso.selectedOptions[0]?.textContent ?? "ingresso audio"}.` : "";
  }

  function fermaAscolto() {
    ascolto?.ferma();
    ascolto = null;
    clearInterval(giroLivello);
    scriviLivello(0);
    scriviStatoAscolto();
  }

  const MESSAGGI_ERRORE = {
    NotAllowedError: "Il browser non ha dato il permesso di ascoltare l'audio: consentitelo dalle impostazioni del sito (o, per «Audio del PC», scegliete cosa condividere).",
    NotFoundError: "Nessun ingresso audio trovato.",
    NotReadableError: "L'ingresso audio è occupato da un altro programma.",
    OverconstrainedError: "L'ingresso audio scelto non c'è più: scegliete «Predefinito» o un altro.",
  };

  async function avviaOFerma() {
    if (ascolto) return fermaAscolto();
    if (!navigator.mediaDevices) {
      avviso("Questo browser non permette l'ascolto qui: aprite la regia da http://localhost con Chrome o Edge.", "errore");
      return;
    }
    bottoneAscolto.disabled = true;
    try {
      ascolto = await avviaAscolto({
        sorgente: sorgente.value,
        deviceId: ingresso.value || undefined,
        sensibilita: () => stato?.drum.eq.sensibilita ?? 100,
        // i livelli vanno alle pagine solo con il Drum in onda: con un altro layout il server li scarterebbe
        suFrame: (b, c) => {
          if (stato?.layout === "drum") conn.audio(b, c);
        },
        suFine: () => {
          fermaAscolto();
          avviso("L'ascolto si è interrotto: l'ingresso audio è stato staccato o la condivisione chiusa.", "errore");
        },
      });
      giroLivello = setInterval(() => scriviLivello(ascolto?.livello() ?? 0), 80);
      scriviStatoAscolto();
      aggiornaIngressi(); // adesso i nomi dei dispositivi ci sono
    } catch (errore) {
      avviso(MESSAGGI_ERRORE[errore.name] ?? errore.message ?? "Impossibile ascoltare l'audio.", "errore");
    } finally {
      bottoneAscolto.disabled = false;
    }
  }

  // Uno schema finto di 4 s (un colpo ogni mezzo secondo) per vedere l'equalizzatore senza audio.
  function provaEqualizzatore() {
    if (giroProva) return;
    if (stato?.layout !== "drum") {
      avviso("Il Drum non è in onda: scegliete «Drum Challenge Live» in alto per vedere la prova.", "errore");
      return;
    }
    const inizio = performance.now();
    provaEq.disabled = true;
    giroProva = setInterval(() => {
      const t = (performance.now() - inizio) / 1000;
      if (t >= PROVA_MS / 1000) {
        clearInterval(giroProva);
        giroProva = 0;
        provaEq.disabled = false;
        return;
      }
      const fase = t % 0.5;
      const energia = 0.25 + 0.75 * Math.exp(-fase * 7);
      const bande = [92, 84, 70, 54, 46, 40, 34, 26, 20, 14, 9, 5].map((v, i) => Math.round(Math.min(100, v * energia * (0.9 + 0.1 * Math.sin(t * 9 + i)))));
      conn.audio(bande, fase < 0.04 ? 90 : 0);
    }, 33);
  }

  bottoneAscolto.addEventListener("click", avviaOFerma);
  provaEq.addEventListener("click", provaEqualizzatore);
  sorgente.addEventListener("change", () => {
    scrivi(CHIAVE_SORGENTE, sorgente.value);
    scriviStatoAscolto();
  });
  ingresso.addEventListener("change", () => {
    const opzione = ingresso.selectedOptions[0];
    scelta = ingresso.value ? { id: ingresso.value, nome: opzione.dataset.segnaposto === undefined ? opzione.textContent : scelta.nome } : {};
    ricordaScelta();
  });
  collegaCursore(sensibilita, "eq-sens", () => ($("#dr-eq-sens-valore").textContent = `${sensibilita.value}%`), () => invia("drumEq", { sensibilita: Number(sensibilita.value) }));
  stileEq.addEventListener("change", () => invia("drumEq", { stile: stileEq.value }));
  respiroEq.addEventListener("change", () => invia("drumEq", { senzaSegnale: respiroEq.checked }));
  addEventListener("pagehide", () => ascolto?.ferma());
  if (leggi(CHIAVE_SORGENTE) === "sistema") sorgente.value = "sistema";
  aggiornaIngressi();
  scriviStatoAscolto();

  return {
    // Ridisegna dallo stato: sezione accesa, scheda sociale, velocità e testi (senza toccare il cursore in mano all'operatore).
    disegna(s) {
      stato = s;
      const eq = s.drum.eq;
      if (sensibilita !== document.activeElement) sensibilita.value = eq.sensibilita;
      $("#dr-eq-sens-valore").textContent = `${sensibilita.value}%`;
      if (stileEq !== document.activeElement) stileEq.value = eq.stile;
      if (respiroEq !== document.activeElement) respiroEq.checked = eq.senzaSegnale;
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
