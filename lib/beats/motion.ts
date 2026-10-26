/**
 * Molle condivise (framer-motion): tutte le animazioni del negozio usano la fisica delle molle,
 * non curve ease-in-out. Valori pensati per 60/120 Hz: rigidi abbastanza da non "galleggiare".
 */
import type { Transition } from "framer-motion";

/** Pressione e rilascio dei tasti: risposta immediata, piccolo rimbalzo. */
export const SPRING_PRESS: Transition = { type: "spring", stiffness: 700, damping: 30, mass: 0.6 };
/** Elementi che entrano o cambiano posizione (indicatori, schede). */
export const SPRING_MOVE: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 };
/** Grandi superfici (pagine, fogli): più massa, nessun rimbalzo visibile. */
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 260, damping: 32, mass: 1 };
/** Numeri e anelli che si riempiono. */
export const SPRING_FILL: Transition = { type: "spring", stiffness: 90, damping: 20, mass: 1 };
