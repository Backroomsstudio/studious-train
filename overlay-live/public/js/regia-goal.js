// Regia: Goal Like e Follower. Obiettivi e passi, follower di adesso (imposta, +1, +10), modo (sempre o a comparsa, con le due
// durate e «Mostra ora»), posizione per layout (X, Y, scala, frecce da 8 px, «Ripristina posizione») e l'anteprima dei due testi.
// I campi in uso non si riscrivono (`riempi`). Le funzioni arrivano da regia.js: `$`, `invia`, `avviso`, `riempi` e `salvato`.
import { testiGoal, posizioneGoal, POSIZIONI_GOAL } from "./goal-logica.js";

const NOMI_LAYOUT = { gara: "Gara", senzaPremio: "Senza premio", studio: "Live session", battle: "Battle", drum: "Drum", produzione: "Studio Production", podcast: "Podcast 9:16", podcastO: "Podcast 16:9", reaction: "Reaction 9:16", reactionO: "Reaction 16:9" };
const PASSO_FRECCE = 8;

export function avviaRegiaGoal({ $, invia, avviso, riempi, salvato }) {
  const selezione = $("#goal-layout");
  for (const chiave of Object.keys(POSIZIONI_GOAL)) selezione.append(Object.assign(document.createElement("option"), { value: chiave, textContent: NOMI_LAYOUT[chiave] ?? chiave }));
  let ultimo = null;
  let sceltaFatta = false; // finché la regia non sceglie un layout, segue quello in onda
  selezione.addEventListener("change", () => {
    sceltaFatta = true;
    for (const nome of ["x", "y", "scala"]) delete $("#f-goal-posizione").elements[nome].dataset.modificato;
    if (ultimo) disegnaPosizione(ultimo);
  });

  const modulo = (id) => $(id);
  const campo = (form, nome) => form.elements[nome];

  async function manda(dati, form, testo) {
    const esito = await invia("goal", dati);
    if (esito.ok) {
      if (form) salvato(form);
      if (testo) avviso(testo, "ok");
    }
    return esito;
  }

  modulo("#f-goal").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    manda({ like: { obiettivo: campo(f, "like-obiettivo").value, passo: campo(f, "like-passo").value }, follower: { obiettivo: campo(f, "follower-obiettivo").value, passo: campo(f, "follower-passo").value } }, f, "Obiettivi aggiornati");
  });

  const seguaci = modulo("#f-goal-follower");
  seguaci.addEventListener("submit", (e) => {
    e.preventDefault();
    const valore = campo(seguaci, "totale").value.trim();
    if (valore === "") return avviso("Scrivi quanti follower avete adesso", "errore");
    manda({ follower: { imposta: valore } }, seguaci, "Follower aggiornati");
  });
  for (const bottone of seguaci.querySelectorAll("[data-aggiungi]")) bottone.addEventListener("click", () => manda({ follower: { aggiungi: Number(bottone.dataset.aggiungi) } }));

  const modo = modulo("#f-goal-modo");
  modo.addEventListener("submit", (e) => {
    e.preventDefault();
    manda({ modo: campo(modo, "modo").value, ogniMinuti: campo(modo, "ogniMinuti").value, durataSecondi: campo(modo, "durataSecondi").value }, modo, "Goal aggiornato");
  });
  $("#goal-mostra").addEventListener("click", () => invia("goalMostra"));

  const posizione = modulo("#f-goal-posizione");
  const layoutScelto = () => selezione.value;
  posizione.addEventListener("submit", (e) => {
    e.preventDefault();
    manda({ posizione: { layout: layoutScelto(), x: campo(posizione, "x").value, y: campo(posizione, "y").value, scala: campo(posizione, "scala").value } }, posizione);
  });
  for (const freccia of document.querySelectorAll("#goal-regia [data-muovi]")) {
    freccia.addEventListener("click", () => {
      if (!ultimo) return;
      const [dx, dy] = freccia.dataset.muovi.split(",").map(Number);
      const { x, y } = posizioneGoal(ultimo.goal, layoutScelto());
      manda({ posizione: { layout: layoutScelto(), x: Math.max(0, x + dx), y: Math.max(0, y + dy) } });
    });
  }
  $("#goal-ripristina").addEventListener("click", () => manda({ posizione: { layout: layoutScelto(), ripristina: true } }, null, "Posizione ripristinata"));

  function disegnaPosizione(s) {
    const { x, y, scala } = posizioneGoal(s.goal, layoutScelto());
    riempi(campo(posizione, "x"), Math.round(x));
    riempi(campo(posizione, "y"), Math.round(y));
    riempi(campo(posizione, "scala"), Math.round(scala * 100));
  }

  return {
    disegna(s) {
      ultimo = s;
      const g = s.goal;
      const chiaveInOnda = POSIZIONI_GOAL[s.layout] ? s.layout : "gara";
      if (!sceltaFatta && selezione.value !== chiaveInOnda) selezione.value = chiaveInOnda;
      const f = modulo("#f-goal");
      riempi(campo(f, "like-obiettivo"), g.like.obiettivo);
      riempi(campo(f, "like-passo"), g.like.passo);
      riempi(campo(f, "follower-obiettivo"), g.follower.obiettivo);
      riempi(campo(f, "follower-passo"), g.follower.passo);
      riempi(campo(seguaci, "totale"), g.follower.totale);
      riempi(campo(modo, "ogniMinuti"), g.ogniMinuti);
      riempi(campo(modo, "durataSecondi"), g.durataSecondi);
      if (document.activeElement !== campo(modo, "modo")) campo(modo, "modo").value = g.modo;
      $("#goal-avviso").hidden = g.follower.totale !== null;
      disegnaPosizione(s);
      const t = testiGoal(g);
      $("#goal-anteprima").textContent = `In onda: ${[t.like, t.follower].filter(Boolean).join(" · ") || "niente (totali sconosciuti)"}`;
    },
  };
}
