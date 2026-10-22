"use client";

import { ListPlus, Pause, Play, Wand2, Zap } from "lucide-react";
import { formatTime } from "@/lib/beats/format";
import { creditCost, LICENSE_ORDER } from "@/lib/beats/licenses";
import type { BeatSummary } from "@/lib/beats/types";
import { usePlayer } from "../player/player-store";
import { Waveform } from "../player/waveform";
import { useCustomizeDialog, useUnlockDialog, useViewer } from "../providers";
import { ChromeButton } from "../ui/chrome-button";

/** Controlli della pagina del beat: play, forma d'onda grande, coda e sblocco. */
export function BeatHero({ beat }: { beat: BeatSummary }) {
  const isCurrent = usePlayer((s) => s.current?.id === beat.id);
  const playing = usePlayer((s) => s.current?.id === beat.id && s.playing);
  const position = usePlayer((s) => (s.current?.id === beat.id ? s.position : 0));
  const duration = usePlayer((s) => (s.current?.id === beat.id ? s.duration : 0));
  const { toggle, seek, enqueue } = usePlayer.getState();
  const open = useUnlockDialog((s) => s.open);
  const openCustomize = useCustomizeDialog((s) => s.open);
  const { data: viewer } = useViewer();
  const owned = viewer?.owned[beat.id]?.length;

  return (
    <div className="space-y-4">
      <Waveform
        peaks={beat.peaks}
        progress={duration ? position / duration : 0}
        active={playing}
        height={88}
        label={`Forma d'onda di ${beat.title}`}
        valueText={isCurrent ? `${formatTime(position)} di ${formatTime(duration)}` : undefined}
        onSeek={isCurrent && duration ? (r) => seek(r * duration) : undefined}
      />
      <div className="flex flex-wrap gap-2">
        <ChromeButton variant="obsidian" size="lg" onClick={() => toggle(beat)}>
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          {playing ? "Pausa" : "Ascolta"}
        </ChromeButton>
        <ChromeButton variant="electric" size="lg" onClick={() => open(beat)}>
          <Zap className="size-4 fill-current" />
          {owned ? "Le tue licenze" : `Sblocca da ${creditCost(LICENSE_ORDER[0], beat.deal?.discountPct)} crediti`}
        </ChromeButton>
        <ChromeButton variant="chrome" size="lg" onClick={() => openCustomize(beat)}>
          <Wand2 className="size-4" /> Personalizza
        </ChromeButton>
        <ChromeButton variant="chrome" size="icon-lg" onClick={() => enqueue(beat)} aria-label="Aggiungi alla coda">
          <ListPlus className="size-5" />
        </ChromeButton>
      </div>
    </div>
  );
}
