"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Modale in vetro: su mobile è un foglio dal basso (raggiungibile col pollice),
 * da tablet in su una finestra centrata. Focus trap, Esc e aria gestiti da Radix.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-graphite/30 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <RadixDialog.Content
          className={cn(
            "glass fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[28px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:p-7",
            "bg-white/90",
            className,
          )}
        >
          <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-chrome-300 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="font-display text-xl font-bold tracking-tight text-graphite">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-chrome-500">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">Finestra di dialogo</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label="Chiudi"
              className="chrome-surface grid size-9 shrink-0 place-items-center rounded-full text-graphite-700 transition hover:text-graphite"
            >
              <X className="size-4" />
            </RadixDialog.Close>
          </div>
          <div className="mt-5">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
