"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import { analyticsEnabled, CONSENT_KEY, CONSENT_RESET_EVENT, GA_ID } from "@/lib/analytics";
import { buttonStyles } from "@/lib/cn";

type Consent = "unknown" | "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readConsent(): Consent {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : "unknown";
  } catch {
    return "unknown";
  }
}

/** Toglie i cookie di Analytics (_ga, _ga_*) dal dominio corrente e da quello padre. */
function clearGaCookies() {
  const host = window.location.hostname;
  const parts = host.split(".");
  const domains = [host, ...(parts.length > 2 ? [parts.slice(-2).join(".")] : [])].flatMap((d) => [d, `.${d}`]);
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (name !== "_ga" && !name.startsWith("_ga_")) continue;
    for (const d of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${d}`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

/** Eventi che l'Hub conta: telefono, WhatsApp e pulsanti di prenotazione. */
function trackClicks(event: MouseEvent) {
  const el = (event.target as Element | null)?.closest("a, button");
  if (!el || !window.gtag) return;
  const href = el instanceof HTMLAnchorElement ? el.href : "";
  if (href.startsWith("tel:")) window.gtag("event", "phone_click", { link_url: href });
  else if (/wa\.me|whatsapp\.com/i.test(href)) window.gtag("event", "whatsapp_click", { link_url: href });
  else if (el.getAttribute("aria-haspopup") === "dialog") window.gtag("event", "cta_click", { cta_text: (el.textContent ?? "").trim().slice(0, 60) });
}

export function Analytics() {
  const [consent, setConsent] = useState<Consent>("unknown");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
    const reopen = () => setConsent("unknown");
    window.addEventListener(CONSENT_RESET_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_RESET_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (consent !== "granted") return;
    document.addEventListener("click", trackClicks, { capture: true });
    return () => document.removeEventListener("click", trackClicks, { capture: true });
  }, [consent]);

  const choose = useCallback((value: "granted" | "denied") => {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* navigazione privata: la scelta vale solo per questa visita */
    }
    if (value === "denied") {
      (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = true;
      clearGaCookies();
    } else {
      (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = false;
    }
    setConsent(value);
  }, []);

  if (!analyticsEnabled || !ready) return null;

  return (
    <>
      {consent === "granted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
gtag('js', new Date());
gtag('config', '${GA_ID}', { anonymize_ip: true, allow_google_signals: false });`}
          </Script>
        </>
      )}
      {consent === "unknown" && (
        <div
          role="dialog"
          aria-label="Preferenze sui cookie"
          className="chrome-border fixed inset-x-3 bottom-[calc(4.8rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-xl rounded-[1.5rem] bg-obsidian p-5 shadow-2xl lg:bottom-5 lg:left-5 lg:right-auto lg:mx-0"
        >
          <p className="text-sm leading-relaxed text-mist">
            Usiamo Google Analytics per capire quante persone visitano il sito e cosa guardano. Parte solo se lo accetti: puoi rifiutare e il sito funziona identico.{" "}
            <a href="/privacy" className="text-white underline underline-offset-4">
              Privacy e cookie
            </a>
          </p>
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => choose("denied")} className={buttonStyles.ghost + " min-h-11 flex-1"}>
              Rifiuta
            </button>
            <button type="button" onClick={() => choose("granted")} className={buttonStyles.ghost + " min-h-11 flex-1"}>
              Accetta
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Link del footer per cambiare idea in qualsiasi momento. Non compare se Analytics non è attivo. */
export function CookiePreferencesLink({ className }: { className?: string }) {
  if (!analyticsEnabled) return null;
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_RESET_EVENT))}>
      Gestisci cookie
    </button>
  );
}
