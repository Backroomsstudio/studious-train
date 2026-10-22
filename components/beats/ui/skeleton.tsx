import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Scheletri cromati per i caricamenti: lastre di metallo spazzolato con un riflesso che scorre
 * (classe `skel` in store.css). `dark` per quelli dentro i pannelli in ossidiana.
 * Sono decorativi: il contenitore di pagina annuncia "Caricamento" una sola volta.
 */
export function Skeleton({
  className,
  dark = false,
  w,
  h,
  style,
}: {
  className?: string;
  dark?: boolean;
  /** Larghezza CSS (es. "60%", 120). */
  w?: number | string;
  /** Altezza in px. */
  h?: number;
  style?: CSSProperties;
}) {
  return <span aria-hidden className={cn("skel", dark && "skel-dark", className)} style={{ width: w, height: h, ...style }} />;
}

/** Contenitore di una pagina in caricamento: annuncio unico per gli screen reader. */
export function SkeletonPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn("skel-page", className ?? "space-y-6 lg:space-y-8")}>
      <span className="sr-only">Caricamento…</span>
      {children}
    </div>
  );
}

/** Intestazione di pagina: etichetta, titolo cromato grande e riga di testo. */
export function SkeletonHeading({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("grid max-w-2xl gap-2.5", className)}>
      <Skeleton w={110} h={10} className="rounded-md" />
      <Skeleton w="min(420px, 72%)" h={44} className="rounded-xl" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} w={i === lines - 1 ? "min(420px, 64%)" : "min(560px, 92%)"} h={13} className="rounded-md" />
      ))}
    </div>
  );
}

/** Righe di beat con la stessa sagoma di TrackRow: copertina, titolo e produttori, prezzo. */
export function SkeletonRows({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <ul aria-hidden className={cn("flex flex-col gap-1", className)}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl px-2.5 py-2.5 sm:gap-4 sm:px-3 lg:grid-cols-[3.5rem_minmax(0,1.3fr)_minmax(0,1.6fr)_auto]">
          <Skeleton className="size-14 rounded-2xl" />
          <span className="grid min-w-0 gap-2">
            <Skeleton w={`${48 + ((i * 17) % 30)}%`} h={14} className="rounded-md" />
            <Skeleton w={`${30 + ((i * 11) % 25)}%`} h={10} className="rounded-md" />
          </span>
          <Skeleton h={30} className="hidden rounded-lg lg:block" />
          <Skeleton w={64} h={36} className="rounded-full" />
        </li>
      ))}
    </ul>
  );
}

/** Scaffale orizzontale di copertine (Nuove entrate). */
export function SkeletonShelf({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Skeleton w={120} h={10} className="rounded-md" />
        <Skeleton w={220} h={26} className="rounded-lg" />
      </div>
      <div aria-hidden className="-mx-4 flex gap-4 overflow-hidden px-4 lg:mx-0 lg:px-0">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="w-44 shrink-0 space-y-2 sm:w-52">
            <Skeleton className="aspect-square w-full rounded-[28px]" />
            <Skeleton w="70%" h={14} className="rounded-md" />
            <Skeleton w="45%" h={10} className="rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Griglia di schede (kit, piani, servizi): immagine, titolo, testo, pulsante. */
export function SkeletonCards({ count = 3, className, media = true }: { count?: number; className?: string; media?: boolean }) {
  return (
    <div aria-hidden className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="glass grid gap-3 rounded-[26px] p-5">
          {media && <Skeleton h={130} className="w-full rounded-[18px]" />}
          <Skeleton w="60%" h={18} className="rounded-md" />
          <Skeleton w="88%" h={11} className="rounded-md" />
          <Skeleton w="72%" h={11} className="rounded-md" />
          <Skeleton h={44} className="mt-1 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Pannello in ossidiana (beat del giorno, piano e crediti, asta in corso). */
export function SkeletonStage({ className, minHeight = 220, children }: { className?: string; minHeight?: number; children?: ReactNode }) {
  return (
    <div aria-hidden className={cn("obsidian grid content-end gap-3 rounded-[28px] p-5 sm:p-6", className)} style={{ minHeight }}>
      {children ?? (
        <>
          <Skeleton dark w={110} h={10} className="rounded-md" />
          <Skeleton dark w="62%" h={48} className="rounded-xl" />
          <Skeleton dark w="40%" h={14} className="rounded-md" />
          <Skeleton dark h={52} className="mt-2 w-full rounded-full" />
        </>
      )}
    </div>
  );
}
