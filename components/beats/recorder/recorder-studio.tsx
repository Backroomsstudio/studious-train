"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/beats/player/player-store";
import { projectBeat } from "@/lib/beats/audio/studio-project";
import type { BeatSummary } from "@/lib/beats/types";
import { BeatPicker } from "./beat-picker";
import { ExportPanel } from "./export-panel";
import { MyDemos } from "./my-demos";
import { PresetBar } from "./preset-bar";
import { StudioStage } from "./studio-stage";
import { useStudio } from "./studio-store";
import { TrackCard } from "./track-card";
import { scaleLabel } from "@/lib/beats/audio/pitch";
import { scrollToTop } from "./scroll";

/** Scheletro cromato mentre lo studio si prepara (primo frame, prima che il beat sia nello store). */
function StudioSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carico lo studio…">
      <div className="obsidian grid gap-3 rounded-[28px] p-5">
        <span className="studio-skel h-11 w-2/3 rounded-xl" />
        <span className="studio-skel h-[46px] rounded-xl" />
        <span className="studio-skel h-10 rounded-xl" />
        <span className="studio-skel h-10 rounded-xl" />
        <span className="studio-skel h-10 rounded-xl" />
        <span className="studio-skel mx-auto h-[76px] w-[76px] rounded-full" />
      </div>
      <div className="glass grid gap-3 rounded-[28px] p-5">
        <span className="studio-skel studio-skel-light h-6 w-1/3 rounded-lg" />
        <span className="studio-skel studio-skel-light h-28 rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Studio "Registra" in stile BandLab: registra sul beat, autotune nella scala giusta, catena voce
 * completa con i preset Backrooms, export ZIP e progetti salvati sul dispositivo.
 */
export function RecorderStudio({
  initialBeat,
  requested,
  catalog,
  ownedIds,
  artist,
  projectId,
}: {
  initialBeat: BeatSummary;
  requested: boolean;
  catalog: BeatSummary[];
  ownedIds: string[];
  artist: string;
  projectId?: string;
}) {
  const beat = useStudio((s) => s.beat);
  const tracks = useStudio((s) => s.tracks);
  const sel = useStudio((s) => s.sel);
  const bkg = useStudio((s) => s.bkg);
  const sync = useStudio((s) => s.sync);
  const transport = useStudio((s) => s.transport);
  const toast = useStudio((s) => s.toast);
  const [picking, setPicking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef(0);

  useEffect(() => {
    useStudio.getState().init({ beat: projectBeat(initialBeat), requested, artist, projectId });
  }, [initialBeat, requested, artist, projectId]);

  // Uscendo dallo studio: stop, e il microfono si spegne (niente pallino rosso nel browser).
  useEffect(() => () => useStudio.getState().dispose(), []);

  // Se riparte il player globale, lo studio si ferma (e viceversa: lo studio mette in pausa il player).
  useEffect(
    () =>
      usePlayer.subscribe((p, prev) => {
        if (p.playing && !prev.playing && useStudio.getState().transport === "play") useStudio.getState().stop();
      }),
    [],
  );

  const [toastVisible, setToastVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setToastVisible(true);
    const id = setTimeout(() => setToastVisible(false), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const upload = (index: number) => {
    uploadTarget.current = index;
    fileRef.current?.click();
  };

  const canRecord = transport !== "rec" && transport !== "count";

  return (
    <div className="grid min-w-0 gap-5 lg:gap-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Studio in app</p>
        <h1 className="chrome-text mt-1 font-display text-[clamp(2.2rem,7vw,3.6rem)] font-black leading-none tracking-tight">Registra la tua demo</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-chrome-500">
          Come in studio, dal telefono: registra sul beat, metti l&apos;autotune nella tonalità giusta, usa le nostre catene voce, poi esporta e
          mandala a chi vuoi.
        </p>
      </div>

      {!beat ? (
        <StudioSkeleton />
      ) : (
        <>
          <StudioStage onPickBeat={() => setPicking(true)} onUpload={upload} />
          <p className="-mt-2 text-xs text-chrome-500">
            Scala dell&apos;autotune: <b className="text-graphite-700">{scaleLabel(beat.key)}</b>, presa dalla tonalità del beat.
          </p>
          <PresetBar />
          <section aria-label="Tracce" className="grid min-w-0 gap-4">
            {tracks.map((t, i) => (
              <TrackCard
                key={t.id}
                track={t}
                index={i}
                selected={i === sel}
                musicalKey={beat.key}
                genres={beat.genres}
                presetGenre={bkg}
                canRecord={canRecord}
                sync={sync}
                onUpload={upload}
              />
            ))}
          </section>
          <ExportPanel />
          <MyDemos
            hideWhenEmpty
            onOpen={(id) => {
              void useStudio.getState().openProject(id);
              scrollToTop();
            }}
          />
          <BeatPicker
            open={picking}
            onOpenChange={setPicking}
            beats={catalog}
            ownedIds={ownedIds}
            currentId={beat.id}
            onPick={(b) => {
              setPicking(false);
              if (b.id !== beat.id) {
                useStudio.getState().setBeat(projectBeat(b));
                useStudio.getState().notify(`Registri su ${b.title}: autotune in ${scaleLabel(b.key)}`);
              }
            }}
          />
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        data-testid="voice-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void useStudio.getState().loadFile(uploadTarget.current, file);
        }}
      />

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-full bg-graphite/90 px-4 py-2.5 text-center text-[13px] font-semibold text-white shadow-chrome-lg backdrop-blur transition duration-300 ${
          toastVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        {toast?.text}
      </div>
    </div>
  );
}
