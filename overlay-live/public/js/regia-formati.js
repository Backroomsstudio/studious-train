// Regia: parti dei quattro layout nuovi (drum, produzione, podcast, reaction). Qui stanno quelle comuni: la sezione
// accesa per il layout in onda, la scheda «Social del brand» (accesa per i layout con la barra), la velocità della fascia,
// la dimensione di ogni gruppo di testi e l'anteprima verticale/orizzontale; per Studio Production e Reaction Release il titolo
// (preset e tre righe che vanno in onda mentre si scrive); per il Drum anche i controlli (Like, scaletta, brano,
// «Dona un…», artista ospite, riempimento) e l'ascolto dell'audio di FL Studio (sorgente, avvia/ferma, indicatore di livello,
// sensibilità, stile, respiro e «Prova» dell'equalizzatore). Ogni cursore manda il suo comando con un piccolo ritardo (120 ms:
// durante il trascinamento parte solo l'ultimo valore) e appena lo si lascia.
// Le funzioni arrivano da regia.js (che le usa per tutte le sezioni): `$`, `el`, `invia`, `avviso`, `riempi`, `mostra`
// e `conn` (la connessione, per l'audio di FL Studio).
import { ETICHETTE_TESTI, NOMI_ICONE, NOMI_ICONE_REGALO, TITOLO_REACTION_PREDEFINITO, vociFascia, velocitaFascia } from "./formati-logica.js";
import { formattaLike, etichettaLike, testoScaletta, titoloBrano } from "./drum-logica.js";
import { stimaGiroSecondi } from "./barra.js";
import { avviaAscolto, elencaIngressi } from "./regia-audio.js";

const SEZIONI = { drum: "#dr-regia", produzione: "#pr-regia", podcast: "#po-regia", reaction: "#re-regia" };
// «Social del brand» è la lista che alimenta tutte le barre che scorrono.
const LAYOUT_CON_SOCIAL = ["senzaPremio", "studio", "drum", "produzione", "podcast", "reaction"];
const INVIO_MS = 120;
const TITOLO_MS = 150; // il titolo va in onda 150 ms dopo l'ultimo tasto
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

  // ----- Titolo di Studio Production e Reaction Release: si scrive e va in onda -----
  const PREFISSO_TITOLO = { produzione: "pr", reaction: "re" };
  const campiTitolo = (formato) => Object.fromEntries(["sopra", "testo", "sotto"].map((riga) => [riga, $(`#${PREFISSO_TITOLO[formato]}-${riga}`)]));

  // Una riga del titolo, 150 ms dopo l'ultimo tasto. Il titolo vuoto non si manda (mentre lo si riscrive resta quello in onda);
  // se il server rifiuta il testo (l'avviso è già a schermo) il campo torna al valore in onda.
  async function mandaRigaTitolo(formato, riga, campo) {
    if (riga === "testo" && !campo.value.trim()) return;
    const esito = await invia(formato, { titolo: { [riga]: campo.value } });
    if (!esito.ok && stato) campo.value = stato[formato].titolo[riga] ?? "";
  }
  for (const formato of Object.keys(PREFISSO_TITOLO)) {
    for (const [riga, campo] of Object.entries(campiTitolo(formato))) {
      campo.addEventListener("input", () => {
        clearTimeout(invii[`titolo|${formato}|${riga}`]);
        invii[`titolo|${formato}|${riga}`] = setTimeout(() => mandaRigaTitolo(formato, riga, campo), TITOLO_MS);
      });
    }
  }
  for (const chip of document.querySelectorAll("button[data-preset]")) chip.addEventListener("click", () => invia("produzione", { preset: chip.dataset.preset }));
  $("#re-ripristina").addEventListener("click", () => invia("reaction", { titolo: TITOLO_REACTION_PREDEFINITO }));

  // I campi del titolo seguono lo stato, tranne quello in uso; il preset in onda è evidenziato.
  function disegnaTitoli(s) {
    for (const formato of Object.keys(PREFISSO_TITOLO)) {
      for (const [riga, campo] of Object.entries(campiTitolo(formato))) riempi(campo, s[formato].titolo[riga]);
    }
    for (const chip of document.querySelectorAll("button[data-preset]")) chip.classList.toggle("attivo", chip.dataset.preset === s.produzione.titolo.preset);
  }

  // ----- Drum: Like, scaletta, brano, «Dona un…», artista ospite, riempimento -----
  // I campi si riempiono dallo stato solo se non sono in uso (riempi); un comando rifiutato riporta il campo al valore vero.
  const campoDrum = (id) => $(`#${id}`);
  const scaletta = campoDrum("dr-scaletta");
  const elencoScaletta = campoDrum("dr-scaletta-elenco");
  let firmaElenco = "";
  const icone = (select, nomi) => select.replaceChildren(...Object.entries(nomi).map(([valore, nome]) => el("option", { value: valore }, nome)));
  icone(campoDrum("dr-ospite-icona"), NOMI_ICONE);
  icone(campoDrum("dr-pri-icona-in"), NOMI_ICONE_REGALO);

  // Un comando del Drum; se il server lo rifiuta (l'errore è già a schermo) i campi tornano a quello che c'è davvero.
  async function comandoDrum(nome, args) {
    const esito = await invia(nome, args);
    if (!esito.ok && stato) disegnaDrum(stato);
    return esito;
  }

  campoDrum("dr-like-100").addEventListener("click", () => comandoDrum("drumLike", { aggiungi: 100 }));
  campoDrum("dr-like-1000").addEventListener("click", () => comandoDrum("drumLike", { aggiungi: 1000 }));
  async function impostaLike() {
    const campo = campoDrum("dr-like-imposta");
    const numero = Number(campo.value);
    if (campo.value.trim() === "" || !Number.isFinite(numero) || numero < 0) return avviso("Scrivete quanti Like mostrare: un numero da 0 in su.", "errore");
    if ((await comandoDrum("drumLike", { imposta: Math.round(numero) })).ok) campo.value = "";
  }
  campoDrum("dr-like-imposta-ok").addEventListener("click", impostaLike);
  campoDrum("dr-like-imposta").addEventListener("keydown", (e) => {
    if (e.key === "Enter") impostaLike();
  });
  campoDrum("dr-like-ora").addEventListener("click", () => {
    if (confirm("Ripartire da ora? Il contatore dei Like torna a zero e la scaletta riparte dalla prima tappa.")) comandoDrum("drumLike", { daOra: true });
  });

  scaletta.addEventListener("input", () => (scaletta.dataset.modificato = "1"));
  campoDrum("dr-scaletta-salva").addEventListener("click", async () => {
    const esito = await comandoDrum("drumScaletta", { testo: scaletta.value });
    if (esito.ok) delete scaletta.dataset.modificato; // da qui il campo torna a seguire lo stato (scritto in modo uniforme)
    if (esito.ok && stato) disegnaDrum(stato);
  });
  campoDrum("dr-scaletta-predefinita").addEventListener("click", async () => {
    if (!confirm("Rimettere la scaletta predefinita di 37 tappe? I titoli delle tappe con gli stessi Like restano.")) return;
    const esito = await comandoDrum("drumScaletta", { predefinita: true });
    if (esito.ok) delete scaletta.dataset.modificato;
    if (esito.ok && stato) disegnaDrum(stato);
  });

  // Titolo e artista del brano vanno insieme con «Mostra»: finché non si preme (o il brano non cambia, da qui o da fuori) i due
  // campi restano come scritti, anche se nel frattempo lo stato cambia (i Like arrivano a raffica).
  const campiBrano = ["dr-brano-titolo-in", "dr-brano-artista-in"].map(campoDrum);
  const finitoBrano = () => campiBrano.forEach((c) => delete c.dataset.modificato);
  const mostraBrano = () => comandoDrum("drumBrano", { titolo: campiBrano[0].value, artista: campiBrano[1].value });
  campoDrum("dr-brano-ok").addEventListener("click", mostraBrano);
  for (const campo of campiBrano) {
    campo.addEventListener("input", () => (campo.dataset.modificato = "1"));
    campo.addEventListener("keydown", (e) => {
      if (e.key === "Enter") mostraBrano();
    });
  }
  campoDrum("dr-brano-svuota").addEventListener("click", async () => {
    if ((await comandoDrum("drumBrano", { svuota: true })).ok) {
      finitoBrano();
      if (stato) disegnaDrum(stato);
    }
  });

  // Un campo che manda il suo valore appena si esce (o si preme Invio).
  const alCambio = (id, comando, chiave) => campoDrum(id).addEventListener("change", (e) => comandoDrum(comando, { [chiave]: e.target.value }));
  alCambio("dr-ospite-etichetta", "drumOspite", "etichetta");
  alCambio("dr-ospite-handle", "drumOspite", "handle");
  alCambio("dr-ospite-icona", "drumOspite", "icona");
  alCambio("dr-pri-prefisso-in", "drumPriorita", "prefisso");
  alCambio("dr-pri-slot-in", "drumPriorita", "slot");
  alCambio("dr-pri-sopra-in", "drumPriorita", "sopra");
  alCambio("dr-pri-icona-in", "drumPriorita", "icona");
  alCambio("dr-riempimento", "drumRiempimento", "stile");
  const richiamo = () => comandoDrum("drumPriorita", { richiamo: true });
  campoDrum("dr-pri-richiamo").addEventListener("click", richiamo);

  // L'elenco delle tappe: ✓ sbloccata, ▶ attiva, e per le sbloccate con un titolo «Suona ora» (lo mette come brano in esecuzione).
  function disegnaElenco(d) {
    const firma = JSON.stringify([d.scaletta, d.attiva]);
    if (firma === firmaElenco) return;
    firmaElenco = firma;
    const raggiunte = d.attiva ?? d.scaletta.length;
    elencoScaletta.replaceChildren(
      ...d.scaletta.map((tappa, i) => {
        const sbloccata = i < raggiunte;
        const stato = sbloccata ? "sbloccata" : i === d.attiva ? "attiva" : "chiusa";
        const suona = el("button", { type: "button", class: "piccolo", ...(tappa.titolo ? {} : { disabled: "", title: "Scrivete il titolo nella scaletta" }) }, "Suona ora");
        suona.addEventListener("click", () => comandoDrum("drumBrano", { daIndice: i }));
        return el(
          "li",
          { class: stato },
          el("span", { class: "dr-t-like" }, etichettaLike(tappa.like)),
          el("span", { class: `dr-t-titolo${tappa.titolo ? "" : " vuoto"}` }, titoloBrano(tappa.titolo)),
          el("span", { class: "dr-t-stato", title: { sbloccata: "Sbloccata", attiva: "Prossima: i Like la stanno riempiendo", chiusa: "Ancora chiusa" }[stato] }, { sbloccata: "✓", attiva: "▶", chiusa: "" }[stato]),
          sbloccata ? suona : el("span"),
        );
      }),
    );
  }

  let branoVisto = null; // com'era il brano nell'ultimo stato: se cambia da fuori («Suona ora», un'altra regia) la bozza decade
  function disegnaDrum(s) {
    const d = s.drum;
    const firmaBrano = JSON.stringify(d.brano);
    if (branoVisto !== null && firmaBrano !== branoVisto) finitoBrano();
    branoVisto = firmaBrano;
    campoDrum("dr-like-grande").textContent = formattaLike(d.contati);
    campoDrum("dr-like-stato").textContent = { collegato: "Collegato a TikTok", attesa: "In attesa di TikTok" }[s.tiktok.stato] ?? "TikTok non collegato";
    if (!scaletta.dataset.modificato) riempi(scaletta, testoScaletta(d.scaletta));
    disegnaElenco(d);
    riempi(campoDrum("dr-brano-titolo-in"), d.brano.titolo);
    riempi(campoDrum("dr-brano-artista-in"), d.brano.artista);
    riempi(campoDrum("dr-ospite-etichetta"), d.ospite.etichetta);
    riempi(campoDrum("dr-ospite-handle"), d.ospite.handle);
    riempi(campoDrum("dr-ospite-icona"), d.ospite.icona);
    riempi(campoDrum("dr-pri-prefisso-in"), d.priorita.prefisso);
    riempi(campoDrum("dr-pri-slot-in"), d.priorita.slot);
    riempi(campoDrum("dr-pri-sopra-in"), d.priorita.sopra);
    riempi(campoDrum("dr-pri-icona-in"), d.priorita.icona);
    riempi(campoDrum("dr-riempimento"), d.riempimento);
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
      disegnaDrum(s);
      disegnaTitoli(s);
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
      if (layout === "drum" && tasto === "F2") return richiamo;
      return null;
    },
  };
}
