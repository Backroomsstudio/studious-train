"use client";

import { cn } from "@/lib/cn";
import { useFeatUnreadCount } from "./use-feat";

export { useFeatUnreadCount };

/**
 * Pallino con i messaggi "Cerco feat" non letti, da mettere accanto alla voce di navigazione.
 * Interroga la casella ogni 30 secondi (solo se c'è un accesso); con zero non letti non mostra niente.
 */
export function FeatInboxBadge({ className, pollMs }: { className?: string; pollMs?: number }) {
  const unread = useFeatUnreadCount(pollMs);
  if (!unread) return null;
  return (
    <span className={cn("feat-count", className)}>
      {unread > 9 ? "9+" : unread}
      <span className="sr-only"> messaggi non letti</span>
    </span>
  );
}
