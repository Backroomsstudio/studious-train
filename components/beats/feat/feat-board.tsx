"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { FEAT_ROLES, featRoleLabel, type FeatRole } from "@/lib/beats/feat";
import { genreColor } from "@/lib/beats/genres";
import type { FeatInbox, FeatPostSummary, TagRef } from "@/lib/beats/types";
import { Chip } from "../ui/chip";
import { ChromeButton, ChromeLink } from "../ui/chrome-button";
import { ChatDialog } from "./chat-dialog";
import { InboxPanel } from "./inbox-panel";
import { PostCard } from "./post-card";
import { PublishDialog, type FeatBeatOption } from "./publish-dialog";
import { ReportDialog, type ReportTarget } from "./report-dialog";
import { SIGN_IN_HREF, useFeatInbox, useFeatPosts, useOpenFeatThread } from "./use-feat";

/**
 * Bacheca "Cerco feat": filtri per ruolo e genere, annunci, pubblicazione, chat private
 * e casella "I tuoi messaggi". I dati iniziali arrivano dal server, poi si aggiorna da sola.
 */
export function FeatBoard({
  initialPosts,
  initialInbox,
  genres,
  beats,
  loggedIn,
}: {
  initialPosts: FeatPostSummary[];
  initialInbox: FeatInbox | undefined;
  genres: TagRef[];
  beats: FeatBeatOption[];
  loggedIn: boolean;
}) {
  const [role, setRole] = useState<FeatRole | "">("");
  const [genre, setGenre] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [inboxPost, setInboxPost] = useState<{ id: string; label: string } | null>(null);

  const filters = { ...(role ? { role } : {}), ...(genre ? { genre } : {}) };
  const posts = useFeatPosts(filters, initialPosts);
  const inbox = useFeatInbox({ initial: initialInbox });
  const open = useOpenFeatThread();
  const threads = inbox.data?.threads ?? [];

  const unreadFor = (post: FeatPostSummary) =>
    threads.filter((t) => t.post.id === post.id && (post.isMine || t.id === post.threadId)).reduce((sum, t) => sum + t.unread, 0);

  const reply = (post: FeatPostSummary) => {
    if (post.threadId) return setChatId(post.threadId);
    open.mutate(post.id, { onSuccess: (thread) => setChatId(thread.id) });
  };

  const showMessages = (post: FeatPostSummary) => {
    setInboxPost({ id: post.id, label: featRoleLabel(post.role) });
    document.getElementById("i-tuoi-messaggi")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const list = posts.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Community</p>
          <h1 className="chrome-text mt-1 font-display text-4xl font-black tracking-tight sm:text-5xl">Cerco feat</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-chrome-500">
            Trova chi canta, rappa o produce con te. Scrivi in privato a chi ti ispira: ogni collaborazione nasce qui e finisce in studio.
          </p>
        </div>
        {loggedIn ? (
          <ChromeButton variant="electric" onClick={() => setPublishing(true)} className="self-start sm:self-auto">
            <Plus className="size-4" /> Pubblica un annuncio
          </ChromeButton>
        ) : (
          <ChromeLink href={SIGN_IN_HREF} variant="electric" className="self-start sm:self-auto">
            Accedi per pubblicare
          </ChromeLink>
        )}
      </div>

      {notice && (
        <p role="status" className="rounded-2xl bg-ok/10 px-4 py-3 text-sm font-semibold text-ok">
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
          <div className="space-y-2">
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label="Cosa cercano">
              <Chip active={!role} onClick={() => setRole("")}>
                Tutti
              </Chip>
              {FEAT_ROLES.map((r) => (
                <Chip key={r.id} active={role === r.id} onClick={() => setRole(role === r.id ? "" : r.id)}>
                  {r.label}
                </Chip>
              ))}
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label="Genere">
              <Chip active={!genre} onClick={() => setGenre("")} className="h-8 px-3 text-xs">
                Ogni genere
              </Chip>
              {genres.map((g) => (
                <Chip
                  key={g.slug}
                  active={genre === g.slug}
                  accent={genreColor(g.slug)}
                  onClick={() => setGenre(genre === g.slug ? "" : g.slug)}
                  className="h-8 px-3 text-xs"
                >
                  <span aria-hidden className="size-2 rounded-full" style={{ background: genreColor(g.slug) }} />
                  {g.name}
                </Chip>
              ))}
            </div>
          </div>

          {open.error && (
            <p role="alert" className="rounded-2xl bg-deal/10 px-4 py-3 text-sm font-semibold text-deal">
              {open.error.message}
            </p>
          )}

          <div className={cn("grid grid-cols-1 gap-3 transition-opacity", posts.isPlaceholderData && "opacity-60")} aria-busy={posts.isFetching}>
            {list.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                loggedIn={loggedIn}
                unread={unreadFor(post)}
                onReply={reply}
                replying={open.isPending && open.variables === post.id}
                onShowMessages={showMessages}
                onReport={(p) => setReport({ postId: p.id, label: `Annuncio di ${p.author.name}` })}
              />
            ))}
            {!list.length &&
              (posts.isLoading ? (
                <div className="glass grid h-32 place-items-center rounded-[26px] text-chrome-500">
                  <Loader2 className="size-5 animate-spin" aria-label="Caricamento" />
                </div>
              ) : (
                <p className="glass rounded-[26px] p-5 text-sm text-chrome-500">Nessun annuncio con questi filtri: pubblica tu il primo!</p>
              ))}
          </div>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
          <InboxPanel
            threads={threads}
            unread={inbox.data?.unread ?? 0}
            loggedIn={loggedIn}
            postFilter={inboxPost}
            onClearFilter={() => setInboxPost(null)}
            onOpen={setChatId}
          />
        </aside>
      </div>

      {loggedIn && (
        <PublishDialog
          open={publishing}
          onOpenChange={setPublishing}
          genres={genres}
          beats={beats}
          onPublished={() => {
            setPublishing(false);
            setRole("");
            setGenre("");
            setNotice("Annuncio pubblicato: le risposte arrivano in “I tuoi messaggi”.");
          }}
        />
      )}
      <ChatDialog
        threadId={chatId}
        onOpenChange={(o) => !o && setChatId(null)}
        onReport={(target) => {
          // Una finestra alla volta: la chat si chiude e lascia il posto alla segnalazione.
          setChatId(null);
          setReport({ ...target, label: target.messageId ? "Ultimo messaggio ricevuto in questa chat" : "Annuncio di questa chat" });
        }}
      />
      <ReportDialog target={report} onClose={() => setReport(null)} />
    </div>
  );
}
