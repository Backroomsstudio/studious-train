// Regia: richieste con regalo (Reaction Release; il Drum Challenge usa lo stesso blocco con `conBrano: false`). Il regalo che le fa
// partire (nome o ID, con i «Regali visti» da cui sceglierlo con un clic) e la coda: per ogni richiesta «@nome · Rosa ×1», il brano
// (titolo e artista, scritto dalla regia) e i pulsanti In onda, Fatta e Scarta. I campi in uso non si riscrivono.
// Gli elementi hanno gli id `<prefisso>-regalo`, `<prefisso>-visti` e `<prefisso>-coda` (e `<prefisso>-durata` con `durata`).
// Le funzioni arrivano da regia.js: `$`, `el`, `invia`, `avviso`, `riempi` e `salvato`.
export function avviaRegiaRichieste({ $, el, invia, avviso, riempi, salvato, prefisso, formato, conBrano = true, durata = false }) {
  const modulo = $(`#${prefisso}-regalo`);
  const visti = $(`#${prefisso}-visti`);
  const coda = $(`#${prefisso}-coda`);
  let ultimo = null;

  modulo.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dati = { regalo: modulo.elements.regalo.value };
    if (durata) dati.durataRichiesta = modulo.elements.durata.value;
    const esito = await invia(formato, dati);
    if (esito.ok) {
      salvato(modulo);
      avviso(dati.regalo.trim() ? "Regalo delle richieste aggiornato" : "Richieste spente", "ok");
    }
  });

  // «Regali visti»: un clic sceglie quel regalo (il nome, o l'ID se il nome manca).
  visti.addEventListener("click", async (e) => {
    const bottone = e.target.closest("button[data-regalo]");
    if (!bottone) return;
    const esito = await invia(formato, { regalo: bottone.dataset.regalo });
    if (esito.ok) {
      delete modulo.elements.regalo.dataset.modificato;
      avviso(`Regalo scelto: ${bottone.dataset.regalo}`, "ok");
    }
  });

  // I tre pulsanti di una richiesta (il brano si legge dai due campi della sua riga).
  coda.addEventListener("click", async (e) => {
    const bottone = e.target.closest("button[data-azione]");
    if (!bottone) return;
    const riga = bottone.closest("li");
    const dati = { formato, azione: bottone.dataset.azione, id: riga.dataset.id };
    if (conBrano && dati.azione === "inOnda") dati.brano = { titolo: riga.querySelector("[name=titolo]").value, artista: riga.querySelector("[name=artista]").value };
    await invia("richiesta", dati);
  });

  const descrivi = (r) => `@${r.utente.replace(/^@+/, "") || "?"} · ${r.nome || "regalo"}${r.quantita > 1 ? ` ×${r.quantita}` : ""}`;

  function rigaRichiesta(r) {
    const li = el("li", { "data-id": r.id, class: `richiesta ${r.stato}` });
    li.append(el("span", { class: "richiesta-chi" }, descrivi(r), r.stato === "inOnda" ? " · in onda" : r.stato === "fatta" ? " · fatta" : ""));
    if (conBrano) {
      li.append(
        el("input", { name: "titolo", placeholder: "Titolo del brano", maxlength: "60", value: r.brano?.titolo ?? "", "aria-label": "Titolo del brano" }),
        el("input", { name: "artista", placeholder: "Artista", maxlength: "40", value: r.brano?.artista ?? "", "aria-label": "Artista del brano" }),
      );
    }
    const azioni = el("span", { class: "richiesta-azioni" });
    if (conBrano && r.stato !== "fatta") azioni.append(el("button", { type: "button", class: "piccolo primario", "data-azione": "inOnda" }, "In onda"));
    if (r.stato !== "fatta") azioni.append(el("button", { type: "button", class: "piccolo", "data-azione": "fatta" }, "Fatta"));
    azioni.append(el("button", { type: "button", class: "piccolo", "data-azione": "scarta" }, "Scarta"));
    li.append(azioni);
    return li;
  }

  return {
    disegna(s) {
      ultimo = s;
      const stato = s[formato];
      riempi(modulo.elements.regalo, stato.richieste.regalo);
      if (durata) riempi(modulo.elements.durata, stato.durataRichiesta);
      // I regali visti si ridisegnano solo se cambiano; con il regalo scelto già in onda quello è evidenziato.
      const firmaVisti = JSON.stringify([s.regaliVisti, stato.richieste.regalo]);
      if (visti.dataset.firma !== firmaVisti) {
        visti.dataset.firma = firmaVisti;
        visti.replaceChildren(
          ...(s.regaliVisti.length
            ? s.regaliVisti.map((v) => {
                const valore = v.nome || String(v.id);
                const scelto = valore.toLowerCase() === (stato.richieste.regalo ?? "").trim().toLowerCase();
                return el("button", { type: "button", class: `piccolo chip${scelto ? " attivo" : ""}`, "data-regalo": valore, title: v.utente ? `ultimo: @${v.utente}` : "" }, v.nome || `ID ${v.id}`, v.id ? ` · ${v.id}` : "");
              })
            : [el("span", { class: "nota" }, "Nessun regalo ancora: appena ne arriva uno dalla live compare qui.")]),
        );
      }
      // La coda non si ridisegna mentre la regia scrive il brano.
      if (coda.contains(document.activeElement)) return;
      const firmaCoda = JSON.stringify(stato.richieste.coda);
      if (coda.dataset.firma === firmaCoda) return;
      coda.dataset.firma = firmaCoda;
      coda.replaceChildren(...stato.richieste.coda.map(rigaRichiesta));
      $(`#${prefisso}-coda-vuota`).hidden = stato.richieste.coda.length > 0;
    },
  };
}
