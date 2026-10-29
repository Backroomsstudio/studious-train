"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, CircleCheck, Download, Loader2, Lock, SlidersHorizontal, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { pluralCredits } from "@/lib/beats/format";
import { allowedLicenses } from "@/lib/beats/ledger-rules";
import { creditCost, LICENSE_ORDER, LICENSES, type LicenseType } from "@/lib/beats/licenses";
import { camelotCode, keyName } from "@/lib/beats/music";
import { cheapestPlanFor } from "@/lib/beats/plans";
import type { UnlockResponse } from "@/lib/beats/types";
import { usePlayer } from "../player/player-store";
import { ApiRequestError, useCustomizeDialog, useUnlock, useUnlockDialog, useViewer } from "../providers";
import { BeatCover } from "../ui/beat-cover";
import { ChromeButton, ChromeLink } from "../ui/chrome-button";
import { Dialog } from "../ui/dialog";
import { CreditCost, GlowBadge } from "../ui/glow-badge";

const ASSET_LABELS = { MP3: "MP3 320 kbps", WAV: "WAV 24 bit", STEMS: "Stems (ZIP)" } as const;

/**
 * Flusso di sblocco in tre stati: scelta della licenza → conferma con saldo prima/dopo →
 * download. Il saldo mostrato arriva dal server e viene aggiornato con la risposta dello sblocco.
 */
export function UnlockDialog() {
  const beat = useUnlockDialog((s) => s.beat);
  const close = useUnlockDialog((s) => s.close);
  const { data: viewer } = useViewer();
  const unlock = useUnlock();
  const [selected, setSelected] = useState<LicenseType>("WAV_LEASE");
  const [result, setResult] = useState<UnlockResponse | null>(null);
  const toggle = usePlayer((s) => s.toggle);
  const openCustomize = useCustomizeDialog((s) => s.open);

  useEffect(() => {
    if (!beat) return;
    setResult(null);
    unlock.reset();
    const owned = viewer?.owned[beat.id] ?? [];
    const allowed = allowedLicenses(viewer?.plan?.tier ?? null);
    setSelected(
      LICENSE_ORDER.find((t) => allowed.includes(t) && !owned.includes(t) && t === "WAV_LEASE") ??
        LICENSE_ORDER.find((t) => allowed.includes(t) && !owned.includes(t)) ??
        "MP3_LEASE",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinizializza solo quando cambia il beat
  }, [beat?.id]);

  if (!beat) return null;

  const owned = viewer?.owned[beat.id] ?? [];
  const tier = viewer?.plan?.tier ?? null;
  const allowed = allowedLicenses(tier);
  const balance = viewer?.creditBalance ?? 0;
  const discount = beat.deal?.discountPct;
  const cost = creditCost(selected, discount);
  const isOwned = owned.includes(selected);
  const missingPlan = !allowed.includes(selected);
  const insufficient = !isOwned && balance < cost;
  const needsStems = LICENSES[selected].assets.includes("STEMS");
  const error = unlock.error instanceof ApiRequestError ? unlock.error : null;

  const confirm = () =>
    unlock.mutate({ beatId: beat.id, license: selected }, { onSuccess: (data) => setResult(data) });

  return (
    <Dialog
      open={Boolean(beat)}
      onOpenChange={(open) => !open && close()}
      title={result ? "Licenza sbloccata" : "Sblocca con i crediti"}
      description={result ? "I file sono pronti: i link valgono 15 minuti, poi li ritrovi in Libreria." : undefined}
    >
      <div className="flex items-center gap-4">
        <BeatCover beat={beat} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold">{beat.title}</p>
          <p className="truncate text-sm text-chrome-500">
            {beat.producers.map((p) => p.name).join(" & ")} · {beat.bpm} BPM · {keyName(beat.key)} ({camelotCode(beat.key)})
          </p>
        </div>
        {beat.deal && <GlowBadge tone="deal">-{beat.deal.discountPct}%</GlowBadge>}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
            <div className="flex items-center gap-4 rounded-2xl bg-ok/10 p-4 text-ok">
              <motion.span initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
                <CircleCheck className="size-7" />
              </motion.span>
              <div className="text-sm">
                <p className="font-semibold">{LICENSES[result.license.type].name}{result.alreadyOwned ? " · già tua" : " · attiva"}</p>
                <p className="text-ok/80">Saldo: {pluralCredits(result.balance)}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {result.downloads.map((d) => (
                <li key={d.asset}>
                  <a
                    href={d.url}
                    download
                    className="chrome-surface flex h-14 items-center justify-between rounded-2xl px-4 text-sm font-semibold transition"
                  >
                    <span className="flex items-center gap-4">
                      <Download className="size-4 text-electric" /> {ASSET_LABELS[d.asset]}
                    </span>
                    <ArrowRight className="size-4 text-chrome-400" />
                  </a>
                </li>
              ))}
            </ul>
            {/* Il momento giusto per proporre lo studio: il beat è appena diventato suo. */}
            <Link
              href={`/beats/registra?servizio=HIT_PACKAGE&beat=${encodeURIComponent(beat.slug)}#servizi`}
              onClick={close}
              className="obsidian mt-4 flex items-center gap-4 rounded-2xl p-4 transition"
            >
              <Users className="size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">Trasformalo in una hit</span>
                <span className="block text-xs text-chrome-400">Registrazione, mix e master in studio da 199 €</span>
              </span>
              <ArrowRight className="size-4 text-chrome-400" />
            </Link>
            <div className="mt-6 flex gap-2">
              <ChromeLink href="/beats/profilo" variant="ghost" size="md" onClick={close}>
                Vai alla Libreria
              </ChromeLink>
              <ChromeButton variant="obsidian" className="ml-auto" onClick={close}>
                Fatto
              </ChromeButton>
            </div>
          </motion.div>
        ) : (
          <motion.div key="choose" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
            <fieldset>
              <legend className="mb-2 text-[11px] font-semibold text-chrome-500">Licenza</legend>
              <div className="grid gap-2">
                {LICENSE_ORDER.map((type) => {
                  const def = LICENSES[type];
                  const lockedByPlan = !allowed.includes(type);
                  const has = owned.includes(type);
                  const noStems = def.assets.includes("STEMS") && !beat.hasStems;
                  return (
                    <label
                      key={type}
                      className={cn(
                        "relative flex cursor-pointer items-center gap-4 rounded-2xl p-4 transition",
                        selected === type ? "bg-white ring-2 ring-electric" : "chrome-surface hover:shadow-chrome-lg",
                        noStems && "pointer-events-none opacity-50",
                      )}
                    >
                      <input
                        type="radio"
                        name="license"
                        value={type}
                        checked={selected === type}
                        disabled={noStems}
                        onChange={() => setSelected(type)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", selected === type ? "border-electric bg-electric" : "border-chrome-300")}
                      >
                        {selected === type && <Check className="size-3 text-white" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {def.name}
                          {has && <GlowBadge tone="ok">Tua</GlowBadge>}
                          {lockedByPlan && !has && (
                            <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-chrome-500">
                              <Lock className="size-3" /> {cheapestPlanFor(type).name}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-chrome-500">{noStems ? "Stems non disponibili per questo beat" : def.summary}</span>
                      </span>
                      <CreditCost cost={creditCost(type, discount)} original={discount ? def.credits : undefined} />
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={() => {
                close();
                openCustomize(beat);
              }}
              className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-dashed border-electric/40 bg-electric-50/60 p-4 text-left transition hover:border-electric"
            >
              <SlidersHorizontal className="size-5 text-electric" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">Personalizza questo beat</span>
                <span className="block text-xs text-chrome-500">Tonalità, BPM, struttura o suoni su misura per te</span>
              </span>
              <ArrowRight className="size-4 text-chrome-400" />
            </button>

            <div className="obsidian mt-4 grid grid-cols-3 items-center rounded-2xl p-4 text-center">
              <div>
                <p className="text-[11px] text-chrome-400">Saldo</p>
                <p className="mt-2 font-display text-xl font-semibold tabular-nums">{balance}</p>
              </div>
              <div className="text-electric-cyan">
                <p className="text-[11px] text-chrome-400">Costo</p>
                <p className="mt-2 font-display text-xl font-semibold tabular-nums">{isOwned ? 0 : `−${cost}`}</p>
              </div>
              <div>
                <p className="text-[11px] text-chrome-400">Dopo</p>
                <p className={cn("mt-2 font-display text-xl font-semibold tabular-nums", insufficient && "text-deal")}>
                  {isOwned ? balance : balance - cost}
                </p>
              </div>
            </div>

            {needsStems && <p className="mt-4 text-xs text-chrome-500">Include gli stems separati: ideali per il mix in studio.</p>}
            {error && error.code !== "INSUFFICIENT_CREDITS" && error.code !== "PLAN_REQUIRED" && (
              <p role="alert" className="mt-4 rounded-xl bg-deal/10 p-4 text-sm text-deal">
                {error.message}
                {error.code === "UNAUTHENTICATED" && (
                  <Link href="/beats/accedi" className="ml-2 font-semibold underline" onClick={close}>
                    Accedi
                  </Link>
                )}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
              <ChromeButton variant="ghost" onClick={() => toggle(beat)}>
                Riascolta
              </ChromeButton>
              {!viewer ? (
                <ChromeLink href="/beats/accedi" variant="electric" size="lg" className="sm:ml-auto" onClick={close}>
                  Accedi per sbloccare
                </ChromeLink>
              ) : missingPlan && !isOwned ? (
                <ChromeLink href="/beats/piani" variant="electric" size="lg" className="sm:ml-auto" onClick={close}>
                  Passa a {cheapestPlanFor(selected).name}
                </ChromeLink>
              ) : insufficient || error?.code === "INSUFFICIENT_CREDITS" ? (
                <ChromeLink href="/beats/piani#ricariche" variant="electric" size="lg" className="sm:ml-auto" onClick={close}>
                  Ricarica crediti
                </ChromeLink>
              ) : (
                <ChromeButton variant="electric" size="lg" className="sm:ml-auto" disabled={unlock.isPending} onClick={confirm}>
                  {unlock.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : isOwned ? (
                    <>
                      <Download className="size-4" /> Scarica di nuovo
                    </>
                  ) : (
                    <> Sblocca con {pluralCredits(cost)}
                    </>
                  )}
                </ChromeButton>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
