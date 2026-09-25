"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { services } from "@/lib/content";
import { mailtoLink, studio, whatsappLink } from "@/lib/studio";
import { buttonStyles, cn } from "@/lib/cn";
import { useLenis } from "@/components/SmoothScroll";

interface BookingPrefill {
  service?: string;
  notes?: string;
}

interface BookingContextValue {
  open: (prefill?: BookingPrefill) => void;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking deve essere usato dentro <BookingProvider>");
  return ctx;
}

/** Pulsante riutilizzabile che apre il modale di prenotazione (utilizzabile anche da Server Components). */
export function BookingTrigger({
  children,
  className,
  service,
  notes,
  cursorLabel = "Prenota",
}: {
  children: ReactNode;
  className?: string;
  service?: string;
  notes?: string;
  cursorLabel?: string;
}) {
  const { open } = useBooking();
  return (
    <button
      type="button"
      className={className}
      data-cursor={cursorLabel}
      aria-haspopup="dialog"
      onClick={() => open({ service, notes })}
    >
      {children}
    </button>
  );
}

const TIME_SLOTS = ["Mattina (10–13)", "Pomeriggio (14–18)", "Sera (18–22)", "Flessibile"];

type Status = "idle" | "sent";

export function BookingProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lenis = useLenis();
  const [prefill, setPrefill] = useState<BookingPrefill>({});
  const [formKey, setFormKey] = useState(0);
  const [minDate, setMinDate] = useState<string>();
  const [status, setStatus] = useState<Status>("idle");
  const titleId = useId();
  const descId = useId();

  const open = useCallback(
    (next: BookingPrefill = {}) => {
      setPrefill(next);
      setFormKey((k) => k + 1);
      setStatus("idle");
      setMinDate(new Date().toISOString().slice(0, 10));
      lenis?.stop();
      dialogRef.current?.showModal();
    },
    [lenis],
  );

  const close = useCallback(() => dialogRef.current?.close(), []);

  const value = useMemo(() => ({ open }), [open]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const channel = submitter?.value === "email" ? "email" : "whatsapp";

    const name = String(data.get("name") ?? "").trim();
    const contact = String(data.get("contact") ?? "").trim();
    const serviceId = String(data.get("service") ?? "");
    const serviceLabel = services.find((s) => s.id === serviceId)?.title ?? "Da definire";
    const date = String(data.get("date") ?? "");
    const slot = String(data.get("slot") ?? "");
    const message = String(data.get("message") ?? "").trim();
    const formattedDate = date ? new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }) : "Da concordare";

    const lines = [
      `Ciao ${studio.name}! Vorrei prenotare una sessione.`,
      "",
      `• Nome: ${name}`,
      contact ? `• Contatto: ${contact}` : null,
      `• Servizio: ${serviceLabel}`,
      `• Data preferita: ${formattedDate}`,
      slot ? `• Fascia oraria: ${slot}` : null,
      message ? `• Progetto: ${message}` : null,
    ].filter((l): l is string => l !== null);
    const text = lines.join("\n");

    if (channel === "whatsapp") {
      window.open(whatsappLink(text), "_blank", "noopener,noreferrer");
    } else {
      window.location.href = mailtoLink(`Richiesta sessione – ${serviceLabel}`, text);
    }
    setStatus("sent");
  };

  const fieldClass =
    "w-full rounded-xl border border-white/12 bg-obsidian/60 px-4 py-3 text-white placeholder:text-mist/60 transition-colors focus:border-gold focus:outline-none";
  const labelClass = "mb-2 block font-mono text-[0.7rem] uppercase tracking-[0.2em] text-mist";

  return (
    <BookingContext.Provider value={value}>
      {children}
      <dialog
        ref={dialogRef}
        className="booking-dialog m-auto w-[min(100%-2rem,40rem)] max-h-[92dvh] overflow-y-auto rounded-3xl border border-white/10 bg-titanium/95 p-0 text-mist shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] backdrop:bg-transparent"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-lenis-prevent
        onClose={() => lenis?.start()}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="relative p-6 sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-60 w-60 rounded-full bg-signal/20 blur-3xl" />

          <div className="relative flex items-start justify-between gap-6">
            <div>
              <p className="eyebrow">Prenotazione · Risposta in giornata</p>
              <h2 id={titleId} className="mt-3 font-display text-4xl leading-none text-white sm:text-5xl">
                Prenota la tua <em className="text-gradient-gold">sessione</em>
              </h2>
              <p id={descId} className="mt-4 max-w-md text-sm leading-relaxed text-mist">
                Scegli servizio e data: la richiesta parte su WhatsApp o via email, già compilata. Ti confermiamo disponibilità e
                preventivo definitivo in poche ore.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:border-gold hover:text-gold"
              aria-label="Chiudi la finestra di prenotazione"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {status === "sent" ? (
            <div className="relative mt-10 rounded-2xl border border-signal/40 bg-signal/10 p-6" role="status">
              <p className="font-display text-3xl text-white">Richiesta pronta ✦</p>
              <p className="mt-3 text-sm leading-relaxed text-mist">
                Completa l&apos;invio nell&apos;app che si è aperta. Se non si è aperto nulla, scrivici direttamente a{" "}
                <a className="text-gold underline underline-offset-4" href={`mailto:${studio.email}`}>
                  {studio.email}
                </a>{" "}
                o chiama il{" "}
                <a className="text-gold underline underline-offset-4" href={`tel:${studio.phoneHref}`}>
                  {studio.phone}
                </a>
                .
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className={buttonStyles.small} onClick={() => setStatus("idle")}>
                  Modifica richiesta
                </button>
                <button type="button" className="rounded-full border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-white" onClick={close}>
                  Chiudi
                </button>
              </div>
            </div>
          ) : (
            <form key={formKey} onSubmit={handleSubmit} className="relative mt-8 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label htmlFor="bk-name" className={labelClass}>
                  Nome / Nome d&apos;arte *
                </label>
                <input id="bk-name" name="name" required autoComplete="name" className={fieldClass} placeholder="Es. Giulia B." />
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="bk-contact" className={labelClass}>
                  Telefono o email
                </label>
                <input id="bk-contact" name="contact" autoComplete="tel" className={fieldClass} placeholder="Per ricontattarti" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="bk-service" className={labelClass}>
                  Servizio *
                </label>
                <select id="bk-service" name="service" required defaultValue={prefill.service ?? ""} className={cn(fieldClass, "appearance-none")}>
                  <option value="" disabled>
                    Seleziona un servizio
                  </option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                  <option value="altro">Altro / Non so ancora</option>
                </select>
              </div>
              <div>
                <label htmlFor="bk-date" className={labelClass}>
                  Data preferita
                </label>
                <input id="bk-date" name="date" type="date" min={minDate} className={cn(fieldClass, "[color-scheme:dark]")} />
              </div>
              <div>
                <label htmlFor="bk-slot" className={labelClass}>
                  Fascia oraria
                </label>
                <select id="bk-slot" name="slot" defaultValue="" className={cn(fieldClass, "appearance-none")}>
                  <option value="">Indifferente</option>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="bk-message" className={labelClass}>
                  Raccontaci il progetto
                </label>
                <textarea
                  id="bk-message"
                  name="message"
                  rows={4}
                  defaultValue={prefill.notes ?? ""}
                  className={cn(fieldClass, "resize-y")}
                  placeholder="Genere, numero di brani, riferimenti, scadenze…"
                />
              </div>
              <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
                <button type="submit" name="channel" value="whatsapp" className={cn(buttonStyles.primary, "flex-1")}>
                  <WhatsAppIcon />
                  Invia su WhatsApp
                </button>
                <button type="submit" name="channel" value="email" className={cn(buttonStyles.ghost, "flex-1")}>
                  Invia via Email
                </button>
              </div>
              <p className="text-xs leading-relaxed text-mist/80 sm:col-span-2">
                Nessun dato viene salvato su questo sito: la richiesta viene inviata direttamente dal tuo WhatsApp o dal tuo client
                email.
              </p>
            </form>
          )}
        </div>
      </dialog>
    </BookingContext.Provider>
  );
}

export function WhatsAppIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.02c-.24.68-1.42 1.3-1.95 1.35-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.54-.34.72-.34h.52c.17 0 .39-.06.61.47.23.55.77 1.9.84 2.04.07.14.11.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.52 1.9 1.05.93 1.93 1.22 2.2 1.36.27.14.43.11.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.23.61-.14.25.09 1.59.75 1.86.89.27.14.45.2.52.32.07.11.07.66-.17 1.34Z" />
    </svg>
  );
}
