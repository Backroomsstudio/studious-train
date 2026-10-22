"use client";

import { Inbox, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { featRoleLabel } from "@/lib/beats/feat";
import type { FeatThreadSummary } from "@/lib/beats/types";
import { ChromeLink } from "../ui/chrome-button";
import { ArtistAvatar, TimeAgo } from "./feat-ui";
import { SIGN_IN_HREF } from "./use-feat";

/** "I tuoi messaggi": chat come autore e come chi ha risposto, con i non letti. */
export function InboxPanel({
  threads,
  unread,
  loggedIn,
  postFilter,
  onClearFilter,
  onOpen,
}: {
  threads: FeatThreadSummary[];
  unread: number;
  loggedIn: boolean;
  /** Mostra solo le chat di un annuncio (dal pulsante "I tuoi messaggi" della scheda). */
  postFilter: { id: string; label: string } | null;
  onClearFilter: () => void;
  onOpen: (threadId: string) => void;
}) {
  const shown = postFilter ? threads.filter((t) => t.post.id === postFilter.id) : threads;
  return (
    <section id="i-tuoi-messaggi" aria-labelledby="feat-inbox-title" className="glass scroll-mt-24 rounded-[28px] p-4 sm:p-5">
      <h2 id="feat-inbox-title" className="flex items-center gap-2 font-display text-lg font-bold">
        <Inbox aria-hidden className="size-5 text-electric" /> I tuoi messaggi
        {unread > 0 && (
          <span className="feat-count" aria-label={`${unread} non letti`}>
            {unread}
          </span>
        )}
      </h2>

      {postFilter && (
        <button type="button" onClick={onClearFilter} className="chrome-surface mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold">
          <span className="truncate">Solo: {postFilter.label}</span>
          <X aria-hidden className="size-3.5 shrink-0" />
          <span className="sr-only">Mostra tutte le chat</span>
        </button>
      )}

      {!loggedIn ? (
        <div className="mt-3 space-y-3 text-sm text-chrome-500">
          <p>Accedi per scrivere agli artisti e ricevere le risposte ai tuoi annunci.</p>
          <ChromeLink href={SIGN_IN_HREF} variant="electric" size="sm">
            Accedi
          </ChromeLink>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-chrome-500">
          {postFilter ? "Nessuno ha ancora risposto a questo annuncio." : "Qui trovi le chat con chi risponde ai tuoi annunci e con gli artisti a cui scrivi."}
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {shown.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpen(t.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-white/70",
                  t.unread > 0 && "bg-electric/[0.06]",
                )}
              >
                <ArtistAvatar artist={t.other} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("truncate text-sm", t.unread > 0 ? "font-bold" : "font-semibold")}>{t.other.name}</span>
                    <TimeAgo iso={t.updatedAt} className="ml-auto shrink-0 text-[11px] text-chrome-500" />
                  </span>
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-chrome-400">
                    {t.isAuthor ? "Ha risposto al tuo annuncio" : featRoleLabel(t.post.role)}
                  </span>
                  <span className={cn("block truncate text-[13px]", t.unread > 0 ? "text-graphite" : "text-chrome-500")}>
                    {t.last ? `${t.last.mine ? "Tu: " : ""}${t.last.body}` : ""}
                  </span>
                </span>
                {t.unread > 0 && (
                  <span className="feat-count" aria-label={`${t.unread} non letti`}>
                    {t.unread}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
