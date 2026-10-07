// Regia del Back Rooms Podcast: i quattro moduli a comando (linea di divisione, pannello Tematiche, targa e fascia social), le
// tematiche (l'elenco da scrivere, la lista da cui scegliere quella in onda, avanti e indietro, il lato del pannello), gli ospiti
// della fascia e le scorciatoie F2 (avanti), F3 (indietro) e F4 (mostra o nascondi il pannello). Il titolo della targa e la riga
// dell'episodio si scrivono come quelli di Studio Production e Reaction Release (regia-formati.js).
// Le funzioni arrivano da regia.js (che le usa per tutte le sezioni): `$`, `el`, `invia` (manda un comando e dà { ok }: l'errore è
// già a schermo) e `riempi` (scrive un campo solo se l'operatore non ci sta lavorando).
import { NOMI_ICONE, statiTematiche } from "./formati-logica.js";

const MAX_OSPITI = 4; // quanti ne accetta il server (e la fascia)
const SEGNO = { fatta: "✓", attiva: "▶", prossima: "" };

export function avviaRegiaPodcast({ $, el, invia, riempi }) {
  let stato = null;

  // ----- Moduli a comando: un clic accende, il secondo spegne -----
  const moduli = [...document.querySelectorAll("button[data-modulo]")];
  for (const bottone of moduli) {
    bottone.addEventListener("click", () => {
      if (stato) invia("widget", { nome: bottone.dataset.modulo, visibile: !stato.visibili[bottone.dataset.modulo] });
    });
  }
  function disegnaModuli(s) {
    for (const bottone of moduli) {
      const acceso = Boolean(s.visibili[bottone.dataset.modulo]);
      bottone.setAttribute("aria-pressed", String(acceso));
      bottone.classList.toggle("attivo", acceso);
      bottone.querySelector(".po-modulo-stato").textContent = acceso ? "In onda" : "Fuori onda";
    }
  }

  // ----- Tematiche in onda: la lista da cui scegliere, avanti e indietro, il lato del pannello -----
  const lista = $("#po-tem-lista");
  const lato = $("#po-tem-lato");
  let firmaLista = "";
  lista.addEventListener("click", (e) => {
    const voce = e.target.closest("button[data-indice]");
    if (voce) invia("podcastTematica", { indice: Number(voce.dataset.indice) });
  });
  $("#po-tem-avanti").addEventListener("click", () => invia("podcastTematica", { avanti: true }));
  $("#po-tem-indietro").addEventListener("click", () => invia("podcastTematica", { indietro: true }));
  lato.addEventListener("change", async () => {
    const esito = await invia("podcast", { tematiche: { lato: lato.value } });
    if (!esito.ok && stato) lato.value = stato.podcast.tematiche.lato;
  });

  // La lista mostra ogni tematica con il suo numero e lo stato: ✓ fatta, ▶ in onda, niente per quelle che seguono.
  function disegnaLista(t) {
    const firma = JSON.stringify([t.elenco, t.attiva]);
    if (firma === firmaLista) return;
    firmaLista = firma;
    const stati = statiTematiche(t.elenco.length, t.attiva);
    lista.replaceChildren(
      ...t.elenco.map((voce, i) =>
        el(
          "li",
          {},
          el(
            "button",
            { type: "button", class: "po-tem-voce", "data-indice": String(i), "data-stato": stati[i], "aria-current": stati[i] === "attiva" ? "true" : "false", title: "Mettila in onda" },
            el("span", { class: "po-tem-num" }, String(i + 1)),
            el("span", { class: "po-tem-testo" }, voce),
            el("span", { class: "po-tem-segno" }, SEGNO[stati[i]]),
          ),
        ),
      ),
    );
    $("#po-tem-vuoto").hidden = t.elenco.length > 0;
  }

  // ----- Elenco delle tematiche: titolo del pannello e una tematica per riga, si salvano insieme -----
  // Finché non si salva, il testo scritto resta com'è anche se lo stato cambia (la tematica attiva si sposta, per esempio).
  const campoTitolo = $("#po-tem-titolo");
  const campoElenco = $("#po-tem-elenco");
  for (const campo of [campoTitolo, campoElenco]) campo.addEventListener("input", () => (campo.dataset.modificato = "1"));
  $("#po-tem-salva").addEventListener("click", async () => {
    const elenco = campoElenco.value
      .split("\n")
      .map((riga) => riga.trim())
      .filter(Boolean);
    const esito = await invia("podcast", { tematiche: { titolo: campoTitolo.value, elenco } });
    if (esito.ok) for (const campo of [campoTitolo, campoElenco]) delete campo.dataset.modificato; // da qui i campi seguono lo stato
  });

  // ----- Ospiti: si salvano uscendo da un campo; una riga senza nome non va in onda -----
  const elencoOspiti = $("#po-ospiti");
  const aggiungi = $("#po-ospiti-aggiungi");
  const firmaOspiti = (ospiti) => JSON.stringify(ospiti.map((o) => [o.nome, o.handle, o.icona]));

  function rigaOspite(ospite = {}) {
    const icona = el("select", { name: "icona", "aria-label": "Icona" }, ...Object.entries(NOMI_ICONE).map(([valore, nome]) => el("option", { value: valore }, nome)));
    icona.value = ospite.icona ?? "instagram";
    const campo = (nome, max, segnaposto, etichetta) => {
      const input = el("input", { name: nome, maxlength: String(max), placeholder: segnaposto, autocomplete: "off", "aria-label": etichetta });
      input.value = ospite[nome] ?? "";
      return input;
    };
    return el("li", {}, icona, campo("nome", 24, "Nome (es. Lince)", "Nome dell'ospite"), campo("handle", 40, "Contatto (es. @lince.music)", "Contatto dell'ospite"), el("button", { type: "button", class: "piccolo", "data-togli": "", title: "Togli l'ospite" }, "✕"));
  }
  const leggiOspiti = () =>
    [...elencoOspiti.children]
      .map((riga) => ({ nome: riga.querySelector('[name="nome"]').value.trim(), handle: riga.querySelector('[name="handle"]').value.trim(), icona: riga.querySelector('[name="icona"]').value }))
      .filter((ospite) => ospite.nome);
  const aggiornaAggiungi = () => (aggiungi.disabled = elencoOspiti.children.length >= MAX_OSPITI);

  // Si ridisegna dallo stato solo quando l'operatore non ci sta scrivendo e l'elenco in onda è cambiato (una riga nuova, ancora
  // senza nome, resta com'è finché non cambia qualcosa da fuori).
  function disegnaOspiti(s, forza = false) {
    if (!forza && elencoOspiti.contains(document.activeElement)) return;
    const firma = firmaOspiti(s.podcast.ospiti);
    if (!forza && elencoOspiti.dataset.firma === firma) return;
    elencoOspiti.dataset.firma = firma;
    elencoOspiti.replaceChildren(...s.podcast.ospiti.map(rigaOspite));
    aggiornaAggiungi();
  }

  async function salvaOspiti() {
    const ospiti = leggiOspiti();
    if (stato && firmaOspiti(ospiti) === firmaOspiti(stato.podcast.ospiti)) return;
    const esito = await invia("podcast", { ospiti });
    if (!esito.ok && stato) disegnaOspiti(stato, true); // il server l'ha rifiutato: tornano gli ospiti in onda
  }
  elencoOspiti.addEventListener("change", salvaOspiti);
  elencoOspiti.addEventListener("click", (e) => {
    const togli = e.target.closest("button[data-togli]");
    if (!togli) return;
    togli.closest("li").remove();
    aggiornaAggiungi();
    salvaOspiti();
  });
  aggiungi.addEventListener("click", () => {
    const riga = rigaOspite();
    elencoOspiti.append(riga);
    aggiornaAggiungi();
    riga.querySelector('[name="nome"]').focus();
  });

  return {
    // Ridisegna dallo stato, senza toccare i campi in uso.
    disegna(s) {
      stato = s;
      const t = s.podcast.tematiche;
      disegnaModuli(s);
      disegnaLista(t);
      riempi(campoTitolo, t.titolo);
      riempi(campoElenco, t.elenco.join("\n"));
      if (lato !== document.activeElement) lato.value = t.lato;
      disegnaOspiti(s);
    },
    // Scorciatoie con il Podcast in onda: una funzione da chiamare, o null se il tasto non è suo.
    scorciatoia(tasto) {
      const comandi = {
        F2: () => invia("podcastTematica", { avanti: true }),
        F3: () => invia("podcastTematica", { indietro: true }),
        F4: () => stato && invia("widget", { nome: "poTematiche", visibile: !stato.visibili.poTematiche }),
      };
      return comandi[tasto] ?? null;
    },
  };
}
