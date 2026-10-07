// Drum Challenge: la sequenza di sblocco di una tappa (tempi in SBLOCCO, drum-logica.js). Al via il modulo urta (scala 1,06 e
// scossa) e lampeggia in verde neon, parte un'onda d'urto con una raffica di perline, il lucchetto diventa spunta, il bersaglio
// si fa verde e il titolo si rivela con le lettere che girano. Dopo 1 s compare il banner (per 3,2 s); a 1,8 s la colonna scorre
// di un posto: il primo modulo esce in alto, il nuovo entra in basso. Un secondo sblocco durante la sequenza si accoda e
// resta solo l'ultimo. La pagina disegna la colonna e il banner: qui si dice cosa mostrare (voci) e quando rifare il disegno.
import { SBLOCCO, colonnaSblocco, titoloSlot, titoloBrano } from "./drum-logica.js";
import { STILI } from "./drum-clessidra.js";

const PASSO = 164; // distanza tra due moduli (come in drum.css)
const FINE_URTO_MS = 700; // dopo, il lampo è spento
const PERLINE = 22;
const crea = (classe, tag = "div") => Object.assign(document.createElement(tag), { className: classe });

// moduli: i quattro moduli della colonna ({ el, titolo, tappa, clessidra… }); nuovoModulo(): ne crea uno in fondo (il quinto, che
// entra scorrendo); riempi(modulo, voce, d): lo riempie; rifai(): rifà la colonna dallo stato; leggi(): lo stato `drum` di ora;
// colonna, effetti: i due elementi della pagina; banner: { mostra(dati), nascondi({ subito }) }.
export function creaSblocco({ moduli, nuovoModulo, riempi, rifai, leggi, colonna, effetti, banner }) {
  let corsa = null; // lo sblocco in corso: { dati, tappe, fase: "urto" | "scorre" | "fine", timer, effetti, scorrimento, entrante }
  let coda = null; // lo sblocco arrivato mentre ne correva un altro (solo l'ultimo)
  let timerBanner = 0;

  const programma = (ms, fn) => corsa.timer.push(setTimeout(fn, ms));

  // Posizione del centro e misure del modulo nel riquadro degli effetti (in pixel della pagina, senza la scala del palco).
  function misure(modulo) {
    const { el } = modulo;
    return {
      x: colonna.offsetLeft + el.offsetLeft - effetti.offsetLeft + el.offsetWidth / 2,
      y: colonna.offsetTop + el.offsetTop - effetti.offsetTop + el.offsetHeight / 2,
      larghezza: el.offsetWidth,
      altezza: el.offsetHeight,
    };
  }

  // Un'animazione degli effetti: l'elemento sparisce quando finisce, e se la sequenza si interrompe si ferma con lei.
  function anima(el, passi, opzioni) {
    const animazione = el.animate(passi, opzioni);
    animazione.onfinish = () => el.remove();
    corsa.effetti.push(animazione);
  }

  function onda({ x, y, larghezza, altezza }) {
    const el = crea("dr-onda");
    el.style.cssText = `left:${x - larghezza / 2}px;top:${y - altezza / 2}px;width:${larghezza}px;height:${altezza}px`;
    effetti.append(el);
    anima(el, [{ transform: "scale(1)", opacity: 0.95 }, { transform: "scale(1.8, 2.3)", opacity: 0 }], { duration: 800, easing: "cubic-bezier(0.1, 0.7, 0.3, 1)" });
  }

  // Le perline schizzano dal modulo verso sinistra, in alto e in basso (a destra c'è il bordo dei contenuti) e ricadono.
  function raffica({ x, y, larghezza, altezza }) {
    const { colori } = STILI.perline;
    for (let i = 0; i < PERLINE; i++) {
      const el = crea("dr-schizzo");
      el.style.setProperty("--c", colori[i % colori.length]);
      el.style.left = `${x + (Math.random() - 0.5) * larghezza * 0.7}px`;
      el.style.top = `${y + (Math.random() - 0.5) * altezza * 0.5}px`;
      effetti.append(el);
      const angolo = Math.PI * (0.55 + Math.random() * 0.9);
      const forza = 80 + Math.random() * 190;
      const dx = Math.cos(angolo) * forza;
      const dy = Math.sin(angolo) * forza * 0.8 - 40;
      anima(
        el,
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${dx * 0.7}px, ${dy * 0.7 - 30}px) scale(1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx}px, ${dy + 150}px) scale(0.6)`, opacity: 0 },
        ],
        { duration: 750 + Math.random() * 600, delay: Math.random() * 120, easing: "cubic-bezier(0.2, 0.7, 0.4, 1)" },
      );
    }
  }

  // Il titolo gira come uno slot e si ferma lettera dopo lettera, a sinistra per prime, poco prima del banner.
  function rivela(modulo, finale) {
    const inizio = performance.now() + SBLOCCO.titoloMs;
    const durata = SBLOCCO.bannerDopoMs - SBLOCCO.titoloMs - 100;
    modulo.titolo.textContent = titoloSlot(finale, 0);
    const giro = setInterval(() => {
      const k = (performance.now() - inizio) / durata;
      modulo.titolo.textContent = k >= 1 ? finale : titoloSlot(finale, Math.max(0, k));
      if (k >= 1) clearInterval(giro);
    }, 45);
    corsa.rivela = giro;
  }

  function urto(modulo, dati) {
    modulo.el.classList.add("sblocco");
    modulo.el.append(crea("dr-lampo", "i"));
    const dove = misure(modulo);
    onda(dove);
    raffica(dove);
    rivela(modulo, titoloBrano(dati.titolo));
  }

  // Toglie dalla pagina quello che la sequenza ha aggiunto: classe, lampi, effetti rimasti, modulo che entrava.
  function pulisci() {
    for (const m of moduli) {
      m.el.classList.remove("sblocco");
      for (const lampo of m.el.querySelectorAll(".dr-lampo")) lampo.remove();
    }
    if (corsa) {
      clearInterval(corsa.rivela);
      for (const a of [...corsa.effetti, ...corsa.scorrimento]) a.cancel();
      corsa.entrante?.el.remove();
      corsa.entrante?.clessidra.ferma();
      corsa.entrante = null;
    }
    effetti.replaceChildren();
    colonna.classList.remove("scorre");
  }

  function scorri() {
    const { tappe } = corsa;
    corsa.fase = "scorre";
    const d = leggi();
    // La tappa dopo si accende (attiva) nel suo posto, e se la finestra scorre entra in fondo il modulo nuovo.
    moduli.forEach((m, i) => riempi(m, tappe.scorre[i], d));
    if (tappe.entra) {
      corsa.entrante = nuovoModulo();
      riempi(corsa.entrante, tappe.entra, d);
      colonna.classList.add("scorre"); // il modulo che esce sparisce sotto il bordo alto della colonna
      const opzioni = { duration: SBLOCCO.scorriDurataMs, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "forwards" };
      const su = (opacita) => [{ transform: "translateY(0)", ...(opacita && { opacity: opacita[0] }) }, { transform: `translateY(${-PASSO}px)`, ...(opacita && { opacity: opacita[1] }) }];
      moduli.forEach((m, i) => corsa.scorrimento.push(m.el.animate(su(i === 0 ? [1, 0] : null), opzioni)));
      const aspetto = Number(getComputedStyle(corsa.entrante.el).opacity);
      corsa.scorrimento.push(corsa.entrante.el.animate(su([0, aspetto]), opzioni));
    }
    programma(SBLOCCO.scorriDurataMs, () => {
      pulisci();
      corsa.fase = "fine";
      rifai(); // la finestra con le tappe raggiunte aggiornate, dallo stato di ora
    });
  }

  function concludi() {
    const prossimo = coda;
    corsa = null;
    coda = null;
    if (prossimo) avvia(prossimo);
  }

  function avvia(dati) {
    if (corsa) {
      coda = dati; // resta solo l'ultimo
      return;
    }
    const tappe = colonnaSblocco(leggi().scaletta, dati.indice, moduli.length);
    if (!tappe) return;
    corsa = { dati, tappe, fase: "urto", timer: [], effetti: [], scorrimento: [], entrante: null, rivela: 0 };
    clearTimeout(timerBanner);
    banner.nascondi({ subito: true }); // se c'è ancora quello dello sblocco di prima
    rifai(); // la finestra di prima, con la tappa che si sblocca già verde e piena
    const modulo = moduli.find((m) => m.tappa === dati.indice);
    if (modulo) urto(modulo, dati);
    programma(FINE_URTO_MS, () => {
      for (const m of moduli) for (const lampo of m.el.querySelectorAll(".dr-lampo")) lampo.remove();
    });
    programma(SBLOCCO.bannerDopoMs, () => banner.mostra(dati));
    timerBanner = setTimeout(() => banner.nascondi(), SBLOCCO.bannerDopoMs + SBLOCCO.bannerDurataMs);
    programma(SBLOCCO.scorriDopoMs, scorri);
    programma(SBLOCCO.totaleMs, concludi);
  }

  // La colonna spenta a metà: tutto si ferma, sparisce quello che era a metà e la colonna torna alla finestra aggiornata.
  function annulla() {
    clearTimeout(timerBanner);
    banner.nascondi({ subito: true });
    if (!corsa && !coda) return;
    if (corsa) for (const t of corsa.timer) clearTimeout(t);
    pulisci();
    corsa = null;
    coda = null;
    rifai();
  }

  return {
    avvia,
    annulla,
    // Mentre la sequenza è nel suo urto la colonna mostra la finestra di prima, con la tappa già sbloccata (null: finestra normale).
    voci: () => (corsa?.fase === "urto" ? corsa.tappe.prima : null),
    // Mentre la colonna scorre la sequenza la disegna da sé: la pagina non la tocca.
    occupata: () => corsa?.fase === "scorre",
    inCorso: () => corsa !== null,
  };
}
