"use client";

import { Loader2, Mic, Pause, Play, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatRelativeDay } from "@/lib/beats/format";
import { LICENSES, type LicenseType } from "@/lib/beats/licenses";
import type { BeatSummary } from "@/lib/beats/types";
import { computePeaks } from "../player/audio-engine";
import { usePlayer } from "../player/player-store";
import { Waveform } from "../player/waveform";
import { BeatCover } from "../ui/beat-cover";
import { GlassPanel } from "../ui/glass-panel";
import { ProducerTag } from "../ui/glow-badge";

const MAX_VOCAL_BYTES = 80 * 1024 * 1024;

/** "Carica traccia vocale di prova": il file resta nel browser (blob URL), nessun upload. */
function VocalTakeUploader() {
  const vocal = usePlayer((s) => s.vocal);
  const setVocal = usePlayer((s) => s.setVocal);
  const enabled = usePlayer((s) => s.vocalEnabled);
  const setEnabled = usePlayer((s) => s.setVocalEnabled);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/^audio\/(mpeg|mp3|wav|x-wav|wave|vnd\.wave)$/.test(file.type) && !/\.(mp3|wav)$/i.test(file.name)) {
      setError("Formato non supportato: usa MP3 o WAV.");
      return;
    }
    if (file.size > MAX_VOCAL_BYTES) {
      setError("File troppo grande (massimo 80 MB).");
      return;
    }
    setBusy(true);
    try {
      const { peaks, duration } = await computePeaks(file);
      setVocal({ url: URL.createObjectURL(file), name: file.name, peaks, duration });
    } catch {
      setError("Non riesco a leggere questo file audio.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  if (vocal) {
    return (
      <div className="rounded-2xl border border-electric/30 bg-electric-50/80 p-4">
        <div className="flex items-center gap-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-electric text-white">
            <Mic className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{vocal.name}</p>
            <p className="text-xs text-chrome-500">Suona sopra ogni beat che ascolti</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-graphite-700">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-[#8e8e95]" />
            Attiva
          </label>
          <button type="button" onClick={() => setVocal(null)} aria-label="Rimuovi la traccia vocale" className="p-2 text-chrome-400 hover:text-deal">
            <Trash2 className="size-4" />
          </button>
        </div>
        <Waveform peaks={vocal.peaks} progress={0} height={24} compact className="mt-2" label="Forma d'onda della voce" />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="flex h-16 w-full items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-electric/40 bg-electric-50/50 text-[15px] font-semibold text-electric transition hover:border-electric hover:bg-electric-50"
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        Carica traccia vocale di prova
      </button>
      <input ref={input} type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} tabIndex={-1} />
      <p className="mt-2 text-[13px] leading-relaxed text-chrome-500">
        MP3 o WAV. Il file resta sul tuo telefono: lo ascolti sopra il beat prima di comprarlo.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[13px] font-normal text-deal">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * "Riprendi da dove eri rimasto": l'ultimo ascolto salvato sul dispositivo,
 * altrimenti l'ultima licenza sbloccata.
 */
export function ResumeCard({ lastLicense }: { lastLicense: { beat: BeatSummary; type: LicenseType; createdAt: string } | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const resume = usePlayer((s) => s.resume);
  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const toggle = usePlayer((s) => s.toggle);

  const fromHistory = mounted ? (current ?? resume?.beat ?? null) : null;
  const beat = fromHistory ?? lastLicense?.beat ?? null;
  const isCurrent = beat && current?.id === beat.id;
  const progress = isCurrent && duration ? position / duration : resume && beat && resume.beat.id === beat.id && resume.duration ? Math.min(1, resume.position / resume.duration) : 0;
  const subtitle =
    lastLicense && beat?.id === lastLicense.beat.id
      ? `Scaricato ${formatRelativeDay(lastLicense.createdAt)} · ${LICENSES[lastLicense.type].name}`
      : "Ultimo ascolto";

  return (
    <GlassPanel className="p-4 sm:p-6">
      <p className="text-[11px] font-semibold text-electric">Riprendi da dove eri rimasto</p>
      {beat ? (
        <div className="mt-4 flex items-center gap-4">
          <BeatCover beat={beat} size="lg" playing={Boolean(isCurrent && playing)} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl font-semibold tracking-tight">{beat.title}</p>
            <p className="mt-0 flex flex-wrap items-center gap-x-2 text-[13px] text-chrome-500">
              {subtitle} · prod. by
              {beat.producers.map((p) => (
                <ProducerTag key={p.slug} name={p.name} color={p.accentColor} />
              ))}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chrome-200">
              <div className="h-full rounded-full bg-electric transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggle(beat)}
            aria-label={isCurrent && playing ? "Pausa" : `Riprendi ${beat.title}`}
            className={cn("chrome-surface grid size-14 shrink-0 place-items-center rounded-full transition active:scale-95", isCurrent && playing && "")}
          >
            {isCurrent && playing ? <Pause className="size-6 fill-current" /> : <Play className="size-6 translate-x-0.5 fill-current" />}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-chrome-500">Ascolta un beat dal catalogo: lo ritroverai qui.</p>
      )}
      <div className="mt-4">
        <VocalTakeUploader />
      </div>
    </GlassPanel>
  );
}
