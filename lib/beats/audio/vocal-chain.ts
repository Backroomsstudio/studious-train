/**
 * Catena voce in Web Audio, identica in ascolto (AudioContext) ed export (OfflineAudioContext):
 * EQ (taglio basso, corpo 200 Hz, medi 1,2 kHz, presenza 4 kHz, aria 10 kHz) › compressore con
 * guadagno di compensazione › saturazione tanh in parallelo › volume e panorama, con mandate a
 * riverbero (pre-delay, risposta generata per durata, passa-alto 180 Hz) e delay a tempo col BPM.
 * Il de-esser è offline (vedi deess.ts). Tutti i parametri si aggiornano dal vivo con `update`,
 * tranne il ping-pong che cambia il grafo e richiede di ripartire.
 */
import { DELAY_BEATS, type VoxFx } from "./vocal-presets";

export interface VoxMix {
  vol: number;
  pan: number;
}

export interface LiveChain {
  input: AudioNode;
  /** Riapplica fx, volume e panorama (con una rampa breve se il contesto è dal vivo). */
  update: (fx: VoxFx, mix: VoxMix) => void;
  /** Il grafo è stato costruito per questo ping-pong: se cambia, bisogna ripartire. */
  pingPong: boolean;
}

const irCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/** Risposta all'impulso: rumore con decadimento (1 - t)^3,2 e attacco di 4 ms, in cache per durata. */
export function irFor(ac: BaseAudioContext, size: number): AudioBuffer {
  let m = irCache.get(ac);
  if (!m) {
    m = new Map();
    irCache.set(ac, m);
  }
  const key = size.toFixed(1);
  const hit = m.get(key);
  if (hit) return hit;
  const sr = ac.sampleRate;
  const len = Math.max(1, Math.floor(sr * size));
  const b = ac.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < sr * 0.004 ? i / (sr * 0.004) : 1);
  }
  m.set(key, b);
  return b;
}

function satCurve(drive: number): Float32Array<ArrayBuffer> {
  const k = 1 + drive * 12;
  const c = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = i / 511.5 - 1;
    c[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return c;
}

export function voxChain(ac: BaseAudioContext, fx: VoxFx, mix: VoxMix, dest: AudioNode, bpm: number): LiveChain {
  const live = typeof AudioContext !== "undefined" && ac instanceof AudioContext;
  let instant = false;
  const sm = (p: AudioParam, v: number) => {
    if (live && !instant) p.setTargetAtTime(v, ac.currentTime, 0.02);
    else p.value = v;
  };
  const bq = (type: BiquadFilterType, f: number, q?: number) => {
    const n = ac.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    if (q) n.Q.value = q;
    return n;
  };

  const hp = bq("highpass", 10, 0.7);
  const low = bq("lowshelf", 200);
  const mid = bq("peaking", 1200, 0.9);
  const pres = bq("peaking", 4000, 1);
  const air = bq("highshelf", 10000);
  const comp = ac.createDynamicsCompressor();
  comp.knee.value = 6;
  const makeup = ac.createGain();
  const satIn = ac.createGain();
  const dry = ac.createGain();
  const wet = ac.createGain();
  const ws = ac.createWaveShaper();
  ws.oversample = "4x";
  const satOut = ac.createGain();
  const out = ac.createGain();
  const pan = ac.createStereoPanner();
  const revSend = ac.createGain();
  const pre = ac.createDelay(0.2);
  const conv = ac.createConvolver();
  const revHp = bq("highpass", 180, 0.7);
  const dlySend = ac.createGain();
  const dlyLp = bq("lowpass", 5200, 0.7);
  const dL = ac.createDelay(2);
  const fb1 = ac.createGain();
  let dR: DelayNode | null = null;
  let fb2: GainNode | null = null;

  if (fx.dly.pp) {
    // Ping-pong: sinistra → destra → sinistra, ognuno col suo feedback
    dR = ac.createDelay(2);
    fb2 = ac.createGain();
    const merger = ac.createChannelMerger(2);
    dlySend.connect(dL);
    dL.connect(fb1);
    fb1.connect(dR);
    dR.connect(fb2);
    fb2.connect(dL);
    dL.connect(merger, 0, 0);
    dR.connect(merger, 0, 1);
    merger.connect(dlyLp);
  } else {
    dlySend.connect(dL);
    dL.connect(fb1);
    fb1.connect(dL);
    dL.connect(dlyLp);
  }

  hp.connect(low);
  low.connect(mid);
  mid.connect(pres);
  pres.connect(air);
  air.connect(comp);
  comp.connect(makeup);
  makeup.connect(satIn);
  satIn.connect(dry);
  dry.connect(satOut);
  satIn.connect(ws);
  ws.connect(wet);
  wet.connect(satOut);
  satOut.connect(out);
  out.connect(pan);
  pan.connect(dest);
  out.connect(revSend);
  revSend.connect(pre);
  pre.connect(conv);
  conv.connect(revHp);
  revHp.connect(dest);
  out.connect(dlySend);
  dlyLp.connect(dest);

  let lastDrive = -1;
  let lastSize = -1;
  const beat = 60 / bpm;

  const update = (F: VoxFx, m: VoxMix) => {
    const eqOn = F.eq.on;
    sm(hp.frequency, eqOn ? F.eq.hp : 10);
    sm(low.gain, eqOn ? F.eq.low : 0);
    sm(mid.gain, eqOn ? F.eq.mid : 0);
    sm(pres.gain, eqOn ? F.eq.pres : 0);
    sm(air.gain, eqOn ? F.eq.air : 0);

    const cOn = F.comp.on;
    sm(comp.threshold, cOn ? F.comp.thr : 0);
    sm(comp.ratio, cOn ? F.comp.ratio : 1);
    sm(comp.attack, F.comp.att / 1000);
    sm(comp.release, F.comp.rel / 1000);
    sm(makeup.gain, cOn ? 10 ** (F.comp.makeup / 20) : 1);

    if (F.sat.drive !== lastDrive) {
      ws.curve = satCurve(F.sat.drive);
      lastDrive = F.sat.drive;
    }
    sm(wet.gain, F.sat.on ? F.sat.mix * 0.9 : 0);
    sm(dry.gain, F.sat.on ? 1 - F.sat.mix * 0.6 : 1);

    sm(revSend.gain, F.rev.on ? F.rev.send : 0);
    sm(pre.delayTime, F.rev.pre / 1000);
    if (F.rev.size !== lastSize) {
      conv.buffer = irFor(ac, F.rev.size);
      lastSize = F.rev.size;
    }

    const tm = beat * DELAY_BEATS[F.dly.time];
    sm(dlySend.gain, F.dly.on ? F.dly.send : 0);
    sm(dL.delayTime, tm);
    sm(fb1.gain, F.dly.fb);
    if (dR) sm(dR.delayTime, tm);
    if (fb2) sm(fb2.gain, F.dly.fb);

    sm(out.gain, m.vol);
    sm(pan.pan, m.pan);
  };

  // Valori iniziali di colpo; dopo, le modifiche dal vivo passano dalle rampe.
  instant = true;
  update(fx, mix);
  instant = false;
  return { input: hp, update, pingPong: fx.dly.pp };
}
