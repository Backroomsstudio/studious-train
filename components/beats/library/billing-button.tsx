"use client";

import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { PlanTier } from "@/lib/beats/plans";
import { api, ApiRequestError } from "../providers";
import { ChromeButton } from "../ui/chrome-button";

/** Avvia il checkout Stripe di un piano o apre il portale clienti. */
export function BillingButton({
  tier,
  variant = "electric",
  children,
  className,
}: {
  tier?: PlanTier;
  variant?: "electric" | "chrome" | "obsidian";
  children: ReactNode;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setPending(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>(tier ? "/api/billing/checkout" : "/api/billing/portal", {
        method: "POST",
        body: tier ? JSON.stringify({ tier }) : undefined,
      });
      window.location.assign(url);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "UNAUTHENTICATED") window.location.assign("/beats/accedi");
      else setError((e as Error).message);
      setPending(false);
    }
  };

  return (
    <div className={className}>
      <ChromeButton variant={variant} size="lg" className="w-full" onClick={go} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : children}
      </ChromeButton>
      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-deal">
          {error}
        </p>
      )}
    </div>
  );
}
