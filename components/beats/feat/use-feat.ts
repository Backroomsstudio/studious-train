"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { recordAchievement } from "@/lib/beats/achievements";
import { FEAT, type FeatFilters, type FeatPostInput } from "@/lib/beats/feat";
import type { FeatInbox, FeatMessageItem, FeatPostSummary, FeatThreadDetail } from "@/lib/beats/types";
import { api, ApiRequestError, useViewer } from "../providers";

/**
 * Stato di "Cerco feat" lato client con TanStack Query: bacheca, casella e chat aperta
 * si aggiornano in polling; l'invio dei messaggi è ottimista (il messaggio compare subito).
 */

export const featKeys = {
  posts: (filters: FeatFilters = {}) => ["feat", "posts", filters.role ?? "", filters.genre ?? ""] as const,
  allPosts: ["feat", "posts"] as const,
  inbox: ["feat", "inbox"] as const,
  thread: (id: string) => ["feat", "thread", id] as const,
};

export const SIGN_IN_HREF = "/beats/accedi";

export function goToSignIn(error: Error): void {
  if (error instanceof ApiRequestError && error.code === "UNAUTHENTICATED") window.location.assign(SIGN_IN_HREF);
}

function postsUrl(filters: FeatFilters) {
  const params = new URLSearchParams();
  if (filters.role) params.set("role", filters.role);
  if (filters.genre) params.set("genre", filters.genre);
  const qs = params.toString();
  return `/api/feat/posts${qs ? `?${qs}` : ""}`;
}

export function useFeatPosts(filters: FeatFilters, initial?: FeatPostSummary[]) {
  return useQuery({
    queryKey: featKeys.posts(filters),
    queryFn: async () => (await api<{ posts: FeatPostSummary[] }>(postsUrl(filters))).posts,
    // I dati del server valgono solo per la vista senza filtri.
    initialData: !filters.role && !filters.genre ? initial : undefined,
    refetchInterval: 30_000,
    placeholderData: (previous) => previous,
  });
}

/** Casella "I tuoi messaggi". `pollMs` più lento quando serve solo il badge in navigazione. */
export function useFeatInbox(options: { initial?: FeatInbox; pollMs?: number } = {}) {
  const { data: viewer } = useViewer();
  return useQuery({
    queryKey: featKeys.inbox,
    queryFn: () => api<FeatInbox>("/api/feat/inbox"),
    initialData: options.initial,
    enabled: Boolean(viewer),
    refetchInterval: options.pollMs ?? FEAT.pollMs,
  });
}

/** Numero di messaggi non letti (per il badge in navigazione): 0 se non c'è accesso. */
export function useFeatUnreadCount(pollMs = 30_000): number {
  return useFeatInbox({ pollMs }).data?.unread ?? 0;
}

/** Chat aperta: si ricarica ogni ~4 secondi e azzera subito i non letti nella casella. */
export function useFeatThread(threadId: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: featKeys.thread(threadId ?? ""),
    enabled: Boolean(threadId),
    refetchInterval: FEAT.pollMs,
    queryFn: async () => {
      const { thread } = await api<{ thread: FeatThreadDetail }>(`/api/feat/threads/${encodeURIComponent(threadId!)}`);
      qc.setQueryData<FeatInbox>(featKeys.inbox, (inbox) => {
        if (!inbox) return inbox;
        const threads = inbox.threads.map((t) => (t.id === thread.id ? { ...t, unread: 0, last: thread.messages.at(-1) ?? t.last } : t));
        return { threads, unread: threads.reduce((sum, t) => sum + t.unread, 0) };
      });
      return thread;
    },
  });
}

export function useOpenFeatThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) =>
      (await api<{ thread: FeatThreadDetail }>(`/api/feat/posts/${encodeURIComponent(postId)}/thread`, { method: "POST" })).thread,
    onSuccess(thread) {
      qc.setQueryData(featKeys.thread(thread.id), thread);
    },
    onError: goToSignIn,
  });
}

type PendingMessage = FeatMessageItem & { pending?: boolean };

export function useSendFeatMessage(threadId: string) {
  const qc = useQueryClient();
  const key = featKeys.thread(threadId);
  return useMutation({
    mutationFn: async (body: string) =>
      (await api<{ message: FeatMessageItem }>(`/api/feat/threads/${encodeURIComponent(threadId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      })).message,
    async onMutate(body) {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<FeatThreadDetail>(key);
      const temp: PendingMessage = { id: `tmp-${Date.now()}`, body: body.trim(), mine: true, createdAt: new Date().toISOString(), readAt: null, pending: true };
      if (previous) qc.setQueryData<FeatThreadDetail>(key, { ...previous, messages: [...previous.messages, temp] });
      return { previous, tempId: temp.id, first: !previous?.messages.some((m) => m.mine) };
    },
    onSuccess(message, _body, context) {
      // Il primo messaggio in una chat conta come collaborazione avviata (badge "Collab").
      if (context?.first) recordAchievement("collab");
      qc.setQueryData<FeatThreadDetail>(key, (thread) => {
        if (!thread) return thread;
        // Un polling arrivato nel frattempo può aver già portato (o tolto) il messaggio provvisorio.
        const rest = thread.messages.filter((m) => m.id !== context?.tempId && m.id !== message.id);
        return { ...thread, last: message, messages: [...rest, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
      });
      void qc.invalidateQueries({ queryKey: featKeys.inbox });
      void qc.invalidateQueries({ queryKey: featKeys.allPosts });
    },
    onError(error, _body, context) {
      if (context?.previous) qc.setQueryData(key, context.previous);
      goToSignIn(error);
    },
  });
}

export function useCreateFeatPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FeatPostInput) =>
      (await api<{ post: FeatPostSummary }>("/api/feat/posts", { method: "POST", body: JSON.stringify(input) })).post,
    onSuccess() {
      recordAchievement("collab");
      void qc.invalidateQueries({ queryKey: featKeys.allPosts });
    },
    onError: goToSignIn,
  });
}

export function useCloseFeatPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) =>
      (await api<{ post: FeatPostSummary }>(`/api/feat/posts/${encodeURIComponent(postId)}/close`, { method: "POST" })).post,
    onSuccess(post) {
      // Aggiorna subito tutte le viste della bacheca, poi riallinea col server.
      qc.setQueriesData<FeatPostSummary[]>({ queryKey: featKeys.allPosts }, (list) => list?.map((p) => (p.id === post.id ? post : p)));
      void qc.invalidateQueries({ queryKey: featKeys.allPosts });
    },
    onError: goToSignIn,
  });
}

export function useReportFeat() {
  return useMutation({
    mutationFn: (input: { postId?: string; messageId?: string; reason: string }) =>
      api<{ ok: true }>("/api/feat/reports", { method: "POST", body: JSON.stringify(input) }),
    onError: goToSignIn,
  });
}

/** Orologio che avanza ogni minuto: tiene freschi i "5 minuti fa". */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
