"use client";

import { Check, Download, Settings2, Share } from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { usePrefs, type PrefKey } from "@/lib/beats/prefs";
import { haptic, sfx } from "@/lib/beats/ui-feedback";
import { ChromeButton } from "../ui/chrome-button";
import { Dialog } from "../ui/dialog";
import { installPlatform, promptInstall, useInstall } from "./install-prompt";

const ROWS: Array<{ key: Exclude<PrefKey, "gyro">; title: string; text: string }> = [
  { key: "sound", title: "Suoni dell'interfaccia", text: "Un tic metallico sui tasti, un colpo di 808 quando sblocchi un beat" },
  { key: "haptic", title: "Vibrazione", text: "Un colpetto su sblocchi, crediti e play (sui telefoni Android)" },
  { key: "pulse", title: "Sito a tempo", text: "Logo, player e copertine pulsano sul BPM del beat che ascolti" },
  { key: "lite", title: "Modalità leggera", text: "Meno sfocature e animazioni: più fluido sui telefoni meno recenti e meno batteria" },
];

function SwitchRow({ title, text, checked, onToggle, note }: { title: string; text: string; checked: boolean; onToggle: () => void; note?: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="chrome-surface flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition hover:shadow-chrome-lg"
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-[15px] font-semibold text-graphite">{title}</span>
        <span className="text-[12.5px] leading-snug text-chrome-500">{text}</span>
        {note}
      </span>
      <span aria-hidden className="settings-toggle" data-on={checked || undefined} />
    </button>
  );
}

type DeviceOrientationWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

/** Su iPhone il giroscopio va chiesto con un tocco; altrove basta che il sensore esista. */
async function requestGyro(): Promise<boolean> {
  if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") return false;
  const DOE = DeviceOrientationEvent as DeviceOrientationWithPermission;
  if (typeof DOE.requestPermission === "function") {
    try {
      return (await DOE.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  return "ondeviceorientation" in window;
}

function InstallCard() {
  const event = useInstall((s) => s.event);
  const installed = useInstall((s) => s.installed);
  const [platform] = useState(installPlatform);
  const [showSteps, setShowSteps] = useState(false);

  const steps =
    platform === "ios"
      ? [
          <>Tocca <b className="inline-flex items-center gap-1">Condividi <Share className="inline size-3.5" aria-hidden /></b> nella barra di Safari</>,
          <>Scegli <b>Aggiungi alla schermata Home</b></>,
          <>Apri Backrooms Beats dalla Home</>,
        ]
      : [
          <>Apri il menu <b>⋮</b> del browser</>,
          <>Tocca <b>Installa app</b> (o <b>Aggiungi a schermata Home</b>)</>,
          <>Apri Backrooms Beats dalla Home o dal desktop</>,
        ];

  return (
    <section aria-labelledby="install-title" className="obsidian mt-5 rounded-3xl p-5">
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-[18px] bg-[linear-gradient(160deg,#2a2f38,#05070a_60%,#1c2028)] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)]">
          <Image src="/brand/logo-br-120.webp" alt="" width={46} height={36} className="drop-shadow-[0_0_10px_rgba(0,140,255,0.6)]" />
        </span>
        <div className="min-w-0">
          <h3 id="install-title" className="font-display text-lg font-bold text-white">Installa l&apos;app</h3>
          <p className="text-[13px] leading-snug text-chrome-300">A tutto schermo, parte in un attimo e la ritrovi sulla Home accanto alle altre app.</p>
        </div>
      </div>
      {installed ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-ok/15 px-3 py-1.5 text-sm font-semibold text-[#4ade80]">
          <Check className="size-4" /> Già installata su questo dispositivo
        </p>
      ) : (
        <>
          {(showSteps || platform === "ios" || !event) && (
            <ol className="mt-4 grid gap-2 text-sm text-chrome-200">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-electric/25 text-[11px] font-bold text-electric-cyan">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}
          {platform !== "ios" && (
            <ChromeButton
              variant="electric"
              className="mt-4 w-full"
              onClick={async () => {
                const outcome = await promptInstall();
                if (outcome === "unavailable") setShowSteps(true);
                else if (outcome === "accepted") {
                  sfx("win");
                  haptic("success");
                }
              }}
            >
              <Download className="size-4" /> Installa ora
            </ChromeButton>
          )}
        </>
      )}
    </section>
  );
}

/** Foglio delle impostazioni: preferenze dell'esperienza (salvate sul dispositivo) e installazione. */
export function SettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const prefs = usePrefs();
  const [gyroError, setGyroError] = useState(false);

  const toggle = (key: Exclude<PrefKey, "gyro">) => {
    const next = !prefs[key];
    prefs.set(key, next);
    // Anteprima immediata di quello che hai appena acceso.
    if (key === "sound" && next) sfx("pop");
    if (key === "haptic" && next) haptic("success");
  };

  const toggleGyro = async () => {
    if (prefs.gyro) return prefs.set("gyro", false);
    const ok = await requestGyro();
    setGyroError(!ok);
    if (ok) {
      prefs.set("gyro", true);
      haptic("select");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Impostazioni" description="Suoni, vibrazione ed effetti su questo dispositivo.">
      <div className="grid gap-2">
        {ROWS.map((row) => (
          <SwitchRow key={row.key} title={row.title} text={row.text} checked={prefs[row.key]} onToggle={() => toggle(row.key)} />
        ))}
        <SwitchRow
          title="Logo col giroscopio"
          text={prefs.gyro ? "Attivo: inclina il telefono e il logo ti segue" : "Il logo 3D segue i movimenti del telefono"}
          checked={prefs.gyro}
          onToggle={() => void toggleGyro()}
          note={
            gyroError ? (
              <span role="status" className="text-[12.5px] font-semibold text-deal">
                Giroscopio non disponibile su questo dispositivo o permesso negato.
              </span>
            ) : undefined
          }
        />
      </div>
      <InstallCard />
      <p className="mt-4 text-center text-xs text-chrome-500">Le preferenze restano su questo dispositivo.</p>
    </Dialog>
  );
}

/** Pulsante a icona che apre le impostazioni (header; riusabile anche altrove). */
export function SettingsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Impostazioni"
        aria-haspopup="dialog"
        title="Impostazioni"
        className={cn(
          "chrome-surface grid size-11 shrink-0 place-items-center rounded-full text-graphite-700 transition hover:text-graphite hover:shadow-glow-sm",
          className,
        )}
      >
        <Settings2 className="size-[18px]" />
      </button>
      {open && <SettingsSheet open={open} onOpenChange={setOpen} />}
    </>
  );
}
