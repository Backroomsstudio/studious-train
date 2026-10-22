/**
 * De-esser offline (come l'autotune): separa le alte con un passa-basso a un polo e le attenua
 * quando prevalgono sul segnale intero, cioè sulle "s" e sulle "z" che fischiano.
 * `freq` = frequenza di separazione (Hz), `amt` = quantità 0..1.
 */
export function deess(x: Float32Array, sr: number, freq: number, amt: number): Float32Array {
  const out = new Float32Array(x.length);
  const a = Math.exp((-2 * Math.PI * freq) / sr);
  const att = Math.exp(-1 / (sr * 0.0015));
  const rel = Math.exp(-1 / (sr * 0.08));
  const thr = 0.5 - amt * 0.28;
  const pw = 0.6 + amt * 1.6;
  let lp = 0;
  let eh = 0;
  let ef = 0;
  let g = 1;
  for (let n = 0; n < x.length; n++) {
    const v = x[n];
    lp = (1 - a) * v + a * lp;
    const hi = v - lp;
    const ah = Math.abs(hi);
    const af = Math.abs(v);
    eh = ah > eh ? att * eh + (1 - att) * ah : rel * eh + (1 - rel) * ah;
    ef = af > ef ? att * ef + (1 - att) * af : rel * ef + (1 - rel) * af;
    const ratio = ef > 1e-4 ? eh / ef : 0;
    const target = ratio > thr ? Math.max(0.15, Math.pow(thr / ratio, pw)) : 1;
    g = target < g ? att * g + (1 - att) * target : rel * g + (1 - rel) * target;
    out[n] = lp + hi * g;
  }
  return out;
}
