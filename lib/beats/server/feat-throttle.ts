import "server-only";
import { StoreError } from "./errors";
import { createThrottle } from "./throttle";

/**
 * Freno in memoria davanti alle API di "Cerco feat" (per utente): ferma chi martella prima di
 * toccare il database. I limiti veri (3 annunci al giorno, 20 messaggi al minuto) li conta il backend.
 */
const throttles = {
  post: createThrottle(10, 10 * 60_000),
  message: createThrottle(40, 60_000),
  report: createThrottle(10, 60 * 60_000),
};

export function featThrottle(kind: keyof typeof throttles, userId: string): void {
  const throttle = throttles[kind];
  if (throttle.blocked(userId)) throw new StoreError("RATE_LIMITED");
  throttle.hit(userId);
}
