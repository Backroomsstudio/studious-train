// Drum Challenge: la «clessidra rettangolare» dei moduli della colonna. Il livello sale dal basso in proporzione ai Like
// (animato, nessun salto) e, mentre i Like crescono, un filo di grani cade dal bordo alto verso la superficie.
// Due stili scelti dalla regia: perline (sfere lucide da 14 px a nido d'ape) e sabbia (grani da 5 px, superficie liscia).
// Il livello è deterministico (non una simulazione): i grani che cadono sono solo scena. Canvas 2D, ridisegnato solo
// quando cambia qualcosa o c'è animazione.

export const STILI = {
  perline: { raggio: 7, colori: ["#ffd54a", "#a066ff", "#36dcff", "#ff4fd8", "#fff2a8"], lucido: true },
  sabbia: { raggio: 2.5, colori: ["#f5b72a", "#ffd863", "#e09a12", "#fff0b0"], lucido: false },
};

const limita = (x) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

// Generatore pseudocasuale con seme (mulberry32): stessi parametri, stessi grani.
function generatore(seme) {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// I grani in ordine di deposito: righe a nido d'ape dal basso (passo raggio·√3, grani a passo 2·raggio, le righe dispari
// spostate di un raggio), dentro ogni riga in ordine mescolato. A `livello` ne escono round(livello · totale): i posati
// non si spostano mai. `colore` è un indice in 0…colori−1, stabile per grano. Tutti i centri stanno dentro il campo.
export function posizioniGrani({ larghezza, altezza, raggio, livello, seme = 7, colori = 5 }) {
  const passoRiga = raggio * Math.sqrt(3);
  const righe = Math.floor((altezza - 2 * raggio) / passoRiga) + 1;
  const casuale = generatore(seme);
  const tutti = [];
  for (let r = 0; r < righe; r++) {
    const y = altezza - raggio - r * passoRiga;
    const riga = [];
    for (let x = raggio + (r % 2 ? raggio : 0); x <= larghezza - raggio + 1e-9; x += 2 * raggio) riga.push({ x, y });
    for (let i = riga.length - 1; i > 0; i--) {
      const j = Math.floor(casuale() * (i + 1));
      [riga[i], riga[j]] = [riga[j], riga[i]];
    }
    for (const g of riga) tutti.push({ x: g.x, y: g.y, colore: Math.floor(casuale() * colori) });
  }
  return tutti.slice(0, Math.round(limita(livello) * tutti.length));
}

// ---------- Disegno (solo nel browser) ----------
const MARGINE = 12; // spazio ai lati del campo dei grani nel canvas 288 px
const TRASPARENZA = 0.8; // i grani lasciano leggere il testo del modulo
const COSTANTE_TEMPO = 0.15; // s: il livello mostrato rincorre quello vero (a ~0,6 s è arrivato)
const CADUTA_MS = 1000; // quanto dura il filo di grani dopo l'ultima crescita dei Like

const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const mescola = (hex, con, k) => `rgb(${rgb(hex).map((c, i) => Math.round(c + (con[i] - c) * k)).join(",")})`;

// Uno sprite per colore: la perlina è una sfera con riflesso, il granello di sabbia un disco pieno.
function creaSprite(stile, colore) {
  const { raggio, lucido } = STILI[stile];
  const lato = Math.ceil(raggio * 2 + 2);
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = lato;
  const c = sprite.getContext("2d");
  const centro = lato / 2;
  if (lucido) {
    const sfera = c.createRadialGradient(centro - raggio * 0.35, centro - raggio * 0.4, raggio * 0.08, centro, centro, raggio);
    sfera.addColorStop(0, mescola(colore, [255, 255, 255], 0.85));
    sfera.addColorStop(0.35, colore);
    sfera.addColorStop(1, mescola(colore, [10, 5, 30], 0.55));
    c.fillStyle = sfera;
    c.beginPath();
    c.arc(centro, centro, raggio - 0.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.9)"; // riflesso
    c.beginPath();
    c.arc(centro - raggio * 0.32, centro - raggio * 0.36, raggio * 0.2, 0, Math.PI * 2);
    c.fill();
  } else {
    c.fillStyle = colore;
    c.beginPath();
    c.arc(centro, centro, raggio, 0, Math.PI * 2);
    c.fill();
  }
  return sprite;
}

// imposta({ livello, attiva, subito }): `livello` 0…1; `attiva` = i Like stanno crescendo (parte il filo di grani, per 1 s);
// `subito` (o statico) salta l'animazione. ridisegna() rifà il disegno com'è, cambiaStile() passa a perline o sabbia.
export function creaClessidra(canvas, { stile = "perline", statico = false } = {}) {
  const ctx = canvas.getContext("2d");
  const { width: larghezza, height: altezza } = canvas;
  let nome = stile;
  let sprite = [];
  let grani = [];
  let mostrato = 0;
  let obiettivo = 0;
  let raf = 0;
  let ultimo = 0;
  let attivaFino = 0;
  let caduta = [];

  function prepara() {
    const { colori } = STILI[nome];
    sprite = colori.map((colore) => creaSprite(nome, colore));
    grani = posizioniGrani({ larghezza: larghezza - 2 * MARGINE, altezza, raggio: STILI[nome].raggio, livello: 1, colori: colori.length });
  }

  function disegna() {
    ctx.clearRect(0, 0, larghezza, altezza);
    const lato = sprite[0].width;
    ctx.globalAlpha = TRASPARENZA;
    const n = Math.round(limita(mostrato) * grani.length);
    for (let i = 0; i < n; i++) {
      const g = grani[i];
      ctx.drawImage(sprite[g.colore], MARGINE + g.x - lato / 2, g.y - lato / 2);
    }
    for (const g of caduta) ctx.drawImage(sprite[g.colore], g.x - lato / 2, g.y - lato / 2);
    ctx.globalAlpha = 1;
  }

  function aggiornaCaduta(dt, ora) {
    const { raggio, colori } = STILI[nome];
    const superficie = altezza * (1 - limita(mostrato)) - raggio;
    caduta = caduta.filter((g) => {
      g.vy += 700 * dt;
      g.y += g.vy * dt;
      return g.y < superficie;
    });
    if (ora < attivaFino && mostrato < 0.97 && caduta.length < 8 && Math.random() < 0.4) {
      caduta.push({ x: larghezza / 2 + (Math.random() - 0.5) * 10, y: -raggio, vy: 40 + Math.random() * 50, colore: Math.floor(Math.random() * colori.length) });
    }
  }

  function ciclo(t) {
    const dt = Math.min(0.1, Math.max(0, (t - ultimo) / 1000));
    ultimo = t;
    mostrato += (obiettivo - mostrato) * (1 - Math.exp(-dt / COSTANTE_TEMPO));
    if (Math.abs(obiettivo - mostrato) < 0.0004) mostrato = obiettivo;
    aggiornaCaduta(dt, t);
    disegna();
    // si ferma da sola: niente animazione continua quando non serve
    raf = mostrato !== obiettivo || caduta.length || t < attivaFino ? requestAnimationFrame(ciclo) : 0;
  }

  function avvia() {
    if (raf || statico) return;
    ultimo = performance.now();
    raf = requestAnimationFrame(ciclo);
  }

  prepara();
  disegna();

  return {
    imposta({ livello, attiva = false, subito = false }) {
      obiettivo = limita(livello);
      if (statico || subito) {
        mostrato = obiettivo;
        caduta = [];
        if (!raf) disegna();
        return;
      }
      if (attiva) attivaFino = performance.now() + CADUTA_MS;
      if (mostrato !== obiettivo || attiva) avvia();
    },
    ridisegna: disegna,
    cambiaStile(nuovo) {
      if (nuovo === nome || !STILI[nuovo]) return;
      nome = nuovo;
      caduta = [];
      prepara();
      disegna();
    },
    ferma() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
