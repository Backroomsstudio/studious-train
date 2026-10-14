// Widget Goal («Mancano 1.250 like al nuovo obiettivo» e «Mancano 12 follower al nuovo obiettivo»), uguale in tutti i layout:
// una sezione di vetro 400×120 con due righe, messa sulla tela dalla posizione scelta in regia (o da quella di partenza del layout).
// Con il modo «a comparsa» compare ogni `ogniMinuti` per `durataSecondi`; l'evento goalMostra (regia) lo fa comparire subito.
import { nodo, rilancia } from "./pagina.js";
import { partiGoal, posizioneGoal, goalVisibile, daFarComparire, LARGHEZZA_GOAL, ALTEZZA_GOAL } from "./goal-logica.js";

function creaRiga(classe) {
  const riga = nodo("div", `gl-riga ${classe}`);
  const numero = nodo("b", "gl-numero");
  const testi = nodo("span", "gl-testi");
  const prefisso = nodo("span", "gl-prefisso");
  const unita = nodo("span", "gl-unita");
  testi.append(prefisso, unita);
  riga.append(numero, testi);
  return { riga, numero, prefisso, unita };
}

// palco: la tela; chiave: il layout (chiaveGoal); statico: senza animazioni (mockup). aggiorna(stato, eventi) a ogni stato.
export function creaGoal({ palco, chiave, statico = false }) {
  const radice = nodo("section", "gl fuori");
  radice.dataset.parte = "goal";
  const like = creaRiga("like");
  const follower = creaRiga("follower");
  radice.append(like.riga, follower.riga);
  palco.append(radice);
  radice.style.width = `${LARGHEZZA_GOAL}px`;
  radice.style.height = `${ALTEZZA_GOAL}px`;

  let stato = null;
  let ultimaComparsaAlle = null;
  let mostraOraAlle = null;
  let primo = true;

  function scrivi(riga, parti) {
    riga.riga.hidden = !parti;
    if (!parti) return;
    if (riga.numero.textContent !== parti.numero) {
      const eraVuoto = !riga.numero.textContent;
      riga.numero.textContent = parti.numero;
      if (!statico && !primo && !eraVuoto) rilancia(riga.numero, "scatto");
    }
    riga.prefisso.textContent = parti.prefisso;
    riga.unita.textContent = [parti.unita, parti.suffisso].filter(Boolean).join(" ");
    // Un numero lungo (1.250.000) o un testo largo rimpicciolisce tutta la riga, mai oltre il 60%.
    riga.riga.style.setProperty("--gl-k", "1");
    const larghezza = riga.riga.clientWidth;
    const occupata = riga.numero.offsetWidth + Math.max(riga.prefisso.scrollWidth, riga.unita.scrollWidth); // senza i 14 px tra le due parti, che non scalano
    if (larghezza > 0 && occupata + 14 > larghezza) riga.riga.style.setProperty("--gl-k", String(Math.max(0.6, ((larghezza - 14) / occupata) * 0.98)));
  }

  function disegnaVisibilita() {
    if (!stato) return;
    const ora = Date.now();
    if (daFarComparire(stato.goal, ora, ultimaComparsaAlle) && stato.visibili.goal) ultimaComparsaAlle = ora;
    const p = partiGoal(stato.goal);
    const visibile = goalVisibile(stato.goal, stato.visibili.goal, ora, ultimaComparsaAlle, mostraOraAlle) && Boolean(p.like || p.follower);
    radice.classList.toggle("fuori", !visibile);
  }

  setInterval(disegnaVisibilita, 1000);
  // Con i font caricati le larghezze cambiano: si rifà la misura delle righe.
  document.fonts?.ready.then(() => stato && (scrivi(like, partiGoal(stato.goal).like), scrivi(follower, partiGoal(stato.goal).follower)));

  return {
    radice,
    aggiorna(s, eventi = []) {
      stato = s;
      if (eventi.some((e) => e.nome === "goalMostra")) mostraOraAlle = Date.now();
      const { x, y, scala } = posizioneGoal(s.goal, chiave);
      radice.style.left = `${x}px`;
      radice.style.top = `${y}px`;
      radice.style.setProperty("--gl-scala", String(scala));
      const p = partiGoal(s.goal);
      scrivi(like, p.like);
      scrivi(follower, p.follower);
      disegnaVisibilita();
      primo = false;
    },
  };
}
