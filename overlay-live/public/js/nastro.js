// Nastro che scorre (barra dei social), come nel layout senza premio: i pezzi usciti a sinistra si tolgono,
// quelli nuovi si aggiungono a destra, e il contenuto cambia solo fuori dalla vista (quello che si legge non salta mai).
const BORDO_VISIBILE = 980; // oltre questa x il pezzo non si vede ancora sui telefoni
const RIEMPI_FINO = 1500;

// creaPezzo(voce) → elemento; inizio() → x del primo pezzo; velocita() → pixel al secondo (0 = fermo).
export function creaNastro({ nastro, creaPezzo, inizio, velocita, statico = false }) {
  let x = 0;
  let pezzi = []; // { el, largo, chiave, tipo }
  let scaletta = [];
  let firmaScaletta = null;
  let prossimo = 0;

  function prossimaVoce() {
    if (!scaletta.length) return null;
    const voce = scaletta[prossimo % scaletta.length];
    prossimo = (prossimo + 1) % scaletta.length;
    return voce;
  }

  function riempi() {
    let totale = pezzi.reduce((somma, p) => somma + p.largo, 0);
    for (let i = 0; i < 40 && x + totale < RIEMPI_FINO; i++) {
      const voce = prossimaVoce();
      if (!voce) return;
      const el = creaPezzo(voce);
      nastro.append(el);
      const p = { el, largo: el.offsetWidth, chiave: voce.chiave, tipo: voce.tipo };
      pezzi.push(p);
      totale += p.largo;
      if (!p.largo) return; // barra non disegnata (nascosta con ?w=): niente giri a vuoto
    }
  }

  function posiziona() {
    nastro.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
  }

  function ripartiDaCapo() {
    for (const p of pezzi) p.el.remove();
    pezzi = [];
    prossimo = 0;
    x = inizio();
    riempi();
    posiziona();
  }

  function aggiorna(voci) {
    const firma = voci.map((v) => v.chiave).join("\n");
    if (firma === firmaScaletta) return;
    const primaVolta = firmaScaletta === null;
    firmaScaletta = firma;
    scaletta = voci;
    if (primaVolta || statico) return ripartiDaCapo();

    // I pezzi non ancora in vista si rifanno con il contenuto nuovo; quelli che qualcuno sta leggendo finiscono il passaggio.
    let sinistra = x;
    let tenuti = 0;
    for (const p of pezzi) {
      if (sinistra >= BORDO_VISIBILE) break;
      sinistra += p.largo;
      tenuti++;
    }
    for (const p of pezzi.splice(tenuti)) p.el.remove();
    if (!pezzi.length) x = BORDO_VISIBILE; // barra rimasta vuota: le voci nuove entrano da destra
    const ultimo = pezzi[pezzi.length - 1];
    let i = ultimo ? scaletta.findIndex((v) => v.chiave === ultimo.chiave) : -1;
    if (i < 0 && ultimo) i = scaletta.findIndex((v) => v.tipo === ultimo.tipo && v.tipo !== "social");
    prossimo = i >= 0 ? i + 1 : 0;
    riempi();
  }

  let ultimoFotogramma = performance.now();
  function passo(t) {
    const dt = Math.min(0.1, Math.max(0, (t - ultimoFotogramma) / 1000)); // sorgente rimasta nascosta: nessun salto
    ultimoFotogramma = t;
    if (pezzi.length) {
      x -= velocita() * dt;
      while (pezzi.length && x + pezzi[0].largo < 0) {
        const p = pezzi.shift();
        x += p.largo;
        p.el.remove();
      }
      riempi();
      posiziona();
    }
    requestAnimationFrame(passo);
  }
  if (!statico) requestAnimationFrame(passo);

  return {
    aggiorna,
    // Con i font caricati le larghezze cambiano: si rimisurano i pezzi.
    rimisura() {
      for (const p of pezzi) p.largo = p.el.offsetWidth;
      if (statico && firmaScaletta !== null) ripartiDaCapo();
    },
  };
}
