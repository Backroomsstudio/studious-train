// Effetti sonori della live, sintetizzati al momento con Web Audio: nessun file da scaricare, nessun diritto d'autore.
// Ogni effetto è una piccola "partitura" di oscillatori, rumore filtrato e riverbero.
// Uso: suona("entrata"), suona("voto", { valore: 8 }), volume(0.8).

let ctx = null;
let bus = null; // segnale diretto
let riverbero = null; // mandata al riverbero
let uscita = null; // volume generale
let rumoreBianco = null;
let volumeAttuale = 0.8;

function contesto() {
  if (!ctx) {
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const compressore = ctx.createDynamicsCompressor();
    compressore.threshold.value = -16;
    compressore.knee.value = 10;
    compressore.ratio.value = 5;
    compressore.attack.value = 0.003;
    compressore.release.value = 0.25;
    uscita = ctx.createGain();
    uscita.gain.value = volumeAttuale;
    compressore.connect(uscita).connect(ctx.destination);

    bus = ctx.createGain();
    bus.connect(compressore);
    riverbero = ctx.createConvolver();
    riverbero.buffer = codaRiverbero(2.6, 3);
    const ritorno = ctx.createGain();
    ritorno.gain.value = 0.42;
    riverbero.connect(ritorno).connect(compressore);

    rumoreBianco = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const dati = rumoreBianco.getChannelData(0);
    for (let i = 0; i < dati.length; i++) dati[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// Risposta all'impulso di una sala: rumore stereo che si spegne in modo esponenziale.
function codaRiverbero(secondi, decadimento) {
  const n = Math.floor(ctx.sampleRate * secondi);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decadimento;
  }
  return buf;
}

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Uscita di una voce: volume con inviluppo, panorama e mandata al riverbero.
function voce(t0, { att = 0.005, dur = 0.3, vol = 0.3, riv = 0.2, pan = 0 }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(att + 0.01, dur));
  let nodo = g;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    nodo = p;
  }
  nodo.connect(bus);
  if (riv) {
    const mandata = ctx.createGain();
    mandata.gain.value = riv;
    nodo.connect(mandata).connect(riverbero);
  }
  return g;
}

function filtra(sorgente, t0, dur, { tipo = "lowpass", f, f2, q = 1, durFiltro = dur }) {
  const fl = ctx.createBiquadFilter();
  fl.type = tipo;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t0);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + durFiltro);
  sorgente.connect(fl);
  return fl;
}

function tono(t0, { f, f2 = null, glide, tipo = "sine", dur = 0.3, att, vol = 0.3, riv = 0.2, pan = 0, detune = 0, filtro = null }) {
  const o = ctx.createOscillator();
  o.type = tipo;
  o.detune.value = detune;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + (glide ?? dur));
  const uscitaVoce = voce(t0, { att, dur, vol, riv, pan });
  (filtro ? filtra(o, t0, dur, filtro) : o).connect(uscitaVoce);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function rumore(t0, { dur = 0.4, att, vol = 0.2, riv = 0.2, pan = 0, tipo = "bandpass", f = 1200, f2, q = 1 }) {
  const s = ctx.createBufferSource();
  s.buffer = rumoreBianco;
  s.loop = true;
  filtra(s, t0, dur, { tipo, f, f2, q }).connect(voce(t0, { att, dur, vol, riv, pan }));
  s.start(t0, Math.random() * 1.5);
  s.stop(t0 + dur + 0.05);
}

// ---------- Strumenti ----------
const colpo = (t, forza = 1) => {
  tono(t, { f: 160, f2: 38, glide: 0.35, dur: 0.7, vol: 0.95 * forza, riv: 0.08 });
  rumore(t, { tipo: "lowpass", f: 900, f2: 120, dur: 0.25, vol: 0.45 * forza, riv: 0.1 });
};
const piatto = (t, forza = 1) => rumore(t, { tipo: "highpass", f: 6000, dur: 1.6, vol: 0.22 * forza, riv: 0.6 });
const rullante = (t, vol = 0.3) => {
  rumore(t, { tipo: "bandpass", f: 2400, q: 0.8, dur: 0.12, vol, riv: 0.15, pan: (Math.random() - 0.5) * 0.4 });
  tono(t, { f: 210, f2: 150, dur: 0.07, vol: vol * 0.6, riv: 0 });
};
const whoosh = (t, dur = 0.6, su = true, vol = 0.32) =>
  rumore(t, { tipo: "bandpass", f: su ? 260 : 5000, f2: su ? 5200 : 220, q: 1.6, att: dur * 0.75, dur, vol, riv: 0.35 });

function scintille(t, quante = 8, spread = 0.5, vol = 0.07) {
  for (let i = 0; i < quante; i++) {
    const f = 2200 + Math.random() * 3600;
    tono(t + Math.random() * spread, { f, dur: 0.18 + Math.random() * 0.2, vol, riv: 0.7, pan: Math.random() * 1.6 - 0.8 });
  }
}

// Accordo "ottoni": dente di sega leggermente scordato, filtro che si apre.
function ottoni(t, note, { dur = 1, vol = 0.12, apri = 3600, att = 0.04 } = {}) {
  for (const n of note) {
    for (const detune of [-8, 8]) {
      tono(t, { f: hz(n), tipo: "sawtooth", detune, dur, att, vol: vol / note.length * 2.2, riv: 0.4, filtro: { f: 500, f2: apri, durFiltro: Math.min(0.25, dur) } });
    }
  }
}

function campana(t, midi, { dur = 0.9, vol = 0.22, pan = 0 } = {}) {
  tono(t, { f: hz(midi), tipo: "triangle", dur, vol, riv: 0.45, pan });
  tono(t, { f: hz(midi + 12), dur: dur * 0.5, vol: vol * 0.35, riv: 0.5, pan });
  tono(t, { f: hz(midi + 19), dur: dur * 0.25, vol: vol * 0.15, riv: 0.5, pan });
}

// ---------- Partiture ----------
// Scala pentatonica: più alto il voto, più alta la nota.
const SCALA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];

const effetti = {
  // Voto di un giudice che compare sul tabellone.
  voto(t, { valore = 7 } = {}) {
    const nota = SCALA[Math.max(0, Math.min(10, Math.round(valore)))] + 12;
    campana(t, nota, { dur: 0.7, vol: 0.4 });
    tono(t, { f: hz(nota + 24), dur: 0.08, vol: 0.09, riv: 0.3 });
    scintille(t + 0.05, 3, 0.2, 0.04);
  },
  // Voto inserito ma ancora nascosto: un "click" di cassaforte.
  bloccato(t) {
    rumore(t, { tipo: "bandpass", f: 2600, q: 5, dur: 0.05, vol: 0.3, riv: 0.05 });
    tono(t + 0.03, { f: 240, f2: 110, dur: 0.14, vol: 0.35, riv: 0.1 });
    rumore(t + 0.09, { tipo: "bandpass", f: 1800, q: 6, dur: 0.04, vol: 0.2, riv: 0.05 });
  },
  // Un voto dalla chat: "pop" leggero che non copre la voce.
  chatVoto(t) {
    const f = [1320, 1480, 1760, 1976][Math.floor(Math.random() * 4)];
    tono(t, { f, f2: f * 0.55, dur: 0.08, vol: 0.08, riv: 0.15, pan: Math.random() * 1.2 - 0.6 });
  },
  chatApre(t) {
    whoosh(t, 0.45, true, 0.25);
    tono(t + 0.3, { f: hz(76), tipo: "square", dur: 0.16, vol: 0.13, riv: 0.35, filtro: { f: 2800 } });
    tono(t + 0.46, { f: hz(83), tipo: "square", dur: 0.5, vol: 0.13, riv: 0.45, filtro: { f: 3200 } });
    campana(t + 0.46, 88, { dur: 0.8, vol: 0.12 });
    scintille(t + 0.5, 6, 0.4);
  },
  chatChiude(t) {
    campana(t, 83, { dur: 0.4, vol: 0.16 });
    campana(t + 0.14, 76, { dur: 1.1, vol: 0.18 });
    tono(t + 0.14, { f: hz(52), dur: 0.9, vol: 0.18, riv: 0.4 });
  },
  nuovaTraccia(t) {
    whoosh(t, 0.7, true, 0.36);
    colpo(t + 0.62, 0.8);
    ottoni(t + 0.62, [48, 55, 60, 64], { dur: 0.6, vol: 0.1, apri: 4200 });
    scintille(t + 0.66, 6, 0.3);
  },
  // Traccia nuova nelle live senza premio: leggero, senza colpo, per non coprire la musica appena partita.
  // La campana arriva a 0,6 s, quando la scheda «Ora in ascolto» atterra sulla barra. Chi paga ha qualcosa in più.
  inAscolto(t, { tier = null } = {}) {
    whoosh(t, 0.55, true, 0.16);
    campana(t + 0.6, 79, { dur: 0.9, vol: 0.13, pan: -0.2 });
    campana(t + 0.7, 84, { dur: 1.2, vol: 0.15, pan: 0.2 });
    scintille(t + 0.62, 5, 0.4, 0.04);
    if (tier === "skip" || tier === "superskip") campana(t + 0.82, tier === "superskip" ? 91 : 88, { dur: 1, vol: 0.1 });
    if (tier === "throne") {
      ottoni(t + 0.6, [60, 64, 67, 72], { dur: 0.9, vol: 0.07, apri: 4200 });
      campana(t + 0.82, 88, { dur: 1.1, vol: 0.11 });
      campana(t + 0.94, 91, { dur: 1.4, vol: 0.1 });
      scintille(t + 0.8, 12, 0.9, 0.05);
    }
  },
  // Calcolo del punteggio: salita di 1,5 s con tic che accelerano, poi il colpo sul risultato.
  calcolo(t) {
    const salita = 1.5;
    rumore(t, { tipo: "highpass", f: 400, f2: 9000, att: salita * 0.95, dur: salita, vol: 0.24, riv: 0.3 });
    tono(t, { f: 110, f2: 880, tipo: "sawtooth", att: salita * 0.9, dur: salita, vol: 0.1, riv: 0.25, filtro: { f: 500, f2: 5000 } });
    let dt = 0.17;
    for (let x = 0; x < salita - 0.05; x += dt, dt = Math.max(0.035, dt * 0.84)) {
      tono(t + x, { f: 1500 + x * 900, tipo: "square", dur: 0.025, vol: 0.05, riv: 0.05, filtro: { f: 4000 } });
    }
    effetti.risultato(t + salita);
  },
  risultato(t) {
    colpo(t, 1);
    piatto(t, 0.8);
    ottoni(t, [48, 55, 60, 64, 67, 72], { dur: 1.3, vol: 0.13, apri: 5200 });
    scintille(t + 0.05, 10, 0.8);
  },
  entrata(t) {
    whoosh(t, 0.35, true, 0.28);
    [72, 76, 79, 84].forEach((n, i) => campana(t + 0.28 + i * 0.085, n, { dur: 0.7, vol: 0.2, pan: -0.3 + i * 0.2 }));
    colpo(t + 0.28, 0.45);
    scintille(t + 0.6, 10, 0.6);
  },
  // Una traccia scala la classifica: una nota in più per ogni posizione guadagnata.
  sale(t, { posti = 1 } = {}) {
    whoosh(t, 0.3, true, 0.24);
    tono(t, { f: 380, f2: 1300, dur: 0.32, vol: 0.12, riv: 0.3 });
    const note = [79, 81, 84, 86, 88];
    for (let i = 0; i < Math.min(note.length, posti + 1); i++) campana(t + 0.22 + i * 0.075, note[i], { dur: 0.5, vol: 0.16 });
    scintille(t + 0.35, 5, 0.4);
  },
  esce(t) {
    tono(t, { f: 320, f2: 65, tipo: "sawtooth", dur: 0.65, vol: 0.18, riv: 0.25, filtro: { f: 1400, f2: 180 } });
    whoosh(t, 0.5, false, 0.16);
  },
  // Nuovo primo posto: fanfara "ta-ta-ta-taaa" con colpo e pioggia di scintille.
  primo(t) {
    for (const x of [0, 0.13, 0.26]) ottoni(t + x, [55, 67], { dur: 0.11, vol: 0.12, apri: 3000, att: 0.01 });
    rullante(t, 0.2);
    rullante(t + 0.13, 0.22);
    rullante(t + 0.26, 0.25);
    colpo(t + 0.4, 1);
    piatto(t + 0.4, 1);
    ottoni(t + 0.4, [48, 55, 60, 64, 67, 72, 76], { dur: 1.6, vol: 0.15, apri: 5600 });
    campana(t + 0.4, 84, { dur: 1.4, vol: 0.14 });
    scintille(t + 0.45, 22, 1.4, 0.08);
  },
  premio(t) {
    campana(t, 83, { dur: 0.25, vol: 0.18 });
    campana(t + 0.09, 88, { dur: 1, vol: 0.22 });
    scintille(t + 0.1, 8, 0.6);
  },
  // Ultimi 30 minuti (e ultimo minuto): sirena breve.
  allarme(t) {
    colpo(t, 0.7);
    [0, 0.28, 0.56, 0.84].forEach((x, i) =>
      tono(t + x, { f: i % 2 ? 660 : 880, tipo: "square", dur: 0.26, att: 0.01, vol: 0.12, riv: 0.3, filtro: { f: 2600 } }),
    );
  },
  // Ultimi 10 secondi: un tic al secondo, più acuto negli ultimi 3.
  tic(t, { ultimi = false } = {}) {
    tono(t, { f: ultimi ? 1500 : 1000, dur: 0.07, vol: ultimi ? 0.42 : 0.3, riv: 0.12 });
    rumore(t, { tipo: "highpass", f: 3000, dur: 0.03, vol: 0.1, riv: 0 });
    if (ultimi) colpo(t, 0.35);
  },
  // Vincitore: rullo di tamburo, colpo, fanfara e pioggia di scintille.
  vincitore(t) {
    const rullo = 2;
    for (let x = 0, i = 0; x < rullo; x += 0.055, i++) rullante(t + x, 0.06 + (x / rullo) * 0.26);
    const f = t + rullo;
    colpo(f, 1.1);
    piatto(f, 1.2);
    ottoni(f, [48, 55, 60, 64, 67, 72, 76], { dur: 2.4, vol: 0.17, apri: 6000 });
    ottoni(f + 0.5, [53, 57, 60, 65, 69, 72], { dur: 0.35, vol: 0.1, apri: 4000 });
    ottoni(f + 0.85, [48, 55, 60, 64, 67, 72, 79], { dur: 2.2, vol: 0.16, apri: 6000 });
    scintille(f, 40, 2.6, 0.08);
  },
  // Spareggio: battito del cuore su un tappeto teso.
  spareggio(t) {
    for (let i = 0; i < 4; i++) {
      tono(t + i * 0.85, { f: 70, f2: 40, dur: 0.2, vol: 0.9, riv: 0.05 });
      tono(t + i * 0.85 + 0.22, { f: 62, f2: 38, dur: 0.22, vol: 0.7, riv: 0.05 });
    }
    for (const n of [33, 40, 46]) tono(t, { f: hz(n), tipo: "sawtooth", att: 1.2, dur: 3.6, vol: 0.06, riv: 0.5, filtro: { f: 300, f2: 1200 } });
  },
};

export const NOMI_SUONI = Object.keys(effetti);

// Il browser fa partire l'audio solo dopo un gesto dell'utente (in OBS e LIVE Studio di solito non serve):
// si prova ad avviarlo subito e di nuovo al primo clic o tasto.
export function sblocca() {
  contesto();
}
for (const evento of ["pointerdown", "keydown"]) globalThis.addEventListener?.(evento, sblocca, { passive: true });

export function audioPronto() {
  return ctx?.state === "running";
}

export function volume(v) {
  volumeAttuale = Math.max(0, Math.min(1, Number(v) || 0));
  if (uscita) uscita.gain.setTargetAtTime(volumeAttuale, ctx.currentTime, 0.05);
}

// Un effetto che fallisce (dati strani da un pulsante Prova) non deve mai fermare il disegno della pagina.
export function suona(nome, dati = {}, ritardoMs = 0) {
  const effetto = Object.hasOwn(effetti, nome) ? effetti[nome] : null;
  if (!effetto || volumeAttuale === 0 || !contesto()) return;
  try {
    effetto(ctx.currentTime + 0.02 + ritardoMs / 1000, dati ?? {});
  } catch (e) {
    console.warn(`Suono «${nome}» non riprodotto:`, e.message);
  }
}
