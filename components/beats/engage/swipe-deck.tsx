"use client";

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionStyle, type MotionValue, type PanInfo } from "framer-motion";
import { Heart, Lock, Pause, Play, RotateCcw, Undo2, X, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { genreColor, topGenreOf } from "@/lib/beats/genres";
import { creditCost, LICENSE_ORDER } from "@/lib/beats/licenses";
import { camelotCode, keyName } from "@/lib/beats/music";
import { useSavedBeats, useSavedStore } from "@/lib/beats/saved";
import type { BeatSummary } from "@/lib/beats/types";
import { TrackList } from "../marketplace/track-row";
import { usePlayer } from "../player/player-store";
import { useUnlockDialog, useViewer } from "../providers";
import { BeatCover } from "../ui/beat-cover";
import { ChromeButton } from "../ui/chrome-button";
import { GlowBadge } from "../ui/glow-badge";

type Decision = "like" | "skip";
const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 600;
/** L'anteprima parte da qui (circa il ritornello), come nei feed verticali. */
const HOOK_AT = 0.2;

function Stamp({ label, className, opacity }: { label: string; className: string; opacity: MotionValue<number> }) {
  return (
    <motion.span
      aria-hidden
      style={{ opacity }}
      className={cn("swipe-stamp pointer-events-none absolute z-20 rounded-xl border-[3px] px-3 py-1 font-display text-2xl font-black uppercase tracking-widest", className)}
    >
      {label}
    </motion.span>
  );
}

function SwipeCard({
  beat,
  onDecide,
  onUnlock,
}: {
  beat: BeatSummary;
  onDecide: (decision: Decision) => void;
  onUnlock: () => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-16, 16]);
  const likeOpacity = useTransform(x, [24, SWIPE_DISTANCE], [0, 1]);
  const skipOpacity = useTransform(x, [-SWIPE_DISTANCE, -24], [1, 0]);
  const unlockOpacity = useTransform(y, [-SWIPE_DISTANCE, -24], [1, 0]);
  const playing = usePlayer((s) => s.current?.id === beat.id && s.playing);
  const waiting = usePlayer((s) => s.current?.id === beat.id && s.waiting);
  const progress = usePlayer((s) => (s.current?.id === beat.id && s.duration ? s.position / s.duration : 0));
  const toggle = usePlayer((s) => s.toggle);
  const color = genreColor(topGenreOf(beat));
  const genre = beat.genres[0];

  const dragged = useRef(false);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    // Il click che segue un trascinamento non deve mettere in pausa.
    setTimeout(() => (dragged.current = false), 0);
    if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) return onDecide("like");
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) return onDecide("skip");
    if (offset.y < -SWIPE_DISTANCE || velocity.y < -SWIPE_VELOCITY) onUnlock();
    void animate(x, 0, { type: "spring", stiffness: 420, damping: 32 });
    void animate(y, 0, { type: "spring", stiffness: 420, damping: 32 });
  };

  return (
    <motion.article
      aria-label={`${beat.title}, prod. ${beat.producers.map((p) => p.name).join(" & ")}`}
      data-testid="swipe-card"
      data-beat={beat.slug}
      className="swipe-card obsidian absolute inset-0 z-10 flex touch-none select-none flex-col overflow-hidden rounded-[32px] p-5 sm:p-6"
      style={{ x, y, rotate, "--swipe-color": color } as MotionStyle}
      drag
      onDragStart={() => (dragged.current = true)}
      dragElastic={0.85}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.94, y: 18, opacity: 0.6 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      whileDrag={{ cursor: "grabbing" }}
    >
      <span aria-hidden className="swipe-glow pointer-events-none absolute inset-0" />
      <Stamp label="Mi piace" opacity={likeOpacity} className="left-5 top-6 -rotate-12 border-ok text-ok" />
      <Stamp label="Salta" opacity={skipOpacity} className="right-5 top-6 rotate-12 border-deal text-deal" />
      <Stamp label="Sblocca" opacity={unlockOpacity} className="left-1/2 top-1/3 -translate-x-1/2 border-electric-cyan text-electric-cyan" />

      <div className="relative flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-chrome-100">
          <span aria-hidden className="size-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          {genre?.name ?? "Beat"}
        </span>
        {beat.deal && <GlowBadge tone="deal">-{beat.deal.discountPct}%</GlowBadge>}
      </div>

      <button
        type="button"
        onClick={() => !dragged.current && toggle(beat, [beat])}
        className="relative mx-auto my-auto grid place-items-center rounded-[28px] outline-offset-4"
        aria-label={playing ? `Metti in pausa ${beat.title}` : `Ascolta ${beat.title}`}
      >
        <BeatCover beat={beat} size="xl" playing={playing} className="swipe-cover pointer-events-none" />
        <span
          aria-hidden
          className={cn(
            "absolute grid size-14 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur transition-opacity",
            playing && !waiting ? "opacity-0" : "opacity-100",
          )}
        >
          {playing ? <Pause className="size-6 fill-current" /> : <Play className="ml-0.5 size-6 fill-current" />}
        </span>
      </button>

      <div className="relative space-y-1.5">
        <h2 className="truncate font-display text-3xl font-black tracking-tight text-white">{beat.title}</h2>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-chrome-300">
          {beat.producers.map((p) => (
            <span key={p.slug} className="font-semibold" style={{ color: p.accentColor ?? undefined }}>
              {p.name}
            </span>
          ))}
          <span>
            · {beat.bpm} BPM · {keyName(beat.key)} ({camelotCode(beat.key)})
          </span>
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
        </div>
      </div>
    </motion.article>
  );
}

/**
 * Modalità Swipe: un mazzo di beat da scorrere come le storie.
 * Destra = "Mi piace" (salvato nel browser), sinistra = salta, su = sblocca. Anche con i tasti
 * freccia e con i pulsanti. L'anteprima parte da sola nel player globale.
 */
export function SwipeDeck({ beats }: { beats: BeatSummary[] }) {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Array<{ beat: BeatSummary; decision: Decision }>>([]);
  const [lastDir, setLastDir] = useState<Decision>("skip");
  const saved = useSavedBeats();
  const save = useSavedStore((s) => s.save);
  const remove = useSavedStore((s) => s.remove);
  const openUnlock = useUnlockDialog((s) => s.open);
  const { data: viewer } = useViewer();
  const reduceMotion = useReducedMotion();
  const top = beats[index] ?? null;
  const hookedFor = useRef<string | null>(null);

  // Autoplay del beat in cima al mazzo (se il browser lo permette), dal punto del ritornello.
  useEffect(() => {
    if (!top) return;
    const state = usePlayer.getState();
    if (state.current?.id !== top.id) state.play(top, [top]);
    else if (!state.playing) state.toggle();
    return usePlayer.subscribe((s) => {
      if (s.current?.id !== top.id || !s.duration || hookedFor.current === top.id) return;
      hookedFor.current = top.id;
      if (s.position < 1) s.seek(s.duration * HOOK_AT);
    });
  }, [top]);

  const decide = useCallback(
    (decision: Decision) => {
      if (!top) return;
      if (decision === "like") save(top);
      setLastDir(decision);
      setHistory((h) => [...h, { beat: top, decision }]);
      setIndex((i) => i + 1);
    },
    [top, save],
  );

  const undo = useCallback(() => {
    const last = history.at(-1);
    if (!last) return;
    if (last.decision === "like") remove(last.beat.id);
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
  }, [history, remove]);

  const unlock = useCallback(() => {
    if (!top) return;
    openUnlock(top);
  }, [top, openUnlock]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUnlockDialog.getState().beat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=slider]")) return;
      if (e.key === "ArrowRight") decide("like");
      else if (e.key === "ArrowLeft") decide("skip");
      else if (e.key === "ArrowUp") unlock();
      else if (e.key === "Backspace") undo();
      else if (e.key === " " && !target?.closest("button, a") && top) usePlayer.getState().toggle(top, [top]);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, unlock, undo, top]);

  const owned = top ? (viewer?.owned[top.id]?.length ?? 0) > 0 : false;
  const cost = top ? creditCost(LICENSE_ORDER[0], top.deal?.discountPct) : 0;
  const liked = history.filter((h) => h.decision === "like").length;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-center lg:justify-center">
        <div className="mx-auto w-full max-w-[26rem]">
          <div className="swipe-stack relative h-[clamp(20rem,calc(100dvh-27rem),36rem)] lg:h-[clamp(24rem,calc(100dvh-23rem),36rem)]" aria-live="polite">
            {beats[index + 2] && <div aria-hidden className="obsidian absolute inset-0 translate-y-5 scale-[0.88] rounded-[32px] opacity-40" />}
            {beats[index + 1] && <div aria-hidden className="obsidian absolute inset-0 translate-y-2.5 scale-[0.94] rounded-[32px] opacity-70" />}
            <AnimatePresence custom={lastDir} initial={false}>
              {top ? (
                <motion.div
                  key={top.id}
                  className="absolute inset-0"
                  custom={lastDir}
                  exit="exit"
                  variants={{
                    exit: (dir: Decision) =>
                      reduceMotion
                        ? { opacity: 0, transition: { duration: 0.15 } }
                        : { x: dir === "like" ? 520 : -520, rotate: dir === "like" ? 18 : -18, opacity: 0, transition: { duration: 0.32 } },
                  }}
                >
                  <SwipeCard beat={top} onDecide={decide} onUnlock={unlock} />
                </motion.div>
              ) : (
                <motion.div
                  key="fine"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="obsidian absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[32px] p-8 text-center"
                >
                  <p className="font-display text-2xl font-black">Hai visto tutto il mazzo</p>
                  <p className="text-sm text-chrome-300">
                    {liked ? `Ne hai salvati ${liked}: li trovi qui sotto.` : "Nessun salvataggio stavolta. Riprova, ogni lunedì escono beat nuovi."}
                  </p>
                  <ChromeButton onClick={() => (setIndex(0), setHistory([]))}>
                    <RotateCcw className="size-4" /> Ricomincia
                  </ChromeButton>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-5 flex items-center justify-center gap-3" role="group" aria-label="Decidi">
            <ChromeButton size="icon" onClick={undo} disabled={!history.length} aria-label="Torna al beat precedente" title="Indietro (Backspace)">
              <Undo2 className="size-4" />
            </ChromeButton>
            <ChromeButton size="icon-lg" onClick={() => decide("skip")} disabled={!top} aria-label="Salta" title="Salta (freccia sinistra)">
              <X className="size-6 text-deal" />
            </ChromeButton>
            <ChromeButton
              variant="electric"
              size="icon-lg"
              onClick={unlock}
              disabled={!top}
              aria-label={owned ? "Già tuo: apri le licenze" : `Sblocca da ${cost} crediti`}
              title="Sblocca (freccia su)"
            >
              {owned ? <Lock className="size-5" /> : <Zap className="size-6 fill-current" />}
            </ChromeButton>
            <ChromeButton size="icon-lg" onClick={() => decide("like")} disabled={!top} aria-label="Mi piace, salvalo" title="Mi piace (freccia destra)">
              <Heart className="size-6 fill-ok text-ok" />
            </ChromeButton>
          </div>
          <p className="mt-3 text-center text-xs text-chrome-500">
            Trascina o usa le frecce: → mi piace · ← salta · ↑ sblocca · spazio pausa
          </p>
        </div>

        <aside className="glass hidden rounded-[28px] p-6 lg:block" aria-label="Come funziona">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Come funziona</p>
          <ul className="mt-3 space-y-3 text-sm text-graphite-700">
            <li className="flex gap-3">
              <Heart className="size-5 shrink-0 text-ok" /> <span><b>Destra</b>: ti piace, lo salvi nella lista qui sotto.</span>
            </li>
            <li className="flex gap-3">
              <X className="size-5 shrink-0 text-deal" /> <span><b>Sinistra</b>: passi al prossimo.</span>
            </li>
            <li className="flex gap-3">
              <Zap className="size-5 shrink-0 text-electric" /> <span><b>Su</b>: lo sblocchi subito con i crediti.</span>
            </li>
          </ul>
          <p className="mt-5 font-mono text-sm text-chrome-500">
            {Math.min(index + 1, beats.length)}/{beats.length} nel mazzo
          </p>
        </aside>
      </div>

      <section aria-labelledby="salvati-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 id="salvati-title" className="font-display text-xl font-bold">
            Salvati <span className="text-chrome-400" data-testid="saved-count">· {saved.length}</span>
          </h2>
          {saved.length > 0 && (
            <Link href="/beats/confronta" className="text-sm font-semibold text-electric">
              Confrontane due
            </Link>
          )}
        </div>
        {saved.length ? (
          <TrackList beats={saved} />
        ) : (
          <p className="glass rounded-2xl p-5 text-sm text-chrome-500">Scorri a destra i beat che ti piacciono: li ritrovi qui, anche domani.</p>
        )}
      </section>
    </div>
  );
}
