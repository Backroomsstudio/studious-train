"use client";

import { Check, Loader2, Mail, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { feedback } from "@/lib/beats/ui-feedback";
import { api, ApiRequestError } from "../providers";
import { ChromeButton } from "../ui/chrome-button";

/** Iscrizione alla lista d'attesa: un'email e (se vuoi) il nome d'artista. */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [artistName, setArtistName] = useState("");
  const [state, setState] = useState<{ pending?: boolean; done?: boolean; error?: string }>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ pending: true });
    try {
      await api("/api/waitlist", { method: "POST", body: JSON.stringify({ email, artistName: artistName || undefined }) });
      feedback("pop");
      setState({ done: true });
    } catch (error) {
      feedback("error");
      setState({ error: error instanceof ApiRequestError ? error.message : "Errore di rete, riprova." });
    }
  };

  if (state.done) {
    return (
      <div role="status" className="glass flex items-start gap-4 rounded-[28px] p-6">
        <Check className="mt-0 size-5 shrink-0 text-ok" />
        <div>
          <p className="font-semibold">Sei in lista</p>
          <p className="mt-2 text-sm text-chrome-500">Ti scriviamo il giorno dell&apos;apertura. Niente spam, solo quello.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass space-y-4 rounded-[28px] p-6" aria-labelledby="lista-attesa">
      <div>
        <h2 id="lista-attesa" className="font-display text-xl font-semibold">Avvisami all&apos;apertura</h2>
        <p className="mt-2 text-sm text-chrome-500">Chi è in lista sente per primo i beat del giorno del lancio.</p>
      </div>
      <label className="chrome-surface flex h-12 items-center gap-4 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-electric/40">
        <Mail className="size-4 text-chrome-400" aria-hidden />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          aria-label="Email"
          placeholder="La tua email"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-chrome-400"
        />
      </label>
      <label className="chrome-surface flex h-12 items-center gap-4 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-electric/40">
        <UserRound className="size-4 text-chrome-400" aria-hidden />
        <input
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          maxLength={32}
          autoComplete="nickname"
          aria-label="Nome d'artista (facoltativo)"
          placeholder="Nome d'artista (facoltativo)"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-chrome-400"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-deal">
          {state.error}
        </p>
      )}
      <ChromeButton type="submit" variant="electric" size="lg" className="w-full" disabled={state.pending}>
        {state.pending ? <Loader2 className="size-4 animate-spin" /> : "Mettimi in lista"}
      </ChromeButton>
    </form>
  );
}
