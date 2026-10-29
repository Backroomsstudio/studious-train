"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { formatEuro } from "@/lib/beats/plans";
import type { PaidWith } from "@/lib/beats/offers";
import { ChromeButton } from "../ui/chrome-button";

/**
 * Due modi di pagare la stessa cosa: crediti (dal saldo) o carta (Stripe).
 * Mostra solo i metodi previsti dall'offerta.
 */
export function PayChoice({
  credits,
  priceCents,
  originalCents,
  balance,
  pending,
  onPay,
  label = "Paga",
}: {
  credits: number | null;
  priceCents: number | null;
  /** Prezzo pieno quando c'è lo sconto del livello. */
  originalCents?: number;
  balance: number | null;
  pending: PaidWith | null;
  onPay: (method: PaidWith) => void;
  label?: string;
}) {
  const short = credits !== null && balance !== null && balance < credits;
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {credits !== null && (
        <ChromeButton
          variant="electric"
          size="lg"
          className="flex-1 normal-case tracking-normal"
          disabled={pending !== null || short}
          onClick={() => onPay("CREDITS")}
          title={short ? "Crediti insufficienti: ricarica o paga con carta" : undefined}
        >
          {pending === "CREDITS" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <> {label} con {credits} crediti
            </>
          )}
        </ChromeButton>
      )}
      {priceCents !== null && (
        <ChromeButton
          variant={credits !== null ? "chrome" : "electric"}
          size="lg"
          className="flex-1 normal-case tracking-normal"
          disabled={pending !== null}
          onClick={() => onPay("CARD")}
        >
          {pending === "CARD" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <CreditCard className="size-4" /> {label} {formatEuro(priceCents)}
              {originalCents !== undefined && originalCents !== priceCents && (
                <s className="text-xs font-normal opacity-60">{formatEuro(originalCents)}</s>
              )}
            </>
          )}
        </ChromeButton>
      )}
    </div>
  );
}
