"use client";

import { ArrowLeftRight, Pause, Play, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { recordAchievement } from "@/lib/beats/achievements";
import { compareHref, keysCompatible, rankCandidates } from "@/lib/beats/compare";
import { formatTime } from "@/lib/beats/format";
import { camelotCode, keyName } from "@/lib/beats/music";
import type { BeatSummary } from "@/lib/beats/types";
import { previewUrl, usePlayer } from "../player/player-store";
import { useUnlockDialog } from "../providers";
import { BeatCover } from "../ui/beat-cover";
import { ChromeButton } from "../ui/chrome-button";
import { GlowBadge, ProducerTag } from "../ui/glow-badge";

type Side = "a" | "b";
/** Oltre questa deriva (secondi) la traccia muta si riallinea a quella che senti. */
const DRIFT = 0.04;

/**
 * Due <audio> che suonano insieme, uno muto: passare da A a B è solo uno scambio di "muted",
 * quindi istantaneo e senza perdere il punto. Un ciclo requestAnimationFrame corregge la deriva.
 * Funziona anche con le anteprime su R2 (nessuna richiesta CORS, a differenza della Web Audio API).
 */
function useDualPreview(a: BeatSummary, b: BeatSummary) {
  const refs = { a: useRef<HTMLAudioElement>(null), b: useRef<HTMLAudioElement>(null) };
  const [active, setActive] = useState<Side>("a");
  const activeRef = useRef<Side>("a");
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const frame = useRef(0);
  const switched = useRef(false);

  const els = useCallback(() => {
    const on = activeRef.current;
    return { master: refs[on].current, slave: refs[on === "a" ? "b" : "a"].current };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- i ref sono stabili
  }, []);

  const applyMute = useCallback(() => {
    const { master, slave } = els();
    if (master) master.muted = false;
    if (slave) slave.muted = true;
  }, [els]);

  const tick = useCallback(() => {
    const { master, slave } = els();
    if (master && slave) {
      const t = master.currentTime;
      if (Number.isFinite(slave.duration) && t < slave.duration - 0.05) {
        if (Math.abs(slave.currentTime - t) > DRIFT) slave.currentTime = t;
        if (slave.paused && !master.paused) void slave.play().catch(() => undefined);
      } else if (!slave.paused) slave.pause();
      setPosition(t);
      setDuration(Number.isFinite(master.duration) ? master.duration : 0);
    }
    frame.current = requestAnimationFrame(tick);
  }, [els]);

  const pause = useCallback(() => {
    refs.a.current?.pause();
    refs.b.current?.pause();
    cancelAnimationFrame(frame.current);
    setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- i ref sono stabili
  }, []);

  const play = useCallback(async () => {
    // Un solo audio alla volta: il player globale si ferma.
    usePlayer.getState().pause();
    applyMute();
    const { master, slave } = els();
    if (!master || !slave) return;
    if (slave.currentTime !== master.currentTime && Number.isFinite(slave.duration) && master.currentTime < slave.duration) {
      slave.currentTime = master.currentTime;
    }
    try {
      await Promise.all([master.play(), slave.play()]);
      setPlaying(true);
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(tick);
    } catch {
      setPlaying(false);
    }
  }, [applyMute, els, tick]);

  const select = useCallback(
    (side: Side) => {
      if (activeRef.current === side) return;
      const { master } = els();
      const t = master?.currentTime ?? 0;
      activeRef.current = side;
      setActive(side);
      const next = refs[side].current;
      if (next && Number.isFinite(next.duration) && t < next.duration && Math.abs(next.currentTime - t) > DRIFT) next.currentTime = t;
      applyMute();
      if (playing && !switched.current) {
        switched.current = true;
        recordAchievement("compare");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- i ref sono stabili
    [applyMute, els, playing],
  );

  const seek = useCallback((t: number) => {
    for (const el of [refs.a.current, refs.b.current]) if (el && Number.isFinite(el.duration)) el.currentTime = Math.min(t, el.duration - 0.05);
    setPosition(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- i ref sono stabili
  }, []);

  // Nuova coppia: si riparte da capo, in pausa.
  useEffect(() => {
    pause();
    setPosition(0);
    switched.current = false;
    return () => cancelAnimationFrame(frame.current);
  }, [a.id, b.id, pause]);

  // Se parte il player globale (un'altra riga, la tastiera…), il confronto si ferma.
  useEffect(() => usePlayer.subscribe((s) => s.playing && pause()), [pause]);

  const audio = (
    <>
      {(["a", "b"] as const).map((side) => {
        const beat = side === "a" ? a : b;
        return (
          <audio
            key={`${side}-${beat.id}`}
            ref={refs[side]}
            src={previewUrl(beat.id)}
            preload="auto"
            muted={side !== active}
            data-side={side}
            onEnded={() => side === activeRef.current && (pause(), seek(0))}
            onLoadedMetadata={(e) => side === activeRef.current && setDuration(e.currentTarget.duration)}
          />
        );
      })}
    </>
  );

  return { audio, active, playing, position, duration, play, pause, select, seek };
}

function Fact({ label, value, highlight }: { label: string; value: ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-chrome-200/80 py-2 text-sm first:border-t-0">
      <dt className="text-chrome-500">{label}</dt>
      <dd className={cn("truncate text-right font-semibold", highlight && "text-ok")}>{value}</dd>
    </div>
  );
}

function SideCard({
  side,
  beat,
  other,
  active,
  catalog,
  onPick,
  onSelect,
  onChoose,
}: {
  side: Side;
  beat: BeatSummary;
  other: BeatSummary;
  active: boolean;
  catalog: BeatSummary[];
  onPick: (slug: string) => void;
  onSelect: () => void;
  onChoose: () => void;
}) {
  const label = side.toUpperCase();
  const genre = beat.genres.map((g) => g.name).join(", ") || "—";
  const bpmDiff = beat.bpm - other.bpm;
  return (
    <section
      aria-label={`Beat ${label}: ${beat.title}`}
      className={cn("glass min-w-0 rounded-[28px] p-4 transition-shadow sm:p-6", active && " ring-2 ring-electric")}
      data-testid={`compare-${side}`}
      data-active={active || undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("grid size-9 place-items-center rounded-full font-display text-lg font-semibold", active ? "bg-electric text-white" : "chrome-surface text-graphite")}>
          {label}
        </span>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Cambia il beat {label}</span>
          <select
            value={beat.slug}
            onChange={(e) => onPick(e.target.value)}
            className="chrome-surface h-9 w-full min-w-0 truncate rounded-full px-4 text-[13px] font-semibold text-graphite-700"
          >
            {catalog.map((x) => (
              <option key={x.id} value={x.slug} disabled={x.id === other.id}>
                {x.title} · {x.bpm} BPM
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" onClick={onSelect} className="mt-4 flex w-full min-w-0 items-center gap-4 text-left" aria-pressed={active}>
        <BeatCover beat={beat} size="lg" playing={active} />
        <span className="min-w-0">
          <span className="block truncate font-display text-xl font-semibold">{beat.title}</span>
          <span className="flex flex-wrap gap-x-4">
            {beat.producers.map((p) => (
              <ProducerTag key={p.slug} name={p.name} color={p.accentColor} co={p.role === "CO_PRODUCER"} />
            ))}
          </span>
        </span>
      </button>
      <dl className="mt-4">
        <Fact label="BPM" value={`${beat.bpm}${bpmDiff ? ` (${bpmDiff > 0 ? "+" : ""}${bpmDiff})` : ""}`} />
        <Fact label="Tonalità" value={`${keyName(beat.key)} · ${camelotCode(beat.key)}`} highlight={side === "b" && keysCompatible(other, beat)} />
        <Fact label="Genere" value={genre} />
        <Fact label="Durata" value={formatTime(beat.durationSec)} />
      </dl>
      <ChromeButton variant={active ? "electric" : "chrome"} className="mt-4 w-full" onClick={onChoose}> Scelgo {label}
      </ChromeButton>
    </section>
  );
}

/** Confronto A/B istantaneo: stessa posizione, cambio immediato, schede affiancate. */
export function CompareView({ a, b, catalog }: { a: BeatSummary; b: BeatSummary; catalog: BeatSummary[] }) {
  const router = useRouter();
  const player = useDualPreview(a, b);
  const openUnlock = useUnlockDialog((s) => s.open);
  const suggestions = rankCandidates(a, catalog, 5);
  const compatible = keysCompatible(a, b);

  const go = (nextA: string, nextB: string) => router.replace(compareHref(nextA, nextB), { scroll: false });
  const choose = (beat: BeatSummary) => {
    player.pause();
    openUnlock(beat);
  };

  const { select, play, pause, playing, active } = player;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUnlockDialog.getState().beat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role=dialog], [role=slider]")) return;
      const k = e.key.toLowerCase();
      if (k === "a") select("a");
      else if (k === "b") select("b");
      else if (k === "tab" && playing && !target?.closest("button, a")) select(active === "a" ? "b" : "a");
      else if (e.key === " " && !target?.closest("button, a")) void (playing ? pause() : play());
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select, play, pause, playing, active]);

  return (
    <div className="flex flex-col gap-6">
      {player.audio}
      <div className="order-2 grid gap-4 md:order-1 md:grid-cols-2 [&>*]:min-w-0">
        <SideCard side="a" beat={a} other={b} active={active === "a"} catalog={catalog} onPick={(s) => go(s, b.slug === s ? a.slug : b.slug)} onSelect={() => select("a")} onChoose={() => choose(a)} />
        <SideCard side="b" beat={b} other={a} active={active === "b"} catalog={catalog} onPick={(s) => go(a.slug === s ? b.slug : a.slug, s)} onSelect={() => select("b")} onChoose={() => choose(b)} />
      </div>

      <section aria-label="Controlli del confronto" className="obsidian order-1 space-y-4 md:order-2 rounded-[28px] p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <ChromeButton size="icon-lg" onClick={() => void (playing ? pause() : play())} aria-label={playing ? "Pausa" : "Ascolta"} data-testid="compare-play">
            {playing ? <Pause className="size-6 fill-current" /> : <Play className="ml-0 size-6 fill-current" />}
          </ChromeButton>
          <div className="chrome-surface flex rounded-full p-2" role="group" aria-label="Cosa ascolti">
            {(["a", "b"] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => select(side)}
                aria-pressed={active === side}
                data-testid={`compare-switch-${side}`}
                className={cn(
                  "h-11 min-w-14 rounded-full px-6 font-display text-lg font-semibold transition-colors",
                  active === side ? "bg-graphite text-white" : "text-graphite-700",
                )}
              >
                {side.toUpperCase()}
              </button>
            ))}
          </div>
          <ChromeButton size="icon" onClick={() => select(active === "a" ? "b" : "a")} aria-label="Scambia A e B">
            <ArrowLeftRight className="size-4" />
          </ChromeButton>
          <ChromeButton size="icon" onClick={() => player.seek(0)} aria-label="Da capo">
            <RotateCcw className="size-4" />
          </ChromeButton>
          <p className="ml-auto text-sm tabular-nums text-chrome-300" data-testid="compare-time">
            {formatTime(player.position)} / {formatTime(player.duration)}
          </p>
        </div>
        <input
          type="range"
          min={0}
          max={player.duration || 1}
          step={0.1}
          value={player.position}
          onChange={(e) => player.seek(Number(e.target.value))}
          aria-label="Posizione"
          aria-valuetext={formatTime(player.position)}
          className="h-2 w-full cursor-pointer accent-[#8e8e95]"
        />
        <p className="text-sm text-chrome-300">
          Stai ascoltando <b className="text-white">{(active === "a" ? a : b).title}</b>. Passa da A a B (anche coi tasti A e B): il punto resta lo
          stesso, così senti subito quale sta meglio con la tua voce.
          {compatible && <span className="text-electric-cyan"> Le tonalità sono compatibili: puoi anche mixarli.</span>}
        </p>
      </section>

      {suggestions.length > 0 && (
        <section aria-labelledby="cmp-sugg" className="order-3 space-y-2">
          <h2 id="cmp-sugg" className="font-display text-lg font-semibold">
            Altri B con BPM vicino a {a.title}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => go(a.slug, x.slug)}
                  aria-pressed={x.id === b.id}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold",
                    x.id === b.id ? "bg-graphite text-white" : "chrome-surface text-graphite-700",
                  )}
                >
                  {x.title} · {x.bpm}
                  {keysCompatible(a, x) && <GlowBadge tone="ok" className="px-2 py-0 text-[9px]">key</GlowBadge>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
