"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bookmark, Heart, Lock, Mic, Pause, Play, Share2, X, Zap } from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { recordAchievement } from "@/lib/beats/achievements";
import { compareHref } from "@/lib/beats/compare";
import { coverArtURI } from "@/lib/beats/cover-art";
import { isNewRelease } from "@/lib/beats/drops";
import { genreColor, topGenreOf } from "@/lib/beats/genres";
import { creditCost, LICENSE_ORDER } from "@/lib/beats/licenses";
import { SPRING_MOVE, SPRING_PRESS } from "@/lib/beats/motion";
import { camelotCode, keyName } from "@/lib/beats/music";
import { useIsSaved, useSavedBeats, useSavedStore } from "@/lib/beats/saved";
import type { BeatSummary } from "@/lib/beats/types";
import { haptic, sfx } from "@/lib/beats/ui-feedback";
import { TrackList } from "../marketplace/track-row";
import { usePlayer } from "../player/player-store";
import { useUnlockDialog } from "../providers";
import { BeatCover } from "../ui/beat-cover";

/** L'anteprima parte da qui (circa il ritornello), come nei feed verticali. */
const HOOK_AT = 0.2;
const DOUBLE_TAP_MS = 280;
type Feed = "popular" | "new";

/** Tasto della colonna laterale: si schiaccia con una molla, etichetta sotto come nei Reel. */
function RailButton({
  label,
  children,
  onClick,
  href,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}) {
  const inner = (
    <>
      <motion.span
        whileTap={{ scale: 0.78 }}
        transition={SPRING_PRESS}
        className={cn(
          "grid size-12 place-items-center rounded-full bg-black/25 ring-1 ring-white/15 backdrop-blur-md transition-colors",
          active && "bg-white/90 text-[#ff2d78] ring-white",
        )}
      >
        {children}
      </motion.span>
      <span className="text-[11px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{label}</span>
    </>
  );
  const cls = "flex flex-col items-center gap-1 text-white";
  return href ? (
    <Link href={href} className={cls} aria-label={label} data-no-sfx onClick={() => sfx("tap")}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} aria-label={label} aria-pressed={active} data-no-sfx onClick={onClick}>
      {inner}
    </button>
  );
}

/** Forma d'onda del beat che si colora mentre suona. */
function ReelWave({ beat, progress }: { beat: BeatSummary; progress: number }) {
  const bars = useMemo(() => {
    const src = beat.peaks.length ? beat.peaks : Array.from({ length: 48 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 1.7)));
    const n = 48;
    return Array.from({ length: n }, (_, i) => src[Math.floor((i / n) * src.length)] ?? 0.3);
  }, [beat.peaks]);
  return (
    <div aria-hidden className="flex h-8 items-center gap-[3px]">
      {bars.map((v, i) => (
        <span
          key={i}
          className="w-full rounded-full transition-colors duration-150"
          style={{ height: `${Math.max(12, v * 100)}%`, background: i / bars.length <= progress ? "#ffffff" : "rgba(255,255,255,0.28)" }}
        />
      ))}
    </div>
  );
}

const ReelSlide = memo(function ReelSlide({
  beat,
  active,
  index,
  onLike,
  onShare,
}: {
  beat: BeatSummary;
  active: boolean;
  index: number;
  onLike: (beat: BeatSummary, burstAt?: { x: number; y: number }) => void;
  onShare: (beat: BeatSummary) => void;
}) {
  const reduce = useReducedMotion();
  const saved = useIsSaved(beat.id);
  const playing = usePlayer((s) => active && s.current?.id === beat.id && s.playing);
  const progress = usePlayer((s) => (active && s.current?.id === beat.id && s.duration ? s.position / s.duration : 0));
  const openUnlock = useUnlockDialog((s) => s.open);
  const art = useMemo(() => coverArtURI(beat, "lite"), [beat]);
  const color = genreColor(topGenreOf(beat));
  const cost = creditCost(LICENSE_ORDER[0], beat.deal?.discountPct);
  const [flash, setFlash] = useState<"play" | "pause" | null>(null);
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Un tocco = play/pausa, due tocchi = mi piace (con il cuore che esplode dove hai toccato).
  const onTap = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    const now = Date.now();
    const r = e.currentTarget.getBoundingClientRect();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = 0;
      const at = { x: e.clientX - r.left, y: e.clientY - r.top };
      setBurst({ ...at, id: now });
      onLike(beat, at);
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(() => {
      const s = usePlayer.getState();
      const wasPlaying = s.current?.id === beat.id && s.playing;
      s.toggle(beat, [beat]);
      setFlash(wasPlaying ? "pause" : "play");
      sfx("tap");
      setTimeout(() => setFlash(null), 520);
    }, DOUBLE_TAP_MS);
  };

  return (
    <article
      aria-label={`${beat.title}, prod. ${beat.producers.map((p) => p.name).join(" & ")}`}
      data-index={index}
      data-beat={beat.slug}
      className="reel-slide relative h-full w-full snap-start snap-always overflow-hidden"
      style={{ "--reel": color } as React.CSSProperties}
    >
      {/* Sfondo: la copertina generativa ingrandita e sfocata, poi buio dal basso */}
      <div aria-hidden className="reel-bg absolute inset-0 scale-125 bg-cover bg-center" style={{ backgroundImage: `url("${art}")` }} />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_38%,transparent,rgba(0,0,0,0.55)),linear-gradient(180deg,rgba(0,0,0,0.35),transparent_30%,transparent_55%,rgba(0,0,0,0.85))]" />

      <div className="absolute inset-0 flex items-center justify-center pb-24" onClick={onTap}>
        <motion.div
          animate={active && !reduce ? { scale: playing ? 1 : 0.94, rotate: 0, opacity: 1 } : { scale: 0.9, opacity: active ? 1 : 0.6 }}
          transition={SPRING_MOVE}
          className="reel-cover relative"
        >
          <BeatCover beat={beat} size="xl" playing={playing} className="size-[min(68vw,300px)]! rounded-[36px]! lg:size-[260px]!" />
        </motion.div>

        <AnimatePresence>
          {flash && (
            <motion.span
              key={flash}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.25 }}
              transition={SPRING_PRESS}
              className="pointer-events-none absolute grid size-20 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md"
            >
              {flash === "play" ? <Play className="size-9 translate-x-0.5 fill-current" /> : <Pause className="size-9 fill-current" />}
            </motion.span>
          )}
          {burst && (
            <motion.span
              key={burst.id}
              initial={{ opacity: 0, scale: 0.2, rotate: -18 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.2, 1.25, 1, 1.1], y: [0, -10, -16, -60], rotate: [-18, 6, 0, 0] }}
              transition={{ duration: 0.9, times: [0, 0.25, 0.55, 1] }}
              onAnimationComplete={() => setBurst(null)}
              className="pointer-events-none absolute text-[#ff2d78] drop-shadow-[0_8px_24px_rgba(255,45,120,0.6)]"
              style={{ left: burst.x - 48, top: burst.y - 48 }}
            >
              <Heart className="size-24 fill-current" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Colonna delle azioni, come nei Reel */}
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4 lg:bottom-20">
        <RailButton label={saved ? "Salvato" : "Mi piace"} active={saved} onClick={() => onLike(beat)}>
          <Heart className={cn("size-6", saved && "fill-current")} />
        </RailButton>
        <RailButton label="Registra" href={`/beats/registra?beat=${encodeURIComponent(beat.slug)}`}>
          <Mic className="size-6" />
        </RailButton>
        <RailButton
          label={`${cost} cr`}
          onClick={() => {
            sfx("pop");
            openUnlock(beat);
          }}
        >
          <Lock className="size-6" />
        </RailButton>
        <RailButton label="A/B" href={compareHref(beat.slug)}>
          <span className="font-display text-sm font-black">A/B</span>
        </RailButton>
        <RailButton label="Condividi" onClick={() => onShare(beat)}>
          <Share2 className="size-6" />
        </RailButton>
      </div>

      {/* Info del beat in basso a sinistra */}
      <div className="absolute inset-x-0 bottom-0 space-y-3 p-4 pb-5 pr-20 text-white">
        <div className="flex flex-wrap items-center gap-1.5">
          {beat.producers.map((p) => (
            <span key={p.slug} className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-xs font-bold backdrop-blur-md">
              <span className="size-2 rounded-full" style={{ background: p.accentColor ?? "#0066ff", boxShadow: `0 0 8px ${p.accentColor ?? "#0066ff"}` }} />
              {p.name}
            </span>
          ))}
          {isNewRelease(beat.releasedAt) && <span className="rounded-full bg-[#ffd866] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#1a1404]">Nuovo</span>}
        </div>
        <h2 className="font-display text-[clamp(2rem,9vw,2.8rem)] font-black leading-[0.95] tracking-tight drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)]">
          {beat.title}
        </h2>
        <p className="text-sm font-semibold text-white/80">
          {beat.bpm} BPM · {keyName(beat.key)} ({camelotCode(beat.key)})
          {beat.genres[0] && ` · ${beat.genres.map((g) => g.name).join(" · ")}`}
        </p>
        <ReelWave beat={beat} progress={progress} />
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
        <div className="h-full bg-[var(--reel)] shadow-[0_0_12px_var(--reel)]" style={{ width: `${progress * 100}%` }} />
      </div>
    </article>
  );
});

/**
 * Swipe in stile Reels/TikTok: un beat per schermata, scorrimento verticale con aggancio,
 * il beat in vista parte da solo dal ritornello. Doppio tocco = mi piace, colonna di azioni a destra.
 */
export function ReelsFeed({ popular, latest, start }: { popular: BeatSummary[]; latest: BeatSummary[]; start?: string }) {
  const [feed, setFeed] = useState<Feed>("popular");
  const base = feed === "popular" ? popular : latest;
  const [rounds, setRounds] = useState(1);
  const ordered = useMemo(() => {
    const i = start ? base.findIndex((b) => b.slug === start) : -1;
    return i > 0 ? [...base.slice(i), ...base.slice(0, i)] : base;
  }, [base, start]);
  // Il catalogo ricomincia quando finisce: il feed sembra infinito.
  const items = useMemo(() => Array.from({ length: rounds }, (_, r) => ordered.map((b) => ({ beat: b, key: `${r}-${b.id}` }))).flat(), [ordered, rounds]);
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const hooked = useRef<string | null>(null);
  const userScrolled = useRef(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const saved = useSavedBeats();
  const toggleSaved = useSavedStore((s) => s.toggle);
  const save = useSavedStore((s) => s.save);

  // Quale slide è in vista (almeno al 60%).
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  // Il beat in vista suona dal ritornello; scorrendo via si ferma.
  const current = items[active]?.beat;
  useEffect(() => {
    if (!current) return;
    if (userScrolled.current) sfx("whoosh");
    const state = usePlayer.getState();
    if (state.current?.id !== current.id) state.play(current, [current]);
    else if (!state.playing) state.toggle();
    hooked.current = null;
    if (active >= items.length - 3) setRounds((r) => r + 1);
    return usePlayer.subscribe((s) => {
      if (s.current?.id !== current.id || !s.duration || hooked.current === current.id) return;
      hooked.current = current.id;
      if (s.position < 1) s.seek(s.duration * HOOK_AT);
    });
  }, [current, active, items.length]);

  // Uscendo dallo Swipe la musica si ferma (come chiudere un Reel).
  useEffect(() => () => usePlayer.getState().pause(), []);

  const go = useCallback((dir: 1 | -1) => {
    const root = scroller.current;
    if (!root) return;
    userScrolled.current = true;
    root.scrollBy({ top: dir * root.clientHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUnlockDialog.getState().beat || (e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 1800);
  };

  const onLike = useCallback(
    (beat: BeatSummary, burstAt?: { x: number; y: number }) => {
      const isSaved = useSavedStore.getState().items.some((i) => i.beat.id === beat.id);
      if (burstAt) {
        // Il doppio tocco mette sempre "mi piace", non lo toglie.
        if (!isSaved) save(beat);
      } else toggleSaved(beat);
      if (burstAt || !isSaved) {
        sfx("like");
        haptic("success");
      } else sfx("tap");
    },
    [save, toggleSaved],
  );

  const onShare = useCallback(async (beat: BeatSummary) => {
    const url = `${window.location.origin}/beats/${beat.slug}`;
    const data = { title: `${beat.title} · Backrooms Beat Store`, text: `Senti ${beat.title} di ${beat.producers.map((p) => p.name).join(" & ")}`, url };
    try {
      if (navigator.share) {
        await navigator.share(data);
        recordAchievement("share");
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiato");
      sfx("pop");
      recordAchievement("share");
    } catch {
      showToast(url);
    }
  }, []);

  const switchFeed = (f: Feed) => {
    if (f === feed) return;
    sfx("tab");
    setFeed(f);
    setRounds(1);
    setActive(0);
    userScrolled.current = false;
    scroller.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="reels-shell fixed inset-x-0 top-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[35] bg-black lg:relative lg:inset-auto lg:z-auto lg:mx-auto lg:h-[calc(100dvh-72px-6rem)] lg:max-h-[860px] lg:max-w-[440px] lg:overflow-hidden lg:rounded-[36px] lg:shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]">
      <div
        ref={scroller}
        onPointerDown={() => (userScrolled.current = true)}
        onWheel={() => (userScrolled.current = true)}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        aria-label="Beat da scorrere"
      >
        {items.map(({ beat, key }, i) => (
          <ReelSlide key={key} beat={beat} index={i} active={i === active} onLike={onLike} onShare={onShare} />
        ))}
      </div>

      {/* In alto: Per te / Novità, e i salvati */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="w-12" />
        <div className="pointer-events-auto flex gap-1 rounded-full bg-black/25 p-1 backdrop-blur-md" role="tablist" aria-label="Ordine del feed">
          {(
            [
              ["popular", "Per te"],
              ["new", "Novità"],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={feed === f}
              data-no-sfx
              onClick={() => switchFeed(f)}
              className={cn("relative rounded-full px-4 py-1.5 text-sm font-bold transition-colors", feed === f ? "text-black" : "text-white/80")}
            >
              {feed === f && <motion.span layoutId="reels-tab" transition={SPRING_MOVE} className="absolute inset-0 -z-10 rounded-full bg-white" />}
              {label}
            </button>
          ))}
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          transition={SPRING_PRESS}
          onClick={() => setSavedOpen(true)}
          aria-label={`Salvati: ${saved.length}`}
          className="pointer-events-auto relative grid size-11 place-items-center rounded-full bg-black/25 text-white backdrop-blur-md"
        >
          <Bookmark className="size-5" />
          {saved.length > 0 && (
            <span data-testid="saved-count" className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-[#ff2d78] px-1 text-[10px] font-black">
              {saved.length}
            </span>
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.p
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={SPRING_PRESS}
            role="status"
            className="absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-bold text-graphite shadow-xl"
          >
            {toast}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Foglio dei salvati: sale dal basso con una molla */}
      <AnimatePresence>
        {savedOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-black/50"
              onClick={() => setSavedOpen(false)}
            />
            <motion.section
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 600) setSavedOpen(false);
              }}
              aria-label="Beat salvati"
              className="absolute inset-x-0 bottom-0 z-20 max-h-[75%] overflow-y-auto rounded-t-[28px] bg-chrome-50 p-4 pb-6"
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-chrome-300" />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-xl font-black">
                  Salvati <span className="text-chrome-400">· {saved.length}</span>
                </h2>
                <button type="button" onClick={() => setSavedOpen(false)} aria-label="Chiudi" className="chrome-surface grid size-9 place-items-center rounded-full">
                  <X className="size-4" />
                </button>
              </div>
              {saved.length ? (
                <TrackList beats={saved} />
              ) : (
                <p className="py-8 text-center text-sm text-chrome-500">
                  Tocca due volte un beat (o il cuore) per salvarlo qui.
                </p>
              )}
              {saved.length >= 2 && (
                <Link href={compareHref(saved[0].slug, saved[1].slug)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-electric">
                  <Zap className="size-4" /> Confronta i primi due in A/B
                </Link>
              )}
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
