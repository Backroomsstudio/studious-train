// Drum Challenge: l'equalizzatore (canvas 848×84). Mostra i livelli audio di FL Studio che arrivano dalla regia (12 bande 0…100 e il
// «colpo»): 40 barre dal ciano al magenta con il cappuccio bianco che cade, oppure un'onda specchiata sulle stesse bande.
// Le barre salgono in fretta e scendono piano. Senza dati da 2 s, se «senzaSegnale» è acceso, respira piano a bassa ampiezza;
// altrimenti si svuota. Un solo ciclo di animazione, che si ferma da solo quando non c'è niente da muovere.
// Nei mockup (statico) c'è un fotogramma fisso.
import { interpolaBande, passoBarra, cappuccio, respiro } from "./drum-logica.js";

const BARRE = 40;
const SENZA_DATI_MS = 2000; // da qui il segnale è assente: respiro, o niente
const FERME_MS = 250; // senza un nuovo dato per tanto, le barre ricadono (la regia ne manda 30 al secondo)
const SOGLIA_COLPO = 60;
const MARGINE = 14; // le staffe d'angolo della cornice restano libere ai due lati
const DEMO = [78, 88, 72, 64, 70, 56, 48, 52, 40, 34, 28, 20]; // il fotogramma dei mockup

// Un rettangolo con gli angoli alti arrotondati; dove `roundRect` non c'è, quadrato.
function rettangolo(ctx, x, y, larghezza, altezza, raggio) {
  if (ctx.roundRect) ctx.roundRect(x, y, larghezza, altezza, [raggio, raggio, 1, 1]);
  else ctx.rect(x, y, larghezza, altezza);
}

// suColpo(): chiamata a ogni dato con colpo > 60 (la pagina fa lampeggiare la cornice).
export function creaEqualizzatore(canvas, { stile = "barre", senzaSegnale = true, statico = false, suColpo = () => {} } = {}) {
  const ctx = canvas.getContext("2d");
  const { width: larghezza, height: altezza } = canvas;
  let nome = stile;
  let respira = senzaSegnale;
  let bersagli = Array(BARRE).fill(0);
  let valori = Array(BARRE).fill(0);
  let tappi = Array(BARRE).fill(0);
  let ultimoDato = -Infinity;
  let raf = 0;
  let ultimo = 0;

  const colori = ctx.createLinearGradient(0, altezza, 0, 0); // dal basso: ciano, viola, magenta
  colori.addColorStop(0, "#36dcff");
  colori.addColorStop(0.55, "#a066ff");
  colori.addColorStop(1, "#ff4fd8");
  const riempimentoOnda = ctx.createLinearGradient(0, 0, 0, altezza); // specchiato: magenta ai bordi, ciano al centro
  riempimentoOnda.addColorStop(0, "rgba(255, 79, 216, 0.5)");
  riempimentoOnda.addColorStop(0.5, "rgba(54, 220, 255, 0.78)");
  riempimentoOnda.addColorStop(1, "rgba(255, 79, 216, 0.5)");
  const lineaOnda = ctx.createLinearGradient(MARGINE, 0, larghezza - MARGINE, 0);
  lineaOnda.addColorStop(0, "#36dcff");
  lineaOnda.addColorStop(0.5, "#c9b2ff");
  lineaOnda.addColorStop(1, "#ff4fd8");

  function disegnaBarre() {
    const passo = (larghezza - 2 * MARGINE) / BARRE;
    const largo = passo * 0.66;
    const margine = MARGINE + (passo - largo) / 2;
    const utile = altezza - 6; // sopra la barra resta posto per il cappuccio
    ctx.save();
    ctx.fillStyle = colori;
    ctx.shadowColor = "rgba(54, 220, 255, 0.55)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < BARRE; i++) {
      const alto = valori[i] * utile;
      if (alto >= 0.8) rettangolo(ctx, margine + i * passo, altezza - alto, largo, alto, 3);
    }
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(255, 255, 255, 0.7)";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let i = 0; i < BARRE; i++) {
      if (tappi[i] > 0.02) rettangolo(ctx, margine + i * passo, altezza - tappi[i] * utile - 5, largo, 3, 1.5);
    }
    ctx.fill();
    ctx.restore();
  }

  // La curva liscia sopra (segno −1) o sotto (+1) la linea di mezzo, da un bordo all'altro: quadratiche tra i punti medi.
  function tracciaOnda(punti, centro, segno, inversa) {
    const lista = inversa ? [...punti].reverse() : punti;
    ctx.lineTo(inversa ? larghezza - MARGINE : MARGINE, centro + segno * lista[0].y);
    for (let k = 0; k < lista.length - 1; k++) {
      const a = lista[k];
      const b = lista[k + 1];
      ctx.quadraticCurveTo(a.x, centro + segno * a.y, (a.x + b.x) / 2, centro + segno * ((a.y + b.y) / 2));
    }
    ctx.lineTo(inversa ? MARGINE : larghezza - MARGINE, centro + segno * lista[lista.length - 1].y);
  }

  function disegnaOnda() {
    if (Math.max(...valori) < 0.01) return;
    const centro = altezza / 2;
    const mezza = centro - 3;
    const passo = (larghezza - 2 * MARGINE) / BARRE;
    const punti = valori.map((v, i) => ({ x: MARGINE + (i + 0.5) * passo, y: v * mezza }));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(MARGINE, centro - punti[0].y);
    tracciaOnda(punti, centro, -1, false);
    tracciaOnda(punti, centro, 1, true);
    ctx.closePath();
    ctx.fillStyle = riempimentoOnda;
    ctx.fill();
    ctx.strokeStyle = lineaOnda;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "rgba(160, 102, 255, 0.8)";
    ctx.shadowBlur = 10;
    for (const segno of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(MARGINE, centro + segno * punti[0].y);
      tracciaOnda(punti, centro, segno, false);
      ctx.stroke();
    }
    ctx.restore();
  }

  function disegna() {
    ctx.clearRect(0, 0, larghezza, altezza);
    if (nome === "onda") disegnaOnda();
    else disegnaBarre();
  }

  function ciclo(t) {
    const dt = Math.min(0.1, Math.max(0, (t - ultimo) / 1000));
    ultimo = t;
    const eta = t - ultimoDato;
    const assente = eta > SENZA_DATI_MS;
    for (let i = 0; i < BARRE; i++) {
      const bersaglio = assente && respira ? respiro(t / 1000, i, BARRE) : eta > FERME_MS ? 0 : bersagli[i];
      valori[i] = passoBarra(valori[i], bersaglio, dt);
      tappi[i] = cappuccio(tappi[i], valori[i], dt);
    }
    disegna();
    const serve = respira || valori.some((v) => v > 0.002) || tappi.some((v) => v > 0.002); // col respiro acceso non si ferma: tra poco senza dati tocca a lui
    if (serve) raf = requestAnimationFrame(ciclo);
    else {
      raf = 0;
      ctx.clearRect(0, 0, larghezza, altezza); // niente da mostrare: il canvas torna vuoto
    }
  }

  function avvia() {
    if (statico || raf) return;
    ultimo = performance.now();
    raf = requestAnimationFrame(ciclo);
  }

  function fotogrammaFisso() {
    valori = interpolaBande(DEMO, BARRE);
    tappi = valori.map((v) => Math.min(1, v + 0.06));
    disegna();
  }
  if (!statico) avvia(); // senza dati: subito il respiro, se acceso (nei mockup il fotogramma fisso arriva con `imposta`)

  return {
    // I livelli di un istante: 12 bande 0…100 e il colpo 0…100.
    dati(bande, colpo = 0) {
      if (statico) return;
      bersagli = interpolaBande(bande, BARRE);
      ultimoDato = performance.now();
      if (colpo > SOGLIA_COLPO) suColpo();
      avvia();
    },
    imposta({ stile: nuovoStile, senzaSegnale: nuovoRespiro } = {}) {
      if (nuovoStile !== undefined) nome = nuovoStile === "onda" ? "onda" : "barre";
      if (nuovoRespiro !== undefined) respira = Boolean(nuovoRespiro);
      if (statico) fotogrammaFisso();
      else avvia();
    },
    ferma() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
