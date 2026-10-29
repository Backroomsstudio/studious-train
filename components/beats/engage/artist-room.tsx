"use client";

import { Check, Mic, Pencil, Send, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useListeningLog, useListeningStats } from "@/lib/beats/listening-log";
import { ROOM_THEMES, roomTheme, useRoom, useRoomStore } from "@/lib/beats/room";
import { useSavedBeats } from "@/lib/beats/saved";
import type { BeatSummary, LevelInfo } from "@/lib/beats/types";
import { useHydrated } from "@/lib/beats/use-hydrated";
import { TrackList } from "../marketplace/track-row";
import { ChromeButton, ChromeLink } from "../ui/chrome-button";
import { BadgesGrid } from "./badges-grid";
import { MembershipPass } from "./membership-pass";

export interface RoomProfile {
  artistName: string;
  level: LevelInfo;
  planName: string | null;
  library: BeatSummary[];
}

const handleOf = (name: string) => name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "") || "artista";

/**
 * "La tua stanza": il profilo pubblico dell'artista come una stanza delle Backrooms.
 * Tema e bio restano nel browser; beat sbloccati e livello arrivano dal server.
 */
export function ArtistRoom({ profile }: { profile: RoomProfile }) {
  const { theme, bio } = useRoom();
  const setTheme = useRoomStore((s) => s.setTheme);
  const setBio = useRoomStore((s) => s.setBio);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const stats = useListeningStats();
  const saved = useSavedBeats();
  const current = roomTheme(theme);
  const dark = current.tone === "dark";
  const hydrated = useHydrated();
  const log = useListeningLog((st) => st.log);
  // "Del momento": i più ascoltati tra quelli di cui abbiamo il riepilogo (libreria o salvati), poi i salvati.
  const known = new Map([...saved, ...profile.library].map((b) => [b.id, b]));
  const listened = hydrated
    ? Object.values(log.beats)
        .sort((x, y) => y.seconds - x.seconds)
        .map((r) => known.get(r.beat.id))
        .filter((b): b is BeatSummary => Boolean(b))
    : [];
  const favourites = [...listened, ...saved].filter((b, i, all) => all.findIndex((x) => x.id === b.id) === i).slice(0, 3);

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="room-name"
        className={cn("room-hero relative isolate grid min-h-[20rem] content-end gap-4 overflow-hidden rounded-[32px] p-6 sm:p-8", `room-t-${current.id}`, dark ? "text-white" : "text-[#15120a]")}
        data-theme={current.id}
        data-testid="room-hero"
      >
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden
            className={cn("grid size-16 shrink-0 place-items-center rounded-2xl font-display text-3xl font-semibold ring-1", dark ? "bg-white/10 ring-white/25" : "bg-white/50 ring-black/10")}
          >
            {profile.artistName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className={cn("truncate text-xs", dark ? "text-white/70" : "text-black/60")}>backrooms.studio/@{handleOf(profile.artistName)}</p>
            <h1 id="room-name" className="truncate font-display text-[clamp(2.4rem,9vw,4rem)] font-semibold leading-none tracking-tight">
              {profile.artistName}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full px-4 py-2 text-xs font-semibold text-graphite" style={{ background: profile.level.color }}>
            Resident {profile.level.name}
          </span>
          {profile.planName && <span className={cn("rounded-full px-4 py-2 text-xs font-semibold", dark ? "bg-white/15" : "bg-white/60")}>{profile.planName}</span>}
        </div>
        {editing ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              setBio(draft);
              setEditing(false);
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">La tua bio</span>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={160}
                rows={2}
                autoFocus
                placeholder="Chi sei, che musica fai, dove ti trovano."
                className="w-full resize-none rounded-2xl bg-white/90 p-4 text-sm text-graphite outline-none ring-1 ring-black/10"
              />
            </label>
            <ChromeButton type="submit" size="sm" className="self-start">
              <Check className="size-4" /> Salva
            </ChromeButton>
          </form>
        ) : (
          <div className="flex items-start gap-2">
            <p className={cn("max-w-prose text-sm", !bio && "opacity-75")}>{bio || "Scrivi due righe su di te: chi sei, che musica fai."}</p>
            <button
              type="button"
              onClick={() => (setDraft(bio), setEditing(true))}
              aria-label="Modifica la bio"
              className={cn("grid size-8 shrink-0 place-items-center rounded-full", dark ? "bg-white/15" : "bg-white/60")}
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="room-themes" className="space-y-2">
        <h2 id="room-themes" className="font-display text-lg font-semibold">
          Ambiente <span className="text-chrome-400">· {current.name}</span>
        </h2>
        <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label="Tema della stanza">
          {ROOM_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === current.id}
              onClick={() => setTheme(t.id)}
              data-testid={`room-theme-${t.id}`}
              className={cn(
                `room-t-${t.id}`,
                "relative isolate flex h-20 flex-col justify-end overflow-hidden rounded-2xl p-4 text-left ring-2 transition",
                t.tone === "dark" ? "text-white" : "text-[#15120a]",
                t.id === current.id ? "ring-electric" : "ring-transparent",
              )}
            >
              <span className="text-sm font-semibold">{t.name}</span>
              <span className="truncate text-[11px] opacity-75">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [profile.library.length, profile.library.length === 1 ? "beat sbloccato" : "beat sbloccati"],
          [stats.hours, "ore di ascolto"],
          [stats.plays, "ascolti"],
          [stats.longestStreak, "giorni di fila"],
        ].map(([value, label]) => (
          <div key={label} className="glass rounded-2xl p-4">
            <b className="block font-display text-3xl font-semibold">{Number(value).toLocaleString("it-IT")}</b>
            <span className="text-xs text-chrome-500">{label}</span>
          </div>
        ))}
      </div>

      <section aria-labelledby="room-favs" className="space-y-2">
        <h2 id="room-favs" className="font-display text-xl font-semibold">I miei beat del momento</h2>
        {favourites.length ? (
          <TrackList beats={favourites} />
        ) : (
          <p className="glass rounded-2xl p-6 text-sm text-chrome-500">
            Ascolta e salva qualche beat: qui compaiono i tuoi preferiti.{" "}
            <Link href="/beats/swipe" className="font-semibold text-electric">
              Apri la modalità Swipe
            </Link>
          </p>
        )}
      </section>

      <section aria-labelledby="room-releases" className="space-y-2">
        <h2 id="room-releases" className="font-display text-xl font-semibold">Pezzi e demo</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li className="glass flex items-center gap-4 rounded-2xl p-4">
            <span className="chrome-surface grid size-11 shrink-0 place-items-center rounded-xl">
              <Mic className="size-5 text-electric" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Le tue demo</span>
              <span className="block text-[13px] text-chrome-500">Registra una voce su un beat: le demo compariranno qui.</span>
            </span>
          </li>
          <li className="glass flex items-center gap-4 rounded-2xl p-4">
            <span className="chrome-surface grid size-11 shrink-0 place-items-center rounded-xl">
              <Send className="size-5 text-studio" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Pezzi usciti</span>
              <span className="block text-[13px] text-chrome-500">Il tuo primo pezzo non è ancora fuori.</span>
            </span>
            <ChromeLink href="/beats/registra#servizi" size="sm">
              Studio
            </ChromeLink>
          </li>
        </ul>
      </section>

      <section aria-labelledby="room-library" className="space-y-2">
        <h2 id="room-library" className="font-display text-xl font-semibold">
          Beat sbloccati <span className="text-chrome-400">· {profile.library.length}</span>
        </h2>
        {profile.library.length ? (
          <TrackList beats={profile.library} />
        ) : (
          <p className="glass rounded-2xl p-6 text-sm text-chrome-500">
            Ancora nessuno.{" "}
            <Link href="/beats/cerca" className="font-semibold text-electric">
              Esplora il catalogo
            </Link>
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] [&>*]:min-w-0">
        <BadgesGrid unlocked={profile.library.length} title="Bacheca badge" />
        <div className="space-y-4">
          <MembershipPass />
          <ChromeLink href="/beats/wrapped" variant="obsidian" className="w-full">
            <CalendarDays className="size-4" /> Il tuo anno su Backrooms
          </ChromeLink>
        </div>
      </div>
    </div>
  );
}
