"use client";

import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { create } from "zustand";
import type { LicenseType } from "@/lib/beats/licenses";
import type { CustomizationOption } from "@/lib/beats/customizations";
import type { ApiError, BeatSummary, CustomizationResponse, PurchaseResponse, UnlockResponse, Viewer } from "@/lib/beats/types";
import { feedback } from "@/lib/beats/ui-feedback";

/**
 * Stato server lato client con TanStack Query.
 * Il saldo crediti NON è duplicato in uno store Zustand: è dato del server, quindi vive nella cache
 * di Query (["viewer"]) e si aggiorna con la risposta dello sblocco. Una sola fonte di verità,
 * nessuna desincronizzazione tra schede o dopo un errore. Zustand resta per lo stato puramente client
 * (player audio, modale di sblocco).
 */

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err = (body as ApiError | null)?.error;
    throw new ApiRequestError(res.status, err?.code ?? "INTERNAL", err?.message ?? "Errore di rete, riprova.");
  }
  return body as T;
}

export function BeatsProviders({ viewer, children }: { viewer: Viewer | null; children: ReactNode }) {
  const [client] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
    });
    qc.setQueryData(["viewer"], viewer);
    return qc;
  });
  // Dopo accesso, registrazione o uscita il layout arriva dal server con un nuovo profilo:
  // la cache del client si allinea senza ricaricare la pagina.
  useEffect(() => {
    client.setQueryData(["viewer"], viewer);
  }, [client, viewer]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function useViewer() {
  return useQuery({
    queryKey: ["viewer"],
    queryFn: async () => (await api<{ viewer: Viewer | null }>("/api/me")).viewer,
    staleTime: 60_000,
  });
}

export function useUnlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ beatId, license }: { beatId: string; license: LicenseType }) =>
      api<UnlockResponse>(`/api/beats/${encodeURIComponent(beatId)}/unlock`, {
        method: "POST",
        body: JSON.stringify({ license }),
      }),
    onSuccess(result) {
      // Colpo di 808 + vibrazione: il beat è tuo.
      feedback("unlock");
      qc.setQueryData<Viewer | null>(["viewer"], (viewer) => {
        if (!viewer) return viewer;
        const owned = { ...viewer.owned };
        const list = owned[result.license.beatId] ?? [];
        owned[result.license.beatId] = list.includes(result.license.type) ? list : [...list, result.license.type];
        return { ...viewer, creditBalance: result.balance, owned };
      });
    },
    onError: () => feedback("error"),
  });
}

interface UnlockDialogState {
  beat: BeatSummary | null;
  open: (beat: BeatSummary) => void;
  close: () => void;
}

/** Un'unica modale di sblocco per tutta l'app, aperta da qualsiasi riga o scheda. */
export const useUnlockDialog = create<UnlockDialogState>((set) => ({
  beat: null,
  open: (beat) => set({ beat }),
  close: () => set({ beat: null }),
}));

export function useCustomize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ beatId, ...body }: { beatId: string; options: CustomizationOption[]; express: boolean; notes: string; referenceUrl?: string }) =>
      api<CustomizationResponse>(`/api/beats/${encodeURIComponent(beatId)}/customize`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess(result) {
      feedback("win");
      qc.setQueryData<Viewer | null>(["viewer"], (viewer) => (viewer ? { ...viewer, creditBalance: result.balance } : viewer));
    },
    onError: () => feedback("error"),
  });
}

/** Modale "Personalizza questo beat", aperta dalla modale di sblocco o dalla pagina del beat. */
export const useCustomizeDialog = create<UnlockDialogState>((set) => ({
  beat: null,
  open: (beat) => set({ beat }),
  close: () => set({ beat: null }),
}));

/**
 * Acquisti oltre allo sblocco (servizi, kit, ricariche, gift card, esclusive).
 * Pagato in crediti → saldo aggiornato e pagina ricaricata dal server; con carta → Stripe Checkout.
 */
export function usePurchase() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: ({ url, body }: { url: string; body: unknown }) =>
      api<PurchaseResponse>(url, { method: "POST", body: JSON.stringify(body) }),
    onSuccess(result) {
      if (result.kind === "redirect") {
        window.location.assign(result.url);
        return;
      }
      // Pagato in crediti: suono di monete.
      feedback("coin");
      qc.setQueryData<Viewer | null>(["viewer"], (viewer) => (viewer ? { ...viewer, creditBalance: result.balance } : viewer));
      router.refresh();
    },
    onError(error) {
      if (error instanceof ApiRequestError && error.code === "UNAUTHENTICATED") return window.location.assign("/beats/accedi?nuovo=1");
      feedback("error");
    },
  });
}
