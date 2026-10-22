"use client";

import { create } from "zustand";
import { usePlayer, previewUrl } from "@/components/beats/player/player-store";
import { defaultAmount, type TuneMode } from "@/lib/beats/audio/autotune";
import { demoVoice } from "@/lib/beats/audio/demo-voice";
import { LAST_DEMO_KEY, localGet, localPut, type StoredAudio } from "@/lib/beats/audio/local-store";
import { renderMix, type RenderedAudio } from "@/lib/beats/audio/render";
import {
  demoName,
  fromStoredTracks,
  makeTrack,
  projectBeat,
  readmeText,
  takesDuration,
  toStoredTracks,
  TRACK_DEFS,
  voiceStemName,
  withPreset,
  type ProjectBeat,
  type StoredProject,
  type StudioTrack,
  type TakeData,
} from "@/lib/beats/audio/studio-project";
import { PRESET_GENRES, presetGenreOf, ROLE_NAME, BK, type DelayTime, type ModId, type PresetGenre, type VocalRole, type VoxFx } from "@/lib/beats/audio/vocal-presets";
import { encodeWav } from "@/lib/beats/audio/wav";
import { zipStore } from "@/lib/beats/audio/zip";
import { processInBackground } from "./dsp-client";
import { getStudioEngine } from "./studio-engine";

/**
 * Stato dello studio "Registra" (solo client, non persistito: le take vivono in memoria finché
 * l'artista non salva il progetto nell'archivio locale). Le azioni parlano col motore audio.
 */

export type Transport = "idle" | "count" | "rec" | "play";
export type BusyAction = "export" | "share" | "save" | "master" | null;

/** Evento della finestra: l'elenco "Le tue demo" si ricarica quando arriva. */
export const DEMOS_CHANGED = "backrooms:demos-changed";

interface StudioState {
  beat: ProjectBeat | null;
  beatBuffer: AudioBuffer | null;
  beatStatus: "idle" | "loading" | "ready" | "error";
  tracks: StudioTrack[];
  sel: number;
  transport: Transport;
  pos: number;
  metro: boolean;
  countIn: boolean;
  sync: number;
  mic: "idle" | "ready" | "error";
  micError: string | null;
  bkg: PresetGenre | null;
  projectId: string | null;
  busy: BusyAction;
  toast: { id: number; text: string } | null;
  artist: string;
  lastMix: RenderedAudio | null;

  init: (opts: { beat: ProjectBeat; requested: boolean; artist: string; projectId?: string }) => void;
  setBeat: (beat: ProjectBeat) => void;
  play: () => Promise<void>;
  stop: (toStart?: boolean) => void;
  record: () => Promise<void>;
  seek: (pos: number) => void;
  toggleMetro: () => void;
  toggleCountIn: () => void;
  setSync: (ms: number) => void;
  commitSync: () => void;
  select: (i: number) => void;
  toggleMute: (i: number) => void;
  toggleSolo: (i: number) => void;
  setTune: (i: number, mode: TuneMode) => void;
  setMix: (i: number, key: "vol" | "pan", value: number) => void;
  setFx: (i: number, mod: ModId, key: string, value: number) => void;
  toggleMod: (i: number, mod: ModId) => void;
  openMod: (i: number, mod: ModId) => void;
  setDelayTime: (i: number, time: DelayTime) => void;
  togglePingPong: (i: number) => void;
  setPresetGenre: (g: PresetGenre) => void;
  applyPreset: (i: number, genre: PresetGenre, role: VocalRole) => void;
  applyAll: (genre: PresetGenre) => void;
  loadFile: (i: number, file: File) => Promise<void>;
  useDemoVoice: (i: number) => Promise<void>;
  clearTake: (i: number) => void;
  exportZip: () => Promise<void>;
  share: () => Promise<void>;
  saveProject: () => Promise<void>;
  openProject: (id: string) => Promise<void>;
  prepareMaster: () => Promise<boolean>;
  notify: (text: string) => void;
  dispose: () => void;
}

const engine = () => getStudioEngine();
let mic: MediaStream | null = null;
let beatToken = 0;
const jobs = new Map<string, number>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Messaggi chiari per i problemi col microfono. */
function micMessage(name: string | undefined): string {
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Non abbiamo il permesso di usare il microfono. Puoi darlo dal lucchetto vicino all'indirizzo, oppure caricare una voce o usare la voce demo.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Non troviamo nessun microfono collegato. Collega le cuffie con microfono, oppure carica una voce già registrata.";
    case "NotReadableError":
    case "TrackStartError":
      return "Il microfono è occupato da un'altra app (chiamata, altro browser?). Chiudila e riprova.";
    case "NotSupportedError":
    case "SecurityError":
      return "Questo browser non ci lascia registrare qui. Prova con Chrome o Safari aggiornati, oppure carica una voce.";
    default:
      return "Il microfono non risponde. Riprova, oppure carica una voce o usa la voce demo.";
  }
}

function download(data: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Mono, alla frequenza dell'export: qualsiasi file audio che il browser sa leggere. */
async function decodeVoice(file: File, maxSeconds: number): Promise<TakeData> {
  const sr = 44_100;
  const buf = await new OfflineAudioContext(1, 1, sr).decodeAudioData(await file.arrayBuffer());
  const len = Math.min(buf.length, Math.floor(buf.sampleRate * maxSeconds));
  const data = new Float32Array(len);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const x = buf.getChannelData(c);
    for (let i = 0; i < len; i++) data[i] += x[i] / buf.numberOfChannels;
  }
  return { data, sr: buf.sampleRate, start: 0 };
}

export const useStudio = create<StudioState>()((set, get) => {
  const seconds = () => get().beatBuffer?.duration ?? get().beat?.durationSec ?? 32;
  const bpm = () => get().beat?.bpm ?? 120;

  const patch = (i: number, fn: (t: StudioTrack) => Partial<StudioTrack>) =>
    set((s) => ({ tracks: s.tracks.map((t, k) => (k === i ? { ...t, ...fn(t) } : t)), lastMix: null }));

  const patchById = (id: string, value: Partial<StudioTrack>) =>
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...value } : t)), lastMix: null }));

  const restartIfPlaying = () => {
    if (get().transport === "play") void startPlayback(engine().position());
  };

  const startPlayback = async (from: number) => {
    const s = get();
    if (!s.beatBuffer || !s.beat) return;
    usePlayer.getState().pause();
    await engine().start({
      from,
      seconds: seconds(),
      bpm: bpm(),
      beat: s.beatBuffer,
      tracks: s.tracks,
      volume: 0.9,
      onEnd: () => get().stop(true),
    });
    set({ transport: "play" });
  };

  /** Aggiorna la catena dal vivo; se il grafo non basta (ping-pong) riparte dal punto corrente. */
  const live = (i: number) => {
    const t = get().tracks[i];
    if (get().transport !== "play" || !t) return;
    if (!engine().updateLive(t.id, t.fx, { vol: t.vol, pan: t.pan })) restartIfPlaying();
  };

  /** Autotune + de-esser fuori dal thread della pagina, l'ultima richiesta vince. */
  const reprocess = (i: number, delay = 0, showBusy = true) => {
    const t = get().tracks[i];
    if (!t?.take || !get().beat) return;
    const needs = t.tune !== "off" || (t.fx.deess.on && t.fx.deess.amt > 0);
    const token = (jobs.get(t.id) ?? 0) + 1;
    jobs.set(t.id, token);
    clearTimeout(timers.get(t.id));
    if (!needs) {
      patchById(t.id, { tuned: null, proc: null, curve: null, busy: false });
      restartIfPlaying();
      return;
    }
    if (showBusy) patchById(t.id, { busy: true });
    timers.set(
      t.id,
      setTimeout(async () => {
        const cur = get().tracks.find((x) => x.id === t.id);
        const key = get().beat?.key;
        if (!cur?.take || !key) return;
        try {
          const out = await processInBackground({
            data: cur.take.data,
            sr: cur.take.sr,
            key,
            tune: cur.tune,
            amount: cur.amount,
            deess: { ...cur.fx.deess },
          });
          if (jobs.get(t.id) !== token) return;
          patchById(t.id, { tuned: out.tuned, proc: out.proc, curve: out.curve, busy: false });
          restartIfPlaying();
        } catch {
          if (jobs.get(t.id) === token) patchById(t.id, { busy: false });
        }
      }, delay),
    );
  };

  const reprocessAll = () => get().tracks.forEach((t, i) => t.take && reprocess(i));

  const loadBeatAudio = async (beat: ProjectBeat) => {
    const token = ++beatToken;
    set({ beatStatus: "loading", beatBuffer: null });
    try {
      const res = await fetch(previewUrl(beat.id));
      if (!res.ok) throw new Error(String(res.status));
      // Contesto offline: niente AudioContext prima di un gesto dell'utente
      const buffer = await new OfflineAudioContext(2, 1, 44_100).decodeAudioData(await res.arrayBuffer());
      if (token === beatToken) set({ beatBuffer: buffer, beatStatus: "ready" });
    } catch {
      if (token === beatToken) set({ beatStatus: "error" });
    }
  };

  const setTake = (i: number, take: TakeData, message: string) => {
    patch(i, () => ({ take, tuned: null, proc: null, curve: null, busy: false }));
    get().notify(message);
    reprocess(i);
  };

  const whenProcessed = async () => {
    for (let k = 0; k < 300 && get().tracks.some((t) => t.busy); k++) await new Promise((r) => setTimeout(r, 100));
  };

  const render = (withBeat: boolean) => {
    const s = get();
    return renderMix({ beat: s.beatBuffer, tracks: s.tracks, bpm: bpm(), seconds: seconds(), withBeat });
  };

  const nameOf = () => demoName(get().artist, get().beat?.title ?? "Beat");

  const currentMix = async () => {
    await whenProcessed();
    const mix = get().lastMix ?? (await render(true));
    set({ lastMix: mix });
    return mix;
  };

  /** Lascia l'ultimo render al Master A/B (/beats/master?sorgente=demo). */
  const storeLastDemo = (mix: RenderedAudio) =>
    localPut<StoredAudio>("renders", LAST_DEMO_KEY, {
      name: nameOf(),
      sampleRate: mix.sampleRate,
      channels: mix.channels,
      createdAt: new Date().toISOString(),
    });

  const hasTakes = () => get().tracks.some((t) => t.take);

  return {
    beat: null,
    beatBuffer: null,
    beatStatus: "idle",
    tracks: TRACK_DEFS.map((d) => makeTrack(d, "trap")),
    sel: 0,
    transport: "idle",
    pos: 0,
    metro: true,
    countIn: true,
    sync: 0,
    mic: "idle",
    micError: null,
    bkg: null,
    projectId: null,
    busy: null,
    toast: null,
    artist: "Artista",
    lastMix: null,

    init({ beat, requested, artist, projectId }) {
      set({ artist });
      if (projectId && projectId !== get().projectId) {
        if (!get().beat) set({ beat, tracks: TRACK_DEFS.map((d) => makeTrack(d, presetGenreOf(beat.genres))) });
        void get().openProject(projectId);
        return;
      }
      const current = get().beat;
      if (!current) {
        set({ beat, tracks: TRACK_DEFS.map((d) => makeTrack(d, presetGenreOf(beat.genres))) });
        void loadBeatAudio(beat);
      } else if (requested && current.id !== beat.id) {
        get().setBeat(beat);
      } else if (!get().beatBuffer && get().beatStatus !== "loading") {
        void loadBeatAudio(current);
      }
    },

    setBeat(beat) {
      if (get().transport !== "idle") get().stop();
      const g = presetGenreOf(beat.genres);
      set((s) => ({
        beat,
        pos: 0,
        bkg: null,
        lastMix: null,
        tracks: s.tracks.map((t) => (t.auto && t.autoGenre !== g ? withPreset(t, g, t.role, true) : t)),
      }));
      engine().setPosition(0);
      void loadBeatAudio(beat);
      // La tonalità cambia: le take vanno riaccordate
      reprocessAll();
    },

    async play() {
      const s = get();
      if (s.transport === "play") return get().stop();
      if (s.transport !== "idle") return;
      await startPlayback(s.pos);
    },

    stop(toStart = false) {
      const s = get();
      const wasRecording = s.transport === "rec" || s.transport === "count";
      const take = engine().stop(s.sync);
      const pos = toStart ? 0 : wasRecording ? engine().recordedFrom : engine().position();
      engine().setPosition(pos);
      set({ transport: "idle", pos });
      if (take) setTake(s.sel, take, `Take registrata su "${s.tracks[s.sel].name}"`);
    },

    async record() {
      const s = get();
      if (s.transport === "rec" || s.transport === "count") return get().stop();
      if (!s.beatBuffer) return;
      const t = s.tracks[s.sel];
      if (t.take && !window.confirm(`Registrare di nuovo "${t.name}"? La take attuale viene sostituita.`)) return;
      try {
        mic ??= await engine().getMic();
        set({ mic: "ready", micError: null });
      } catch (error) {
        set({ mic: "error", micError: micMessage((error as { name?: string })?.name) });
        return;
      }
      const from = s.transport === "play" ? engine().position() : s.pos;
      usePlayer.getState().pause();
      await engine().start({
        from,
        seconds: seconds(),
        bpm: bpm(),
        beat: s.beatBuffer,
        tracks: get().tracks,
        volume: 0.9,
        record: { index: s.sel, countIn: s.countIn, metro: s.metro, mic },
        onEnd: () => get().stop(true),
      });
      const left = engine().countLeft();
      set({ transport: s.countIn && left > 0 ? "count" : "rec", pos: from });
      if (s.countIn && left > 0)
        setTimeout(() => {
          if (get().transport === "count") set({ transport: "rec" });
        }, left * 1000);
    },

    seek(pos) {
      const s = get();
      if (s.transport === "rec" || s.transport === "count") return;
      const p = Math.max(0, Math.min(seconds() - 0.1, pos));
      set({ pos: p });
      engine().setPosition(p);
      if (s.transport === "play") void startPlayback(p);
    },

    toggleMetro: () => set((s) => ({ metro: !s.metro })),
    toggleCountIn: () => set((s) => ({ countIn: !s.countIn })),
    setSync: (ms) => set({ sync: ms }),

    /** Sposta la take della traccia attiva della differenza rispetto all'offset con cui è stata registrata. */
    commitSync() {
      const s = get();
      const t = s.tracks[s.sel];
      if (!t?.take) return;
      const take = t.take;
      const delta = (s.sync - (take.sync ?? 0)) / 1000;
      if (!delta) return;
      patch(s.sel, () => ({ take: { ...take, start: Math.max(0, take.start - delta), sync: s.sync } }));
      restartIfPlaying();
    },

    select(i) {
      if (get().transport === "rec" || get().transport === "count") return;
      set({ sel: i });
    },

    toggleMute(i) {
      patch(i, (t) => ({ mute: !t.mute }));
      restartIfPlaying();
    },

    toggleSolo(i) {
      set((s) => ({ tracks: s.tracks.map((t, k) => ({ ...t, solo: k === i ? !t.solo : false })), lastMix: null }));
      restartIfPlaying();
    },

    setTune(i, mode) {
      patch(i, () => ({ tune: mode, amount: defaultAmount(mode), chain: null, auto: false }));
      if (get().tracks[i].take) reprocess(i);
    },

    setMix(i, key, value) {
      patch(i, () => ({ [key]: value }));
      live(i);
    },

    setFx(i, mod, key, value) {
      patch(i, (t) => ({ fx: { ...t.fx, [mod]: { ...t.fx[mod], [key]: value } } as VoxFx, chain: null, auto: false }));
      if (mod === "deess") reprocess(i, 200, false);
      else live(i);
    },

    toggleMod(i, mod) {
      patch(i, (t) => ({ fx: { ...t.fx, [mod]: { ...t.fx[mod], on: !t.fx[mod].on } } as VoxFx, chain: null, auto: false }));
      if (mod === "deess") reprocess(i, 0, false);
      else live(i);
    },

    openMod: (i, mod) => set((s) => ({ tracks: s.tracks.map((t, k) => (k === i ? { ...t, open: mod } : t)) })),

    setDelayTime(i, time) {
      patch(i, (t) => ({ fx: { ...t.fx, dly: { ...t.fx.dly, time } }, chain: null, auto: false }));
      live(i);
    },

    togglePingPong(i) {
      patch(i, (t) => ({ fx: { ...t.fx, dly: { ...t.fx.dly, pp: !t.fx.dly.pp } }, chain: null, auto: false }));
      live(i);
    },

    setPresetGenre: (g) => set({ bkg: g }),

    applyPreset(i, genre, role) {
      patch(i, (t) => withPreset(t, genre, role, false));
      const c = BK[genre][role];
      get().notify(`${c.name} by ${c.by} su ${get().tracks[i].name}`);
      if (get().tracks[i].take) reprocess(i);
      else live(i);
    },

    applyAll(genre) {
      set((s) => ({ tracks: s.tracks.map((t) => withPreset(t, genre, t.role, false)), lastMix: null }));
      reprocessAll();
      const name = PRESET_GENRES.find((g) => g.slug === genre)?.name ?? genre;
      get().notify(`Catene Backrooms ${name} su ${Object.values(ROLE_NAME).join(", ").replace(/, ([^,]*)$/, " e $1")}`);
    },

    async loadFile(i, file) {
      set({ sel: i });
      try {
        const take = await decodeVoice(file, seconds());
        setTake(i, take, `Voce caricata su "${get().tracks[i].name}"`);
      } catch {
        get().notify("Non riesco a leggere questo file audio: prova con un WAV, MP3 o M4A.");
      }
    },

    async useDemoVoice(i) {
      const b = get().beat;
      if (!b) return;
      set({ sel: i });
      patch(i, () => ({ busy: true }));
      try {
        const v = await demoVoice(b.key, b.bpm, seconds());
        setTake(i, { data: v.data, sr: v.sr, start: (60 / b.bpm) * 4 }, "Voce demo caricata: senti la differenza con e senza autotune");
      } catch {
        patch(i, () => ({ busy: false }));
        get().notify("Non riesco a creare la voce demo su questo browser.");
      }
    },

    clearTake(i) {
      const t = get().tracks[i];
      if (!t.take || !window.confirm(`Cancellare la take di "${t.name}"?`)) return;
      jobs.set(t.id, (jobs.get(t.id) ?? 0) + 1);
      patch(i, () => ({ take: null, tuned: null, proc: null, curve: null, busy: false }));
      restartIfPlaying();
    },

    async exportZip() {
      const s = get();
      if (!hasTakes() || !s.beat) return get().notify("Registra o carica una voce prima di esportare");
      set({ busy: "export" });
      try {
        await whenProcessed();
        const [mix, vox] = await Promise.all([get().lastMix ?? render(true), render(false)]);
        set({ lastMix: mix });
        await storeLastDemo(mix);
        const beat = get().beat!;
        const name = nameOf();
        const zip = zipStore([
          { name: `${name}.wav`, data: encodeWav(mix) },
          { name: `${voiceStemName(beat.title)}.wav`, data: encodeWav(vox) },
          { name: "LEGGIMI.txt", data: new TextEncoder().encode(readmeText({ artist: get().artist, beat })) },
        ]);
        download(zip, `${name}.zip`, "application/zip");
        get().notify("ZIP pronto: lo trovi nei download");
      } catch {
        get().notify("Esportazione non riuscita: riprova tra un attimo.");
      } finally {
        set({ busy: null });
      }
    },

    async share() {
      if (!hasTakes()) return get().notify("Registra o carica una voce prima di condividere");
      set({ busy: "share" });
      try {
        const mix = await currentMix();
        await storeLastDemo(mix);
        const wav = encodeWav(mix);
        const name = nameOf();
        const file = new File([wav as Uint8Array<ArrayBuffer>], `${name}.wav`, { type: "audio/wav" });
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: name, text: "Ascolta la mia demo, registrata al Backrooms" });
          } catch {
            /* condivisione annullata */
          }
        } else {
          download(wav, `${name}.wav`, "audio/wav");
          get().notify("Condivisione diretta non disponibile qui: ti abbiamo scaricato il WAV");
        }
      } finally {
        set({ busy: null });
      }
    },

    async saveProject() {
      const s = get();
      if (!hasTakes() || !s.beat) return get().notify("Niente da salvare: registra prima una take");
      set({ busy: "save" });
      try {
        const id = s.projectId ?? `p${Date.now()}`;
        const now = new Date();
        const previous = s.projectId ? await localGet<StoredProject>("projects", id) : undefined;
        const project: StoredProject = {
          id,
          name: `${s.beat.title} · ${now.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`,
          beat: projectBeat(s.beat),
          createdAt: previous?.createdAt ?? now.toISOString(),
          updatedAt: now.toISOString(),
          durationSec: takesDuration(s.tracks),
          sync: s.sync,
          tracks: toStoredTracks(s.tracks),
        };
        await localPut("projects", id, project);
        set({ projectId: id });
        await storeLastDemo(await currentMix());
        window.dispatchEvent(new Event(DEMOS_CHANGED));
        get().notify(previous ? "Progetto aggiornato" : "Demo salvata nelle tue demo, su questo dispositivo");
      } catch {
        get().notify("Non riesco a salvare qui: lo spazio del browser potrebbe essere pieno.");
      } finally {
        set({ busy: null });
      }
    },

    async openProject(id) {
      const p = await localGet<StoredProject>("projects", id);
      if (!p) {
        get().notify("Questa demo non è più su questo dispositivo");
        if (!get().beatBuffer && get().beat) void loadBeatAudio(get().beat!);
        return;
      }
      if (get().transport !== "idle") get().stop();
      const sameBeat = get().beat?.id === p.beat.id && get().beatBuffer;
      set({
        beat: p.beat,
        tracks: fromStoredTracks(p.tracks, presetGenreOf(p.beat.genres)),
        sync: p.sync ?? 0,
        projectId: id,
        pos: 0,
        sel: 0,
        bkg: null,
        lastMix: null,
      });
      engine().setPosition(0);
      if (!sameBeat) void loadBeatAudio(p.beat);
      reprocessAll();
      get().notify(`Hai riaperto "${p.name}"`);
    },

    async prepareMaster() {
      if (!hasTakes()) {
        get().notify("Prima registra o carica una voce");
        return false;
      }
      set({ busy: "master" });
      try {
        await storeLastDemo(await currentMix());
        return true;
      } catch {
        get().notify("Non riesco a preparare la demo per il master.");
        return false;
      } finally {
        set({ busy: null });
      }
    },

    notify: (text) => set({ toast: { id: Date.now(), text } }),

    dispose() {
      if (get().transport !== "idle") get().stop();
      mic?.getTracks().forEach((t) => t.stop());
      mic = null;
      set({ mic: "idle" });
    },
  };
});
