"use client";

import { Flag, Loader2, MessageCircle, Pause, Play, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { featRoleLabel } from "@/lib/beats/feat";
import type { FeatPostSummary } from "@/lib/beats/types";
import { usePlayer } from "../player/player-store";
import { BeatCover } from "../ui/beat-cover";
import { ChromeButton, ChromeLink } from "../ui/chrome-button";
import { GlowBadge } from "../ui/glow-badge";
import { ArtistAvatar, LevelPill, TimeAgo } from "./feat-ui";
import { SIGN_IN_HREF, useCloseFeatPost } from "./use-feat";

/** Scheda di un annuncio: autore, cosa cerca, beat (ascoltabile), risposte e azioni. */
export function PostCard({
  post,
  loggedIn,
  unread,
  onReply,
  replying,
  onShowMessages,
  onReport,
}: {
  post: FeatPostSummary;
  loggedIn: boolean;
  /** Non letti nelle chat di questo annuncio (per l'autore) o nella propria chat. */
  unread: number;
  onReply: (post: FeatPostSummary) => void;
  replying: boolean;
  onShowMessages: (post: FeatPostSummary) => void;
  onReport: (post: FeatPostSummary) => void;
}) {
  const close = useCloseFeatPost();
  const [confirming, setConfirming] = useState(false);
  const toggle = usePlayer((s) => s.toggle);
  const playing = usePlayer((s) => s.playing && s.current?.id === post.beat?.id);
  const closed = post.status === "CLOSED";

  // La conferma di chiusura torna indietro da sola dopo qualche secondo.
  useEffect(() => {
    if (!confirming) return;
    const id = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(id);
  }, [confirming]);

  return (
    <article className={cn("feat-card glass grid grid-cols-1 gap-3 rounded-[26px] p-4 sm:p-5", post.isMine && "ring-1 ring-electric/25", closed && "opacity-75")}>
      <header className="flex items-start gap-3">
        <ArtistAvatar artist={post.author} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-display text-[15px] font-bold">{post.author.name}</span>
            <LevelPill level={post.author.level} />
            {post.isMine && <GlowBadge tone="ok">Il tuo annuncio</GlowBadge>}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-chrome-500">
            {[post.city, post.genre?.name].filter(Boolean).join(" · ")}
            {(post.city || post.genre) && " · "}
            <TimeAgo iso={post.createdAt} />
          </p>
        </div>
        <GlowBadge tone={closed ? "chrome" : "studio"} className="shrink-0">
          {closed ? "Chiuso" : featRoleLabel(post.role)}
        </GlowBadge>
      </header>

      <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-graphite-800">{post.text}</p>

      {post.beat && (
        <div className="chrome-surface flex items-center gap-3 rounded-2xl p-2 pr-3">
          <Link href={`/beats/${post.beat.slug}`} className="shrink-0" aria-label={`Apri ${post.beat.title}`}>
            <BeatCover beat={post.beat} size="sm" playing={playing} />
          </Link>
          <Link href={`/beats/${post.beat.slug}`} className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{post.beat.title}</span>
            <span className="block truncate text-xs text-chrome-500">
              {post.beat.bpm} BPM · {post.beat.producers.map((p) => p.name).join(" & ")}
            </span>
          </Link>
          <ChromeButton
            size="icon"
            variant={playing ? "electric" : "chrome"}
            onClick={() => toggle(post.beat!)}
            aria-label={playing ? `Metti in pausa ${post.beat.title}` : `Ascolta ${post.beat.title}`}
          >
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          </ChromeButton>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-2">
        <span className="mr-auto inline-flex items-center gap-1.5 text-[13px] text-chrome-500">
          <MessageCircle aria-hidden className="size-4" />
          {post.replyCount === 0 ? "Nessuna risposta" : post.replyCount === 1 ? "1 risposta" : `${post.replyCount} risposte`}
        </span>

        {post.isMine ? (
          <>
            <ChromeButton size="sm" variant="obsidian" onClick={() => onShowMessages(post)}>
              I tuoi messaggi
              {unread > 0 && <span className="feat-count">{unread}</span>}
            </ChromeButton>
            {!closed && (
              <ChromeButton
                size="sm"
                variant={confirming ? "electric" : "ghost"}
                disabled={close.isPending}
                onClick={() => (confirming ? close.mutate(post.id, { onSettled: () => setConfirming(false) }) : setConfirming(true))}
              >
                {close.isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                {confirming ? "Sì, chiudi" : "Chiudi annuncio"}
              </ChromeButton>
            )}
          </>
        ) : loggedIn ? (
          <>
            <ChromeButton
              size="icon"
              variant="ghost"
              className="size-9"
              onClick={() => onReport(post)}
              aria-label={`Segnala l'annuncio di ${post.author.name}`}
              title="Segnala"
            >
              <Flag className="size-4" />
            </ChromeButton>
            <ChromeButton size="sm" variant="obsidian" disabled={replying || (closed && !post.threadId)} onClick={() => onReply(post)}>
              {replying ? <Loader2 className="size-4 animate-spin" /> : null}
              {post.threadId ? "Apri chat" : "Rispondi"}
              {unread > 0 && <span className="feat-count">{unread}</span>}
            </ChromeButton>
          </>
        ) : (
          <ChromeLink href={SIGN_IN_HREF} size="sm" variant="obsidian">
            Accedi per rispondere
          </ChromeLink>
        )}
      </footer>
      {close.error && (
        <p role="alert" className="text-sm text-deal">
          {close.error.message}
        </p>
      )}
    </article>
  );
}
