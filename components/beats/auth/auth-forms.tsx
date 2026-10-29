"use client";

import { Eye, EyeOff, Loader2, Lock, Mail, Ticket, UserRound } from "lucide-react";
import { useActionState, useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { loginAction, signupAction, type AuthFormState } from "@/app/(store)/beats/accedi/actions";
import { ChromeButton } from "../ui/chrome-button";

function Field({ icon, className, ...props }: ComponentProps<"input"> & { icon: React.ReactNode }) {
  return (
    <label className={cn("glass flex h-13 items-center gap-4 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-electric/50", className)}>
      <span className="text-chrome-400" aria-hidden>
        {icon}
      </span>
      <input className="min-w-0 flex-1 bg-transparent py-4 text-[16px] outline-none placeholder:text-chrome-400" {...props} />
    </label>
  );
}

function PasswordField({ id, label, autoComplete, onValue }: { id: string; label: string; autoComplete: string; onValue?: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="glass flex items-center gap-4 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-electric/50">
      <Lock className="size-4 text-chrome-400" aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        required
        autoComplete={autoComplete}
        placeholder={label}
        onChange={(e) => onValue?.(e.target.value)}
        className="min-w-0 flex-1 bg-transparent py-4 text-[16px] outline-none placeholder:text-chrome-400"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Nascondi password" : "Mostra password"}
        className="text-chrome-400 transition hover:text-graphite"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </label>
  );
}

/** Forza indicativa: lunghezza, numeri, maiuscole e simboli. */
function strength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/\d/.test(pw) && /[A-Za-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}
const STRENGTH = ["Troppo corta", "Debole", "Discreta", "Buona", "Ottima"];

function ErrorLine({ state }: { state: AuthFormState }) {
  return (
    <p role="alert" aria-live="polite" className={cn("min-h-5 text-sm font-normal text-deal", !state.error && "invisible")}>
      {state.error ?? "—"}
    </p>
  );
}

export function AuthForms({
  initialMode = "login",
  invite,
  staffOnly = false,
}: {
  initialMode?: "login" | "signup";
  invite?: string;
  /** Prima del lancio si registra solo lo staff: il codice diventa obbligatorio. */
  staffOnly?: boolean;
}) {
  const [mode, setMode] = useState(initialMode);
  const [loginState, login, loggingIn] = useActionState(loginAction, {});
  const [signupState, signup, signingUp] = useActionState(signupAction, {});
  const [artist, setArtist] = useState(signupState.fields?.artistName ?? "");
  const [pw, setPw] = useState("");
  const score = strength(pw);

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Accesso" className="grid grid-cols-2 rounded-2xl bg-chrome-200/70 p-2">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "h-10 rounded-xl text-sm font-semibold transition",
              mode === m ? "bg-white text-graphite shadow-[0_1px_3px_rgba(0,0,0,0.15)]" : "text-chrome-500",
            )}
          >
            {m === "login" ? "Accedi" : "Crea il tuo profilo"}
          </button>
        ))}
      </div>

      {mode === "login" ? (
        <form action={login} className="space-y-4">
          <Field
            icon={<Mail className="size-4" />}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="La tua email"
            defaultValue={loginState.fields?.email}
          />
          <PasswordField id="password" label="Password" autoComplete="current-password" />
          <ErrorLine state={loginState} />
          <ChromeButton type="submit" variant="electric" size="lg" className="w-full" disabled={loggingIn}>
            {loggingIn ? <Loader2 className="size-4 animate-spin" /> : "Entra"}
          </ChromeButton>
        </form>
      ) : (
        <form action={signup} className="space-y-4">
          {invite && (
            <>
              <input type="hidden" name="invite" value={invite} />
              <p className="rounded-2xl bg-electric/10 px-4 py-4 text-sm font-semibold text-electric">
                Sei stato invitato: con il primo abbonamento ricevi 5 crediti in regalo.
              </p>
            </>
          )}
          {/* Anteprima del nome come apparirà nella home */}
          <div className="obsidian rounded-3xl px-6 py-6 text-center">
            <p className="text-[11px] font-semibold text-electric-cyan">Il tuo nome nel Beat Store</p>
            <p className="chrome-text-light mt-2 truncate font-display text-5xl font-semibold tracking-tight">{artist.trim() || "Il tuo nome"}</p>
          </div>
          <Field
            icon={<UserRound className="size-4" />}
            name="artistName"
            required
            minLength={2}
            maxLength={32}
            autoComplete="nickname"
            placeholder="Nome d'artista"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
          />
          <Field
            icon={<Mail className="size-4" />}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            defaultValue={signupState.fields?.email}
          />
          <PasswordField id="password" label="Password (min. 8, con un numero)" autoComplete="new-password" onValue={setPw} />
          <div aria-live="polite" className="flex items-center gap-2 px-2">
            <div className="grid flex-1 grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={cn("h-1.5 rounded-full transition", i <= score ? (score >= 3 ? "bg-ok" : "bg-electric") : "bg-chrome-300")} />
              ))}
            </div>
            <span className="w-24 text-right text-xs text-chrome-500">{pw ? STRENGTH[score] : ""}</span>
          </div>
          <PasswordField id="confirm" label="Ripeti la password" autoComplete="new-password" />
          {!invite &&
            (staffOnly ? (
              <Field icon={<Ticket className="size-4" />} name="invite" required autoComplete="off" aria-label="Codice staff" placeholder="Codice staff" />
            ) : (
              <details className="group rounded-2xl px-2">
                <summary className="cursor-pointer list-none text-sm text-chrome-500 group-open:mb-2">Hai un codice d&apos;invito?</summary>
                <Field icon={<Ticket className="size-4" />} name="invite" autoComplete="off" aria-label="Codice d'invito" placeholder="Codice d'invito" />
              </details>
            ))}
          <ErrorLine state={signupState} />
          <ChromeButton type="submit" variant="electric" size="lg" className="w-full" disabled={signingUp}>
            {signingUp ? <Loader2 className="size-4 animate-spin" /> : "Crea il profilo"}
          </ChromeButton>
        </form>
      )}
    </div>
  );
}
