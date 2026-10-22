import { useSyncExternalStore } from "react";

const noop = () => () => undefined;

/**
 * `false` durante il rendering sul server e la prima idratazione, poi `true`.
 * Serve per mostrare i dati salvati in localStorage senza errori di idratazione.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
