"use client";

import { memo } from "react";
import { RangeSlider } from "@/components/beats/ui/range-slider";
import { cn } from "@/lib/cn";
import { TUNE_MODES } from "@/lib/beats/audio/autotune";
import { scaleLabel } from "@/lib/beats/audio/pitch";
import type { StudioTrack } from "@/lib/beats/audio/studio-project";
import {
  BK,
  DELAY_LABEL,
  DELAY_TIMES,
  formatKnob,
  KNOBS,
  MODULES,
  presetGenreOf,
  ROLE_NAME,
  ROLES,
  type KnobUnit,
  type ModId,
} from "@/lib/beats/audio/vocal-presets";
import type { MusicalKey } from "@/lib/beats/music";
import { PitchGraph } from "./pitch-graph";
import { Signature } from "./preset-bar";
import { useStudio } from "./studio-store";

/** Manopola: etichetta, valore formattato e slider. */
export function Knob({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  onCommit,
  className,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 gap-1", className)}>
      <span className="flex items-baseline justify-between gap-2 text-xs font-bold text-chrome-500">
        <span className="truncate">{label}</span>
        <em className="shrink-0 font-semibold not-italic tabular-nums text-graphite-700">{display}</em>
      </span>
      <RangeSlider value={[value]} min={min} max={max} step={step} label={label} onValueChange={([v]) => onChange(v)} onValueCommit={onCommit ? () => onCommit() : undefined} />
    </div>
  );
}

/** Interruttore piccolo (aria-pressed) per accendere un modulo o il ping-pong. */
function MiniSwitch({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: string; label: string }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onClick} className="inline-flex shrink-0 items-center gap-2 text-xs font-bold text-graphite-700">
      <span className={cn("relative h-6 w-10 rounded-full transition", on ? "bg-ok shadow-[0_0_10px_rgba(22,163,74,0.45)]" : "bg-chrome-300")}>
        <span className={cn("absolute left-[3px] top-[3px] size-[18px] rounded-full bg-white shadow transition-transform", on && "translate-x-4")} />
      </span>
      {children}
    </button>
  );
}

function ModulePanel({ track, index }: { track: StudioTrack; index: number }) {
  const { setFx, toggleMod, setDelayTime, togglePingPong } = useStudio.getState();
  const m = track.open;
  const info = MODULES.find((x) => x.id === m)!;
  const F = track.fx[m] as unknown as Record<string, number> & { on: boolean };
  return (
    <div className="grid gap-3 rounded-[18px] bg-chrome-100/80 p-3.5 ring-1 ring-inset ring-white/70" data-testid={`modpanel-${track.id}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="grid gap-0.5">
          <b className="font-display text-[15px]">{info.title}</b>
          <span className="text-xs text-chrome-500">{info.info}</span>
        </span>
        <MiniSwitch on={F.on} onClick={() => toggleMod(index, m)} label={`${info.title} ${track.name}`}>
          {F.on ? "Attivo" : "Spento"}
        </MiniSwitch>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 min-[420px]:grid-cols-2">
        {KNOBS[m].map((k) => (
          <Knob
            key={k.key}
            label={k.label}
            value={F[k.key]}
            display={formatKnob(F[k.key], k.unit as KnobUnit)}
            min={k.min}
            max={k.max}
            step={k.step}
            onChange={(v) => setFx(index, m, k.key, v)}
          />
        ))}
      </div>
      {m === "dly" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {DELAY_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={track.fx.dly.time === t}
              onClick={() => setDelayTime(index, t)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-bold transition",
                track.fx.dly.time === t ? "bg-graphite text-white" : "chrome-surface text-graphite-700",
              )}
            >
              {DELAY_LABEL[t]}
            </button>
          ))}
          <span className="ml-auto">
            <MiniSwitch on={track.fx.dly.pp} onClick={() => togglePingPong(index)} label={`Ping-pong ${track.name}`}>
              Ping-pong
            </MiniSwitch>
          </span>
        </div>
      )}
    </div>
  );
}

const panLabel = (v: number) => `${v > 0 ? "D " : v < 0 ? "S " : ""}${Math.round(Math.abs(v) * 100)}`;

/** Scheda di una traccia: catena, autotune, modulo aperto, volume e panorama. */
export const TrackCard = memo(function TrackCard({
  track,
  index,
  selected,
  musicalKey,
  genres,
  presetGenre,
  canRecord,
  sync,
  onUpload,
}: {
  track: StudioTrack;
  index: number;
  selected: boolean;
  musicalKey: MusicalKey;
  genres: Array<{ slug: string; parent?: string | null }>;
  presetGenre: ReturnType<typeof presetGenreOf> | null;
  canRecord: boolean;
  sync: number;
  onUpload: (index: number) => void;
}) {
  const s = useStudio.getState();
  const g = presetGenre ?? presetGenreOf(genres);
  const ch = track.chain;
  const modOn = (id: ModId) => track.fx[id].on;

  return (
    <article
      aria-label={`Traccia ${track.name}`}
      data-testid={`track-${track.id}`}
      className={cn("glass grid min-w-0 gap-3 rounded-[24px] p-4 transition-shadow", selected && "outline-2 outline-solid outline-electric")}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: track.color, boxShadow: `0 0 10px ${track.color}` }} />
        <b className="font-display text-lg">{track.name}</b>
        {track.busy && <span className="studio-busy text-xs font-bold text-electric">Accordo…</span>}
        <span className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-pressed={track.mute}
            aria-label={`Muto ${track.name}`}
            onClick={() => s.toggleMute(index)}
            className={cn("grid size-8 place-items-center rounded-full text-xs font-extrabold", track.mute ? "bg-[#ff9f0a] text-white" : "chrome-surface text-graphite-700")}
          >
            M
          </button>
          <button
            type="button"
            aria-pressed={track.solo}
            aria-label={`Solo ${track.name}`}
            onClick={() => s.toggleSolo(index)}
            className={cn("grid size-8 place-items-center rounded-full text-xs font-extrabold", track.solo ? "bg-electric text-white" : "chrome-surface text-graphite-700")}
          >
            S
          </button>
          {selected ? (
            <span className="rounded-full bg-ok/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ok ring-1 ring-inset ring-ok/30">Traccia attiva</span>
          ) : (
            <button
              type="button"
              onClick={() => s.select(index)}
              disabled={!canRecord}
              className="h-8 rounded-full px-3 text-[13px] font-semibold text-graphite-700 transition hover:bg-white/70 disabled:opacity-40"
            >
              Registra qui
            </button>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-chrome-500">Catena:</span>
        <b className="font-display" data-testid={`chain-${track.id}`}>
          {ch ? ch.name : "Personalizzata"}
        </b>
        {ch && <Signature by={ch.by} />}
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={`Preset per ${track.name}`}>
        {ROLES.map((role) => {
          const c = BK[g][role];
          const on = ch?.genre === g && ch.role === role;
          return (
            <button
              key={role}
              type="button"
              aria-pressed={on}
              onClick={() => s.applyPreset(index, g, role)}
              className={cn("h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-bold transition", on ? "bg-graphite text-white" : "chrome-surface text-graphite-700")}
            >
              {ROLE_NAME[role]} · {c.name.split(" · ")[0]}
            </button>
          );
        })}
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-chrome-500">Autotune · {scaleLabel(musicalKey)}</p>
        <div className="chrome-surface grid grid-cols-4 gap-1 rounded-full p-1" role="group" aria-label={`Autotune ${track.name}`}>
          {TUNE_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={track.tune === m.id}
              onClick={() => s.setTune(index, m.id)}
              className={cn(
                "h-9 min-w-0 rounded-full text-[13px] font-bold transition",
                track.tune === m.id ? "bg-electric text-white shadow-glow-sm" : "text-graphite-700 hover:text-graphite",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {track.busy ? (
        <span className="studio-skel block h-[84px] rounded-2xl" aria-label="Accordo la voce…" />
      ) : track.take ? (
        track.curve && track.tune !== "off" ? (
          <PitchGraph curve={track.curve} color={track.color} musicalKey={musicalKey} />
        ) : null
      ) : (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-chrome-500">
          Nessuna take.
          {canRecord && (
            <>
              {" "}
              Premi <b className="text-[#ff3b30]">●</b> per registrare su questa traccia, oppure
            </>
          )}
          <button type="button" className="font-semibold text-electric underline-offset-2 hover:underline" onClick={() => onUpload(index)}>
            carica un file
          </button>
          ·
          <button type="button" className="font-semibold text-electric underline-offset-2 hover:underline" onClick={() => void s.useDemoVoice(index)}>
            voce demo
          </button>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Catena effetti">
        <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold text-graphite-700")}>
          <i aria-hidden className={cn("size-[7px] rounded-full bg-chrome-300", track.tune !== "off" && "bg-[#30d158] shadow-[0_0_8px_#30d158]")} />
          Autotune
        </span>
        {MODULES.map((mod) => (
          <span key={mod.id} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="text-[11px] text-chrome-400">
              ›
            </span>
            <button
              type="button"
              aria-pressed={track.open === mod.id}
              aria-label={`${mod.title} ${track.name}${modOn(mod.id) ? " (attivo)" : " (spento)"}`}
              onClick={() => s.openMod(index, mod.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold transition",
                track.open === mod.id ? "bg-graphite text-white" : "chrome-surface text-graphite-700",
              )}
            >
              <i aria-hidden className={cn("size-[7px] rounded-full bg-chrome-300", modOn(mod.id) && "bg-[#30d158] shadow-[0_0_8px_#30d158]")} />
              {mod.label}
            </button>
          </span>
        ))}
      </div>

      <ModulePanel track={track} index={index} />

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 min-[420px]:grid-cols-2">
        <Knob label="Volume" value={track.vol} display={String(Math.round(track.vol * 100))} min={0} max={1.6} step={0.01} onChange={(v) => s.setMix(index, "vol", v)} />
        <Knob label="Sinistra · Destra" value={track.pan} display={panLabel(track.pan)} min={-1} max={1} step={0.01} onChange={(v) => s.setMix(index, "pan", v)} />
        {selected && track.take && (
          <Knob
            className="min-[420px]:col-span-2"
            label="Sincronizza la voce"
            value={sync}
            display={`${sync > 0 ? "+" : ""}${sync} ms`}
            min={-150}
            max={150}
            step={5}
            onChange={(v) => s.setSync(v)}
            onCommit={() => s.commitSync()}
          />
        )}
      </div>

      {track.take && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => s.clearTake(index)} className="h-9 rounded-full px-3.5 text-[13px] font-semibold text-graphite-700 transition hover:bg-white/70">
            Cancella la take
          </button>
          <button type="button" onClick={() => onUpload(index)} className="h-9 rounded-full px-3.5 text-[13px] font-semibold text-graphite-700 transition hover:bg-white/70">
            Sostituisci con un file
          </button>
        </div>
      )}
    </article>
  );
});
