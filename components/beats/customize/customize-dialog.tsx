"use client";

import { motion } from "motion/react";
import { Check, CircleCheck, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  CUSTOMIZATION_BASE_CREDITS,
  CUSTOMIZATION_DAYS,
  CUSTOMIZATION_EXPRESS_CREDITS,
  CUSTOMIZATION_EXPRESS_DAYS,
  CUSTOMIZATION_NOTES_MAX,
  CUSTOMIZATION_OPTIONS,
  customizationCost,
  customizationDueDate,
  type CustomizationOption,
} from "@/lib/beats/customizations";
import { formatDay, pluralCredits } from "@/lib/beats/format";
import { camelotCode, keyName } from "@/lib/beats/music";
import type { CustomizationSummary } from "@/lib/beats/types";
import { ApiRequestError, useCustomize, useCustomizeDialog, useViewer } from "../providers";
import { BeatCover } from "../ui/beat-cover";
import { ChromeButton, ChromeLink } from "../ui/chrome-button";
import { Dialog } from "../ui/dialog";

/**
 * Personalizzazione su richiesta: l'artista sceglie le modifiche, vede costo e data di consegna,
 * paga in crediti. Il produttore riceve la richiesta e consegna in Libreria.
 */
export function CustomizeDialog() {
  const beat = useCustomizeDialog((s) => s.beat);
  const close = useCustomizeDialog((s) => s.close);
  const { data: viewer } = useViewer();
  const customize = useCustomize();
  const [options, setOptions] = useState<CustomizationOption[]>(["KEY"]);
  const [express, setExpress] = useState(false);
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [done, setDone] = useState<CustomizationSummary | null>(null);

  useEffect(() => {
    if (!beat) return;
    setOptions(["KEY"]);
    setExpress(false);
    setNotes("");
    setReference("");
    setDone(null);
    customize.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinizializza solo quando cambia il beat
  }, [beat?.id]);

  if (!beat) return null;

  const cost = customizationCost(options, express);
  const balance = viewer?.creditBalance ?? 0;
  const short = balance < cost;
  const due = customizationDueDate(new Date(), express);
  const error = customize.error instanceof ApiRequestError ? customize.error : null;
  const toggle = (id: CustomizationOption) =>
    setOptions((list) => (list.includes(id) ? list.filter((o) => o !== id) : [...list, id]));

  const submit = () =>
    customize.mutate(
      { beatId: beat.id, options, express, notes, referenceUrl: reference || undefined },
      { onSuccess: (r) => setDone(r.request) },
    );

  return (
    <Dialog
      open={Boolean(beat)}
      onOpenChange={(open) => !open && close()}
      title={done ? "Richiesta inviata" : "Personalizza questo beat"}
      description={
        done
          ? `${beat.producers[0]?.name ?? "Il produttore"} ci lavora e te la consegna in Libreria entro il ${formatDay(done.dueAt)}.`
          : `Il produttore rifà ${beat.title} su misura per te. Include una WAV Lease della versione personalizzata.`
      }
    >
      <div className="flex items-center gap-4">
        <BeatCover beat={beat} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold">{beat.title}</p>
          <p className="truncate text-sm text-chrome-500">
            {beat.producers.map((p) => p.name).join(" & ")} · {beat.bpm} BPM · {keyName(beat.key)} ({camelotCode(beat.key)})
          </p>
        </div>
      </div>

      {done ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
          <div className="flex items-center gap-4 rounded-2xl bg-ok/10 p-4 text-ok">
            <CircleCheck className="size-7" />
            <div className="text-sm">
              <p className="font-semibold">{pluralCredits(done.creditsSpent)} scalati</p>
              <p className="text-ok/80">Saldo: {pluralCredits(viewer?.creditBalance ?? 0)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <ChromeLink href="/beats/profilo" variant="ghost" onClick={close}>
              Segui la richiesta
            </ChromeLink>
            <ChromeButton variant="obsidian" className="ml-auto" onClick={close}>
              Fatto
            </ChromeButton>
          </div>
        </motion.div>
      ) : (
        <div className="mt-6 space-y-4">
          <fieldset>
            <legend className="mb-2 text-[11px] font-semibold text-chrome-500">Cosa vuoi cambiare</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CUSTOMIZATION_OPTIONS.map((o) => {
                const on = options.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(o.id)}
                    className={cn(
                      "flex items-start gap-4 rounded-2xl p-4 text-left transition",
                      on ? "bg-white ring-2 ring-electric" : "chrome-surface",
                    )}
                  >
                    <span className={cn("mt-0 grid size-5 shrink-0 place-items-center rounded-md border-2", on ? "border-electric bg-electric text-white" : "border-chrome-300")}>
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{o.name}</span>
                      <span className="block text-xs text-chrome-500">{o.detail}</span>
                    </span>
                    <span className="text-xs font-semibold text-electric">+{o.credits}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold text-chrome-500">Spiegaci cosa ti serve</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={CUSTOMIZATION_NOTES_MAX}
              rows={3}
              placeholder="Es. abbassalo a Sol minore, ritornello di 16 battute, 808 più corto sulle strofe."
              className="glass w-full resize-none rounded-2xl p-4 text-[15px] outline-none focus:ring-2 focus:ring-electric/50"
            />
            <span className="mt-2 block text-right text-[11px] text-chrome-400">
              {notes.length}/{CUSTOMIZATION_NOTES_MAX}
            </span>
          </label>

          <label className="glass flex h-12 items-center gap-4 rounded-2xl px-4">
            <span className="sr-only">Link di riferimento</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              type="url"
              inputMode="url"
              placeholder="Link di riferimento (facoltativo): Spotify, YouTube…"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
          </label>

          <button
            type="button"
            aria-pressed={express}
            onClick={() => setExpress((e) => !e)}
            className={cn("flex w-full items-center gap-4 rounded-2xl p-4 text-left transition", express ? "bg-white ring-2 ring-electric" : "chrome-surface")}
          >
            <Clock className={cn("size-5", express ? "text-electric" : "text-chrome-400")} />
            <span className="flex-1">
              <span className="block text-sm font-semibold">Consegna express</span>
              <span className="block text-xs text-chrome-500">
                {CUSTOMIZATION_EXPRESS_DAYS} giorni lavorativi invece di {CUSTOMIZATION_DAYS}
              </span>
            </span>
            <span className="text-xs font-semibold text-electric">+{CUSTOMIZATION_EXPRESS_CREDITS}</span>
          </button>

          <div className="obsidian grid grid-cols-3 items-center rounded-2xl p-4 text-center">
            <div>
              <p className="text-[11px] text-chrome-400">Costo</p>
              <p className="mt-2 font-display text-xl font-semibold tabular-nums text-electric-cyan">{cost}</p>
            </div>
            <div>
              <p className="text-[11px] text-chrome-400">Dopo</p>
              <p className={cn("mt-2 font-display text-xl font-semibold tabular-nums", short && "text-deal")}>{balance - cost}</p>
            </div>
            <div>
              <p className="text-[11px] text-chrome-400">Consegna</p>
              <p className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
                <Clock className="size-3.5" /> {formatDay(due.toISOString())}
              </p>
            </div>
          </div>
          <p className="text-xs text-chrome-500">
            Prezzo: {CUSTOMIZATION_BASE_CREDITS} crediti di base (lavoro del produttore e WAV Lease) più le modifiche scelte.
          </p>

          {error && error.code !== "INSUFFICIENT_CREDITS" && (
            <p role="alert" className="rounded-xl bg-deal/10 p-4 text-sm text-deal">
              {error.message}
            </p>
          )}

          {!viewer ? (
            <ChromeLink href="/beats/accedi" variant="electric" size="lg" className="w-full" onClick={close}>
              Accedi per personalizzare
            </ChromeLink>
          ) : short || error?.code === "INSUFFICIENT_CREDITS" ? (
            <ChromeLink href="/beats/piani" variant="electric" size="lg" className="w-full" onClick={close}>
              Ricarica crediti
            </ChromeLink>
          ) : (
            <ChromeButton
              variant="electric"
              size="lg"
              className="w-full"
              disabled={customize.isPending || !options.length || notes.trim().length < 10}
              onClick={submit}
            >
              {customize.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Richiedi con {pluralCredits(cost)}
                </>
              )}
            </ChromeButton>
          )}
          {viewer && notes.trim().length < 10 && (
            <p className="text-center text-xs text-chrome-400">Scrivi almeno 10 caratteri per descrivere la modifica.</p>
          )}
          <p className="text-center text-xs text-chrome-400">
            Hai domande prima di richiedere?{" "}
            <Link href="/#contatti" className="font-semibold text-electric" onClick={close}>
              Scrivici
            </Link>
          </p>
        </div>
      )}
    </Dialog>
  );
}
