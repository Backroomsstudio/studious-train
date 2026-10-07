// Regia: ascolto dell'audio di FL Studio per l'equalizzatore del Drum. Sorgente: un ingresso audio (cavo virtuale, scheda, mix
// stereo) oppure l'«Audio del PC» (condivisione dello schermo con l'audio di sistema). L'audio non va in nessuna uscita: si
// guarda solo lo spettro. Ogni ~33 ms (scandito da un Web Worker: una scheda in secondo piano non rallenta) escono 12 bande
// logaritmiche 40 Hz–14 kHz (0…100, con la sensibilità scelta) e il «colpo» (0…100, 0 = nessun colpo) per la pagina del Drum.
// Le funzioni pure stanno in cima (si provano in Node: test/regia-audio.test.mjs); le altre servono il browser.

export const BANDE = 12;
const F_MIN = 40;
const F_MAX = 14000;
const FFT = 1024;
const PASSO_MS = 33;

// I dodici intervalli di bin [da, a) delle bande logaritmiche tra 40 Hz e 14 kHz: contigui, crescenti, ognuno con almeno un bin
// (nei bassi un bin è più largo di una banda: lì le bande sono di un bin). Si parte dal bin 1 (il bin 0 è la componente continua)
// e si finisce al bin dei 14 kHz.
export function limitiBande(frequenzaCampionamento, fftSize) {
  const hzPerBin = frequenzaCampionamento / fftSize;
  const fine = Math.min(fftSize / 2, Math.round(F_MAX / hzPerBin));
  const rapporto = (F_MAX / F_MIN) ** (1 / BANDE);
  const bordi = [1];
  for (let k = 1; k < BANDE; k++) {
    const ideale = Math.round((F_MIN * rapporto ** k) / hzPerBin);
    bordi.push(Math.min(fine - (BANDE - k), Math.max(bordi[k - 1] + 1, ideale)));
  }
  bordi.push(fine);
  return Array.from({ length: BANDE }, (_, i) => [bordi[i], bordi[i + 1]]);
}

// `dati`: i byte 0…255 di getByteFrequencyData. Ogni banda è la media dei suoi bin in scala 0…100, per la sensibilità (100 = 1).
export function bandeDaSpettro(dati, limiti, sensibilita) {
  return limiti.map(([da, a]) => {
    let somma = 0;
    for (let bin = da; bin < a; bin++) somma += dati[bin] ?? 0;
    return Math.min(100, Math.round((somma / (a - da) / 255) * 100 * (sensibilita / 100)));
  });
}

// Il colpo di batteria: un aumento improvviso di energia nelle bande basse e medie (0–6, fino a ~1,2 kHz) contro una media mobile
// di quanto è successo finora. passo(bande, ora) dà 0 (nessun colpo) oppure 50…100 (più forte il colpo, più alto il valore);
// tra due colpi passano almeno 90 ms. Il primo passo non ha un prima con cui confrontarsi: non è mai un colpo.
export function creaRilevatoreColpi() {
  let precedenti = null;
  let media = 0;
  let ultimoColpo = -Infinity;
  return {
    passo(bande, ora) {
      let flusso = 0;
      if (precedenti) for (let i = 0; i <= 6; i++) flusso += Math.max(0, bande[i] - precedenti[i]);
      precedenti = bande.slice();
      const soglia = Math.max(30, 2.2 * media);
      media += 0.08 * (flusso - media);
      if (flusso > soglia && ora - ultimoColpo > 90) {
        ultimoColpo = ora;
        return Math.min(100, Math.max(50, Math.round(((flusso - soglia) / soglia) * 100 + 50)));
      }
      return 0;
    },
  };
}

// ---------- Browser ----------

// Gli ingressi audio del PC (le etichette arrivano solo dopo il permesso del microfono).
export async function elencaIngressi() {
  const dispositivi = await navigator.mediaDevices.enumerateDevices();
  return dispositivi.filter((d) => d.kind === "audioinput").map((d, i) => ({ id: d.deviceId, nome: d.label || `Ingresso audio ${i + 1}` }));
}

async function apriFlusso(sorgente, deviceId) {
  if (sorgente === "sistema") {
    // la condivisione dello schermo porta anche il video: si scarta, serve solo l'audio di sistema
    const flusso = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    for (const video of flusso.getVideoTracks()) {
      video.stop();
      flusso.removeTrack(video);
    }
    if (!flusso.getAudioTracks().length) {
      for (const traccia of flusso.getTracks()) traccia.stop();
      throw new Error("Scegli “Intero schermo” e spunta “Condividi audio di sistema”");
    }
    return flusso;
  }
  // senza filtri: sono fatti per la voce e storpierebbero la musica (e il colpo)
  return navigator.mediaDevices.getUserMedia({
    audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
}

// Un orologio che non rallenta nelle schede in secondo piano: un Web Worker (da un Blob) manda un tick ogni `ms`; senza worker, setInterval.
function creaOrologio(tick, ms) {
  try {
    const indirizzo = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms});`], { type: "text/javascript" }));
    const worker = new Worker(indirizzo);
    worker.onmessage = () => tick();
    return {
      ferma() {
        worker.terminate();
        URL.revokeObjectURL(indirizzo);
      },
    };
  } catch {
    const id = setInterval(tick, ms);
    return { ferma: () => clearInterval(id) };
  }
}

// sorgente: "ingresso" (con deviceId, se si sceglie un dispositivo) o "sistema". sensibilita: un numero o una funzione che dà quello
// di ora (50…300, 100 = normale: così il cursore della regia vale subito). suFrame(b, c): le 12 bande e il colpo, ogni ~33 ms.
// suFine(): il flusso è finito da solo (ingresso staccato, condivisione chiusa dal browser).
// Dà { ferma(), livello() }: livello() è la banda più alta dell'ultimo istante (0…100), per l'indicatore. Un errore (permesso
// negato, nessun audio condiviso) arriva come eccezione con un messaggio in italiano quando c'è.
export async function avviaAscolto({ sorgente = "ingresso", deviceId, sensibilita = 100, suFrame, suFine = () => {} }) {
  const flusso = await apriFlusso(sorgente, deviceId);
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  const ctx = new AC();
  await ctx.resume().catch(() => {});
  const analizzatore = ctx.createAnalyser();
  analizzatore.fftSize = FFT;
  analizzatore.minDecibels = -85;
  analizzatore.maxDecibels = -20;
  analizzatore.smoothingTimeConstant = 0;
  ctx.createMediaStreamSource(flusso).connect(analizzatore); // non va a ctx.destination: niente eco
  const limiti = limitiBande(ctx.sampleRate, FFT);
  const spettro = new Uint8Array(analizzatore.frequencyBinCount);
  const rilevatore = creaRilevatoreColpi();
  let livello = 0;
  let fermato = false;

  const orologio = creaOrologio(() => {
    analizzatore.getByteFrequencyData(spettro);
    const bande = bandeDaSpettro(spettro, limiti, typeof sensibilita === "function" ? sensibilita() : sensibilita);
    livello = Math.max(...bande);
    suFrame(bande, rilevatore.passo(bande, performance.now()));
  }, PASSO_MS);

  function ferma() {
    if (fermato) return;
    fermato = true;
    orologio.ferma();
    for (const traccia of flusso.getTracks()) traccia.stop();
    ctx.close().catch(() => {});
  }
  for (const traccia of flusso.getAudioTracks()) {
    traccia.addEventListener("ended", () => {
      if (fermato) return;
      ferma();
      suFine();
    });
  }
  return { ferma, livello: () => livello };
}
