"use client";

import { ArrowRight, Flag, Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { FEAT, featRoleLabel } from "@/lib/beats/feat";
import type { FeatMessageItem } from "@/lib/beats/types";
import { ChromeButton, ChromeLink } from "../ui/chrome-button";
import { Dialog } from "../ui/dialog";
import { ArtistAvatar, LevelPill, TimeAgo } from "./feat-ui";
import { useFeatThread, useSendFeatMessage } from "./use-feat";

/** Chat privata con bolle, aggiornata ogni ~4 secondi; il messaggio inviato compare subito. */
export function ChatDialog({
  threadId,
  onOpenChange,
  onReport,
}: {
  threadId: string | null;
  onOpenChange: (open: boolean) => void;
  onReport: (target: { messageId?: string; postId?: string }) => void;
}) {
  const { data: thread, error } = useFeatThread(threadId);
  const send = useSendFeatMessage(threadId ?? "");
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const count = thread?.messages.length ?? 0;

  // Nuovi messaggi: la chat scorre in fondo.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [count, threadId]);

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const body = text.trim();
    if (!body || send.isPending) return;
    setText("");
    send.mutate(body, { onError: () => setText(body) });
  };

  const fromOther = thread?.messages.filter((m) => !m.mine) ?? [];
  const lastMine = [...(thread?.messages ?? [])].reverse().find((m) => m.mine) as (FeatMessageItem & { pending?: boolean }) | undefined;

  return (
    <Dialog
      open={Boolean(threadId)}
      onOpenChange={onOpenChange}
      className="sm:w-[min(600px,calc(100vw-2rem))]"
      title={
        thread ? (
          <span className="flex items-center gap-3">
            <ArtistAvatar artist={thread.other} size="sm" />
            <span className="min-w-0">
              <span className="block truncate">{thread.other.name}</span>
              <span className="mt-0.5 block">
                <LevelPill level={thread.other.level} />
              </span>
            </span>
          </span>
        ) : (
          "Chat"
        )
      }
      description={thread ? `${featRoleLabel(thread.post.role)}${thread.post.beatTitle ? ` · ${thread.post.beatTitle}` : ""}` : "Caricamento…"}
    >
      {!thread ? (
        <div className="grid h-40 place-items-center text-chrome-500">
          {error ? <p className="text-sm text-deal">{error.message}</p> : <Loader2 className="size-5 animate-spin" aria-label="Caricamento" />}
        </div>
      ) : (
        <div className="space-y-3">
          <blockquote className="chrome-surface rounded-2xl px-4 py-3 text-[13px] leading-relaxed text-graphite-700">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-chrome-500">
              {thread.isAuthor ? "Il tuo annuncio" : `Annuncio di ${thread.other.name}`}
              {thread.post.status === "CLOSED" && " · chiuso"}
            </span>
            {thread.post.text}
          </blockquote>

          <ol ref={listRef} className="feat-chat no-scrollbar" aria-live="polite" aria-label="Messaggi">
            {thread.messages.map((m) => (
              <li key={m.id} className={cn("feat-bubble", m.mine ? "feat-bubble-me" : "feat-bubble-them", (m as { pending?: boolean }).pending && "opacity-70")}>
                <span className="whitespace-pre-line break-words">{m.body}</span>
                <TimeAgo iso={m.createdAt} className="feat-bubble-time" />
              </li>
            ))}
            {!thread.messages.length && (
              <li className="py-6 text-center text-sm text-chrome-500">
                {thread.isAuthor ? "Ancora nessun messaggio." : `Presentati: chi sei, cosa fai e un link a un tuo pezzo. ${thread.other.name} ti risponde qui.`}
              </li>
            )}
          </ol>
          {lastMine && (
            <p className="-mt-1 text-right text-[11px] text-chrome-500">
              {lastMine.pending ? "Invio…" : lastMine.readAt ? "Letto" : "Inviato"}
            </p>
          )}

          {fromOther.length > 0 && (
            <ChromeLink href="/beats/studio" variant="chrome" className="h-auto w-full justify-between rounded-2xl px-4 py-3 text-left">
              <span>
                <span className="block text-sm font-bold">Registrate il pezzo insieme</span>
                <span className="block text-xs font-normal text-chrome-500">Sessione al Backrooms Studio con mix e master</span>
              </span>
              <ArrowRight className="size-4 shrink-0" />
            </ChromeLink>
          )}

          <form onSubmit={submit} className="space-y-2">
            <label className="sr-only" htmlFor="feat-chat-text">
              Scrivi a {thread.other.name}
            </label>
            <textarea
              id="feat-chat-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
              }}
              maxLength={FEAT.messageMax}
              rows={2}
              placeholder={`Scrivi a ${thread.other.name}…`}
              className="chrome-surface min-h-[4.5rem] w-full resize-none rounded-2xl px-4 py-3 text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-electric/40"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onReport(fromOther.length ? { messageId: fromOther.at(-1)!.id } : { postId: thread.post.id })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-chrome-500 hover:text-deal"
              >
                <Flag className="size-3.5" /> Segnala
              </button>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-chrome-400">
                {text.length}/{FEAT.messageMax}
              </span>
              <ChromeButton type="submit" variant="electric" disabled={!text.trim() || send.isPending} aria-label="Invia">
                <Send className="size-4" /> Invia
              </ChromeButton>
            </div>
            {send.error && (
              <p role="alert" className="text-sm text-deal">
                {send.error.message}
              </p>
            )}
          </form>
        </div>
      )}
    </Dialog>
  );
}
