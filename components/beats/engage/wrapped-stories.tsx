"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, Loader2, Play, RotateCcw, Share2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { recordAchievement } from "@/lib/beats/achievements";
import { genreColor } from "@/lib/beats/genres";
import { useListeningStats } from "@/lib/beats/listening-log";
import type { ListeningStats } from "@/lib/beats/listening-stats";
import { camelotCode, keyName } from "@/lib/beats/music";
import type { BeatSummary } from "@/lib/beats/types";
import { usePlayer } from "../player/player-store";
import { BeatCover } from "../ui/beat-cover";
import { useBadgeStates } from "./badges-grid";
import { canvasToBlob, createCanvas, downloadBlob, fitText, FONT_DISPLAY, roundRect, shareOrDownload } from "./share-image";

const SLIDE_MS = 6000;

export interface WrappedProfile {
  artistName: string;
  levelName: string;
  levelColor: string;
  unlocked: number;
  /** Beat della libreria: servono per riascoltare il beat dell'anno con il player. */
  library: BeatSummary[];
}

const fmt = (n: number) => n.toLocaleString("it-IT");

function listenLabel(s: ListeningStats): { big: string; unit: string } {
  if (s.totalSeconds >= 3600) return { big: fmt(s.hours), unit: s.hours === 1 ? "ora" : "ore" };
  return { big: fmt(s.minutes), unit: s.minutes === 1 ? "minuto" : "minuti" };
}

function Rise({ delay = 0, className, children, style }: { delay?: number; className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

const kicker = "text-xs font-extrabold uppercase tracking-[0.3em]";
const big = "font-display text-[clamp(3.5rem,18vw,6.5rem)] font-black leading-[0.9] tracking-tight";

/** Disegna la locandina finale (1080×1920, formato storie) e la restituisce come PNG. */
async function renderPoster(profile: WrappedProfile, stats: ListeningStats, year: number, badges: number): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const { canvas, ctx } = createCanvas(W, H);
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, W, H);
  const glowTop = ctx.createRadialGradient(W / 2, 120, 0, W / 2, 120, 900);
  glowTop.addColorStop(0, "rgba(255,45,146,0.45)");
  glowTop.addColorStop(1, "transparent");
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, H);
  const glowBottom = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, 1000);
  glowBottom.addColorStop(0, "rgba(0,102,255,0.55)");
  glowBottom.addColorStop(1, "transparent");
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#00f0ff";
  ctx.font = `800 40px ${FONT_DISPLAY}`;
  ctx.fillText(`BACKROOMS WRAPPED ${year}`, W / 2, 230);
  ctx.fillStyle = "#ffffff";
  fitText(ctx, profile.artistName, W / 2, 400, W - 160, (s) => `900 ${s}px ${FONT_DISPLAY}`, 150);

  const { big: hours, unit } = listenLabel(stats);
  const rows: Array<[string, string, string?]> = [
    [`${unit[0].toUpperCase()}${unit.slice(1)} di ascolto`, hours],
    ["Produttore", stats.topProducer?.name ?? "—", stats.topProducer?.accentColor ?? undefined],
    ["Genere", stats.topGenre?.name ?? "—", stats.topGenre ? genreColor(stats.topGenre.slug) : undefined],
    ["Beat dell'anno", stats.topBeat?.beat.title ?? "—"],
    ["Beat sbloccati", fmt(profile.unlocked)],
    ["Serie più lunga", `${stats.longestStreak} ${stats.longestStreak === 1 ? "giorno" : "giorni"}`],
    ["Livello", profile.levelName, profile.levelColor],
  ];
  const top = 520;
  roundRect(ctx, 90, top, W - 180, rows.length * 150 + 60, 56);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
  rows.forEach(([label, value, color], i) => {
    const y = top + 120 + i * 150;
    ctx.textAlign = "left";
    ctx.fillStyle = "#9ca3af";
    ctx.font = `600 38px ${FONT_DISPLAY}`;
    ctx.fillText(label, 150, y);
    ctx.textAlign = "right";
    ctx.fillStyle = color ?? "#ffffff";
    fitText(ctx, value, W - 150, y, 460, (s) => `800 ${s}px ${FONT_DISPLAY}`, 54);
    if (i < rows.length - 1) {
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(150, y + 52, W - 300, 2);
    }
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "#c9ced6";
  ctx.font = `700 38px ${FONT_DISPLAY}`;
  ctx.fillText(`${badges} badge sbloccati`, W / 2, top + rows.length * 150 + 180);
  ctx.fillStyle = "#9ca3af";
  ctx.font = `600 34px ${FONT_DISPLAY}`;
  ctx.fillText("Backrooms Beat Store · Vicenza", W / 2, H - 120);
  return canvasToBlob(canvas);
}

/**
 * "Il tuo anno su Backrooms": storie a schermo intero con barre di avanzamento.
 * Tocca a destra/sinistra per andare avanti/indietro, tieni premuto per fermare.
 * I dati vengono dal registro locale degli ascolti più la libreria dal server.
 */
export function WrappedStories({ profile }: { profile: WrappedProfile }) {
  const router = useRouter();
  const year = new Date().getFullYear();
  const stats = useListeningStats(year);
  const badges = useBadgeStates({ unlocked: profile.unlocked });
  const badgeCount = badges.filter((b) => b.unlocked).length;
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasHeld = useRef(false);
  const play = usePlayer((s) => s.play);

  const topBeat = stats.topBeat ? (profile.library.find((b) => b.id === stats.topBeat!.beat.id) ?? null) : null;
  const listened = listenLabel(stats);
  const empty = stats.totalSeconds < 60;

  const slides: Array<{ bg: string; light?: boolean; body: ReactNode }> = [
    {
      bg: "radial-gradient(70% 50% at 50% 30%, rgba(0,102,255,0.6), transparent 70%), #05070a",
      body: (
        <>
          <Rise className={cn(kicker, "text-electric-cyan")}>Backrooms Wrapped</Rise>
          <Rise delay={0.15} className="font-display text-3xl font-bold text-white">
            Il tuo anno su Backrooms
          </Rise>
          <Rise delay={0.3} className={cn(big, "chrome-text-light break-words")}>
            {profile.artistName}
          </Rise>
          <Rise delay={0.45} className="text-lg text-chrome-300">
            {year}: ecco com&apos;è andata. Tocca per continuare.
          </Rise>
        </>
      ),
    },
    {
      bg: "linear-gradient(160deg, #0066ff, #00b8ff 60%, #00e5ff)",
      body: empty ? (
        <>
          <Rise className={cn(kicker, "text-white/80")}>Hai ascoltato</Rise>
          <Rise delay={0.15} className={cn(big, "text-white")}>
            Ancora poco
          </Rise>
          <Rise delay={0.3} className="text-lg text-white/90">
            Il tuo anno è appena iniziato: fai partire qualche beat e torna qui a vedere i numeri crescere.
          </Rise>
        </>
      ) : (
        <>
          <Rise className={cn(kicker, "text-white/80")}>Hai ascoltato</Rise>
          <Rise delay={0.15} className={cn(big, "text-white")}>
            <span data-testid="wrapped-hours">{listened.big}</span> {listened.unit}
          </Rise>
          <Rise delay={0.3} className="font-display text-2xl font-bold text-white">
            di beat Backrooms.
          </Rise>
          <Rise delay={0.45} className="text-lg text-white/90">
            {fmt(stats.plays)} ascolti in {stats.activeDays} {stats.activeDays === 1 ? "giorno" : "giorni"}.
          </Rise>
        </>
      ),
    },
    {
      bg: `radial-gradient(80% 60% at 30% 20%, ${stats.topProducer?.accentColor ?? "#ec4899"}, transparent 70%), #05070a`,
      body: (
        <>
          <Rise className={cn(kicker, "text-white/80")}>Il tuo produttore</Rise>
          <Rise
            delay={0.15}
            className={big}
            style={{ color: stats.topProducer?.accentColor ?? "#fff", textShadow: `0 0 40px ${stats.topProducer?.accentColor ?? "#0066ff"}` }}
          >
            {stats.topProducer?.name ?? "Tutti e tre"}
          </Rise>
          <Rise delay={0.3} className="text-lg text-chrome-200">
            {stats.topProducer
              ? `${fmt(Math.round(stats.topProducer.seconds / 60))} minuti sui suoi beat. Astral, Freya e Plugghe sono i resident dello studio: potete lavorare insieme in Studio Lounge.`
              : "Astral, Freya e Plugghe ti aspettano: ascolta i loro beat e scopri chi fa per te."}
          </Rise>
        </>
      ),
    },
    {
      bg: `linear-gradient(170deg, ${stats.topGenre ? genreColor(stats.topGenre.slug) : "#bf5af2"}, #05070a 85%)`,
      body: (
        <>
          <Rise className={cn(kicker, "text-white/80")}>Il tuo genere</Rise>
          <Rise delay={0.15} className={cn(big, "text-white")}>
            {stats.topGenre?.name ?? "Da scoprire"}
          </Rise>
          <Rise delay={0.3} className="w-full space-y-2.5">
            {stats.genres.map((g, i) => (
              <div key={g.slug} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 text-sm font-bold text-white">
                <span className="truncate">{g.name}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-white/15">
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ background: genreColor(g.slug) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${g.pct}%` }}
                    transition={{ duration: 0.9, delay: 0.45 + i * 0.12 }}
                  />
                </span>
                <span className="text-right tabular-nums">{g.pct}%</span>
              </div>
            ))}
          </Rise>
        </>
      ),
    },
    {
      bg: "radial-gradient(70% 50% at 50% 35%, rgba(0,240,255,0.28), transparent 70%), #05070a",
      body: stats.topBeat ? (
        <>
          <Rise className={cn(kicker, "text-white/80")}>Il beat che hai consumato</Rise>
          <Rise delay={0.15} className="grid place-items-center">
            <BeatCover beat={stats.topBeat.beat} size="xl" playing />
          </Rise>
          <Rise delay={0.3} className="font-display text-4xl font-black text-white">
            {stats.topBeat.beat.title}
          </Rise>
          <Rise delay={0.4} className="text-chrome-300">
            {fmt(stats.topBeat.plays)} ascolti · {stats.topBeat.beat.bpm} BPM · {keyName(stats.topBeat.beat.key)} ({camelotCode(stats.topBeat.beat.key)})
          </Rise>
          {topBeat && (
            <Rise delay={0.5}>
              <button
                type="button"
                onClick={() => play(topBeat, [topBeat])}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-graphite"
              >
                <Play className="size-4 fill-current" /> Riascoltalo
              </button>
            </Rise>
          )}
        </>
      ) : (
        <>
          <Rise className={cn(kicker, "text-white/80")}>Il beat dell&apos;anno</Rise>
          <Rise delay={0.15} className={cn(big, "text-white")}>
            Ancora da trovare
          </Rise>
          <Rise delay={0.3}>
            <Link href="/beats/swipe" className="inline-flex h-12 items-center rounded-full bg-white px-6 font-semibold text-graphite">
              Cercalo in modalità Swipe
            </Link>
          </Rise>
        </>
      ),
    },
    {
      bg: "linear-gradient(180deg, #f6f7f9, #c9ced6 45%, #eef0f3)",
      light: true,
      body: (
        <>
          <Rise className={cn(kicker, "text-graphite-700")}>In numeri</Rise>
          <Rise delay={0.15} className="grid w-full grid-cols-2 gap-3 text-left">
            {[
              [fmt(profile.unlocked), profile.unlocked === 1 ? "beat sbloccato" : "beat sbloccati"],
              [String(stats.streak), stats.streak === 1 ? "giorno di fila (ora)" : "giorni di fila (ora)"],
              [String(stats.longestStreak), "la serie più lunga"],
              [`${badgeCount}/${badges.length}`, "badge"],
            ].map(([value, label]) => (
              <div key={label} className="glass rounded-3xl p-4">
                <b className="block font-display text-4xl font-black text-graphite">{value}</b>
                <span className="text-sm text-graphite-700">{label}</span>
              </div>
            ))}
          </Rise>
          <Rise delay={0.35} className="text-graphite-700">
            Livello Resident: <b style={{ color: profile.levelColor === "#e5f0ff" ? "#5b7fb0" : undefined }}>{profile.levelName}</b>
          </Rise>
        </>
      ),
    },
  ];

  const share = async (mode: "share" | "download") => {
    setBusy(mode);
    setNote(null);
    try {
      const blob = await renderPoster(profile, stats, year, badgeCount);
      const filename = `backrooms-wrapped-${year}.png`;
      if (mode === "download") {
        downloadBlob(blob, filename);
        setNote("Immagine scaricata: pubblicala nelle tue storie.");
      } else {
        const how = await shareOrDownload(blob, filename, `Il mio ${year} su Backrooms Beat Store`);
        if (how !== "canceled") recordAchievement("share");
        if (how === "downloaded") setNote("Il browser non condivide immagini: l'abbiamo scaricata.");
      }
    } finally {
      setBusy(null);
    }
  };

  slides.push({
    bg: "radial-gradient(60% 40% at 50% 10%, rgba(255,45,146,0.35), transparent 70%), radial-gradient(60% 40% at 50% 100%, rgba(0,102,255,0.45), transparent 70%), #05070a",
    body: (
      <>
        <Rise className="w-full rounded-[28px] border border-white/15 bg-white/5 p-5 text-left backdrop-blur" >
          <p className={cn(kicker, "text-electric-cyan")}>Backrooms Wrapped {year}</p>
          <p className="mt-1 truncate font-display text-4xl font-black text-white">{profile.artistName}</p>
          <dl className="mt-3 divide-y divide-white/10 text-[15px]">
            {[
              [`${listened.unit[0].toUpperCase()}${listened.unit.slice(1)} di ascolto`, listened.big],
              ["Produttore", stats.topProducer?.name ?? "—"],
              ["Genere", stats.topGenre?.name ?? "—"],
              ["Beat dell'anno", stats.topBeat?.beat.title ?? "—"],
              ["Beat sbloccati", fmt(profile.unlocked)],
              ["Serie più lunga", `${stats.longestStreak} gg`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-chrome-400">{label}</dt>
                <dd className="truncate font-bold text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </Rise>
        <Rise delay={0.2} className="grid w-full grid-cols-[1fr_1fr_auto] gap-2">
          <button
            type="button"
            onClick={() => void share("share")}
            disabled={busy !== null}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#3b82f6,#0066ff_55%,#0052cc)] px-4 text-sm font-semibold text-white shadow-glow-sm"
          >
            {busy === "share" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} Condividi
          </button>
          <button
            type="button"
            onClick={() => void share("download")}
            disabled={busy !== null}
            data-testid="wrapped-download"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-graphite"
          >
            {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Scarica PNG
          </button>
          <button
            type="button"
            onClick={() => setIndex(0)}
            aria-label="Rivedi dall'inizio"
            className="grid size-12 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20"
          >
            <RotateCcw className="size-4" />
          </button>
        </Rise>
        {note && (
          <p role="status" className="text-sm text-chrome-300">
            {note}
          </p>
        )}
      </>
    ),
  });

  const count = slides.length;
  const goTo = useCallback((i: number) => setIndex(Math.max(0, Math.min(count - 1, i))), [count]);
  const close = useCallback(() => router.push("/beats/libreria"), [router]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
      else if (e.key === "Escape") close();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goTo, close]);

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    wasHeld.current = false;
    holdTimer.current = setTimeout(() => {
      wasHeld.current = true;
      setHeld(true);
    }, 220);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setHeld(false);
    if (wasHeld.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    goTo(e.clientX - r.left < r.width / 3 ? index - 1 : index + 1);
  };

  const slide = slides[index];
  const autoAdvance = !reduceMotion && index < count - 1;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#05070a]" role="dialog" aria-modal="true" aria-label="Il tuo anno su Backrooms">
      <div
        className="wrapped-stage relative h-dvh w-full overflow-hidden sm:h-[min(100dvh-2rem,860px)] sm:w-auto sm:aspect-[9/16] sm:rounded-[32px] sm:shadow-glow-lg"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setHeld(false)}
        onContextMenu={(e) => e.preventDefault()}
        data-testid="wrapped"
        data-slide={index}
      >
        <div className="absolute inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 flex gap-1" aria-hidden>
          {slides.map((_, i) => (
            <span key={i} className={cn("h-[3px] flex-1 overflow-hidden rounded-full", slide.light ? "bg-graphite/15" : "bg-white/30")}>
              {i < index && <span className={cn("block h-full", slide.light ? "bg-graphite" : "bg-white")} />}
              {i === index && (
                <span
                  key={`${index}-run`}
                  className={cn("wrapped-bar block h-full", slide.light ? "bg-graphite" : "bg-white", autoAdvance ? "wrapped-bar-run" : "w-full")}
                  style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: held ? "paused" : "running" }}
                  onAnimationEnd={() => autoAdvance && goTo(index + 1)}
                />
              )}
            </span>
          ))}
        </div>
        <div className="absolute right-3 top-[calc(1.5rem+env(safe-area-inset-top))] z-10 flex items-center gap-2">
          <span className="sr-only" aria-live="polite">
            Storia {index + 1} di {count}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Chiudi"
            className={cn("grid size-10 place-items-center rounded-full backdrop-blur", slide.light ? "bg-black/10 text-graphite" : "bg-white/10 text-white")}
          >
            <X className="size-5" />
          </button>
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={index}
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-7 pb-16 pt-20 text-center"
            style={{ background: slide.bg }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {slide.body}
          </motion.div>
        </AnimatePresence>
        {index < count - 1 && (
          <p className={cn("absolute inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-10 text-center text-xs", slide.light ? "text-graphite-700" : "text-white/60")}>
            Tocca per andare avanti · tieni premuto per fermare
          </p>
        )}
      </div>
    </div>
  );
}
