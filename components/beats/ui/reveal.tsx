"use client";

import { useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { motionAllowed } from "@/lib/beats/prefs";

/**
 * Comparsa allo scorrimento: gli elementi salgono di 28px e tornano a scala piena, con un
 * piccolo ritardo a cascata (55 ms) e la curva "spring" del negozio.
 *
 * Il contenuto è SEMPRE visibile nell'HTML del server: lo stato nascosto lo aggiunge il client
 * solo dopo l'idratazione, e durante l'idratazione solo a quello che sta sotto la piega
 * (niente lampi su ciò che stai già guardando). Navigando tra le pagine, invece, anima tutto.
 * Con movimento ridotto, modalità leggera o senza IntersectionObserver non fa nulla.
 */

const STAGGER_MS = 55;
const MAX_STEPS = 7;
const CLEANUP_MS = 1500;
const DEFAULT_ITEMS = "li, article, [data-reveal]";

const noop = () => () => {};
/** `true` solo nel render di idratazione (snapshot del server), `false` nei montaggi successivi. */
const useHydrating = () => useSyncExternalStore(noop, () => false, () => true);

interface Revealer {
  /** Nasconde e osserva gli elementi; con `hydrating` solo quelli sotto la piega. */
  add: (targets: Element[], hydrating: boolean) => void;
  dispose: () => void;
}

function createRevealer(): Revealer | null {
  if (!motionAllowed() || typeof IntersectionObserver === "undefined") return null;
  const timers = new Set<number>();
  const tracked = new Set<HTMLElement>();
  const reset = (el: HTMLElement) => {
    el.classList.remove("reveal", "reveal-in");
    el.style.transitionDelay = "";
    tracked.delete(el);
  };
  const observer = new IntersectionObserver(
    (entries) => {
      let step = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        observer.unobserve(el);
        el.style.transitionDelay = `${Math.min(step++, MAX_STEPS) * STAGGER_MS}ms`;
        el.classList.add("reveal-in");
        // A comparsa finita togliamo tutto: restano le transizioni proprie dell'elemento.
        const t = window.setTimeout(() => {
          reset(el);
          timers.delete(t);
        }, CLEANUP_MS);
        timers.add(t);
      }
    },
    { rootMargin: "0px 0px -5% 0px", threshold: 0.05 },
  );
  return {
    add(targets, hydrating) {
      const fold = window.innerHeight;
      for (const el of targets as HTMLElement[]) {
        if (tracked.has(el) || (hydrating && el.getBoundingClientRect().top <= fold)) continue;
        tracked.add(el);
        el.classList.add("reveal");
        observer.observe(el);
      }
    },
    dispose() {
      observer.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      [...tracked].forEach(reset);
    },
  };
}

/** Ordine del documento: la cascata segue la lettura. */
const inDocumentOrder = (els: Iterable<Element>) =>
  [...els].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

type RevealTag = "div" | "section" | "ul" | "ol" | "article" | "aside";
type RevealProps = HTMLAttributes<HTMLElement> & { as?: RevealTag; children?: ReactNode };

/** Un singolo blocco che compare quando entra nello schermo. */
export function Reveal({ as = "div", children, ...rest }: RevealProps) {
  const Tag = as as "div";
  const ref = useRef<HTMLDivElement>(null);
  const hydrating = useHydrating();
  const firstRender = useRef(hydrating);
  useLayoutEffect(() => {
    const revealer = createRevealer();
    if (ref.current) revealer?.add([ref.current], firstRender.current);
    return () => revealer?.dispose();
  }, []);
  return (
    <Tag ref={ref} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * Contenitore che fa comparire a cascata i suoi elementi: quelli che corrispondono a `items`
 * (di default righe `li`, schede `article` e tutto ciò che ha `data-reveal`) e i figli diretti
 * che non ne contengono. Così un'intera pagina si avvolge una volta sola. Anche le righe aggiunte
 * dopo (risultati filtrati, scaffali disegnati dal client) entrano con la stessa cascata.
 */
export function RevealList({ as = "div", items = DEFAULT_ITEMS, children, ...rest }: RevealProps & { items?: string }) {
  const Tag = as as "div";
  const ref = useRef<HTMLDivElement>(null);
  const hydrating = useHydrating();
  const firstRender = useRef(hydrating);
  useLayoutEffect(() => {
    const root = ref.current;
    const revealer = createRevealer();
    if (!root || !revealer) return;
    const pick = (scope: Element, withChildren: boolean) => {
      const matched = [...(scope.matches(items) ? [scope] : []), ...scope.querySelectorAll(items)].filter((el) => !el.closest("[data-reveal-skip]"));
      // Un elemento annidato dentro un altro già animato non si anima due volte.
      const set = new Set(matched.filter((el) => !matched.some((other) => other !== el && other.contains(el))));
      if (withChildren) {
        for (const child of root.children) {
          if (!child.matches(items) && !child.querySelector(items) && !child.hasAttribute("data-reveal-skip")) set.add(child);
        }
      }
      return inDocumentOrder(set);
    };
    revealer.add(pick(root, true), firstRender.current);
    // Righe che arrivano dopo (filtri, scaffali disegnati dal client): entrano prima del paint, quindi niente lampi.
    const mutations = new MutationObserver((records) => {
      const added = records.flatMap((r) => [...r.addedNodes]).filter((n): n is Element => n instanceof Element && n.isConnected);
      revealer.add(added.flatMap((el) => pick(el, false)), false);
    });
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      revealer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `items` è una costante di chi lo usa
  }, []);
  return (
    <Tag ref={ref} {...rest}>
      {children}
    </Tag>
  );
}

/** Parallasse leggera per i loghi degli hero: segue `--sy` impostata dagli effetti globali. */
export function Parallax({ factor = 0.12, className, children }: { factor?: number; className?: string; children: ReactNode }) {
  return (
    <div className={className} data-parallax="" style={{ "--parallax": factor } as CSSProperties}>
      {children}
    </div>
  );
}
