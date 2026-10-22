/** Torna in cima con dolcezza (rispetta "riduci movimento"). */
export function scrollToTop() {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}
