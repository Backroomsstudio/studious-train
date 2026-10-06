// Rende gli effetti sonori dell'overlay fuori dal tempo reale (OfflineAudioContext) per:
//  - misurare picco, RMS e durata di ogni effetto (nessuno muto, nessuno che distorce: picco < 1);
//  - creare un WAV con una sequenza di effetti da far ascoltare allo studio (poi: ffmpeg -i x.wav -b:a 192k x.mp3).
// node suoni.mjs <url-overlay> livelli
// node suoni.mjs <url-overlay> wav <out.wav> '[["nuovaTraccia",{},0],["voto",{"valore":8},2.2]]' [secondi=40]
// L'URL è la pagina dell'overlay servita dal server (es. http://127.0.0.1:4747/overlay?muto=1): serve per importare /js/suoni.js.
import { writeFileSync } from "node:fs";
import { apriBrowser } from "./_browser.mjs";

const [url, modo, out, sequenzaJson, secondi = 40] = process.argv.slice(2);
const browser = await apriBrowser();
const pagina = await browser.newPage();
pagina.on("pageerror", (e) => console.log("ERRORE:", e.message));
await pagina.goto(url);

if (modo === "livelli") {
  const ris = await pagina.evaluate(async () => {
    let ultimo = null;
    window.AudioContext = class extends OfflineAudioContext {
      constructor() {
        super(2, 44100 * 7, 44100);
        ultimo = this;
      }
    };
    const { NOMI_SUONI } = await import("/js/suoni.js?elenco");
    const out = {};
    let i = 0;
    for (const nome of NOMI_SUONI) {
      const m = await import(`/js/suoni.js?n=${i++}`); // modulo nuovo = contesto audio nuovo
      m.volume(0.8);
      m.suona(nome, {});
      const d = (await ultimo.startRendering()).getChannelData(0);
      let picco = 0, somma = 0, fine = 0;
      for (let k = 0; k < d.length; k++) {
        const a = Math.abs(d[k]);
        if (a > picco) picco = a;
        somma += a * a;
        if (a > 0.003) fine = k;
      }
      out[nome] = { picco: +picco.toFixed(3), rms: +Math.sqrt(somma / d.length).toFixed(4), durata: +(fine / 44100).toFixed(2) };
    }
    return out;
  });
  console.table(ris);
  const problemi = Object.entries(ris).filter(([, v]) => v.picco >= 1 || v.picco < 0.02);
  if (problemi.length) console.log("⚠ da sistemare (muti o distorti):", problemi.map(([n]) => n).join(", "));
} else if (modo === "wav") {
  const sequenza = JSON.parse(sequenzaJson);
  const dati = await pagina.evaluate(
    async ({ sequenza, secondi }) => {
      let ctx = null;
      window.AudioContext = class extends OfflineAudioContext {
        constructor() {
          super(2, 44100 * secondi, 44100);
          ctx = this;
        }
      };
      const m = await import("/js/suoni.js?wav");
      m.volume(0.9);
      for (const [nome, d, t] of sequenza) m.suona(nome, d, t * 1000);
      const buf = await ctx.startRendering();
      const [l, r] = [buf.getChannelData(0), buf.getChannelData(1)];
      const pcm = new Int16Array(l.length * 2);
      for (let i = 0; i < l.length; i++) {
        pcm[2 * i] = Math.max(-1, Math.min(1, l[i])) * 32767;
        pcm[2 * i + 1] = Math.max(-1, Math.min(1, r[i])) * 32767;
      }
      return Array.from(new Uint8Array(pcm.buffer));
    },
    { sequenza, secondi: +secondi },
  );
  const pcm = Buffer.from(dati);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(44100, 24);
  h.writeUInt32LE(44100 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  writeFileSync(out, Buffer.concat([h, pcm]));
  console.log("salvato", out);
} else {
  console.error("Modo: livelli | wav");
}
await browser.close();
