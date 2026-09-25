"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { BookingTrigger } from "@/components/BookingModal";
import { Magnetic } from "@/components/Magnetic";
import { useLenis } from "@/components/SmoothScroll";
import { buttonStyles, cn } from "@/lib/cn";
import { studio } from "@/lib/studio";

const LINKS = [
  { href: "#studio-foto", label: "Lo studio" },
  { href: "#ascolta", label: "Ascolta" },
  { href: "#servizi", label: "Servizi" },
  { href: "#sessione", label: "Sessione" },
  { href: "#recensioni", label: "Recensioni" },
  { href: "#contatti", label: "Contatti" },
];

export function Logo() {
  return (
    <a href="#top" className="group flex items-center gap-3" aria-label={`${studio.name} – torna all'inizio`}>
      <Image
        src="/brand/logo-br-120.webp"
        alt=""
        width={60}
        height={47}
        unoptimized
        className="h-11 w-auto drop-shadow-[0_0_12px_rgba(255,255,255,0.25)] transition-transform duration-700 ease-[var(--ease-expo)] group-hover:rotate-[-6deg] group-hover:scale-110"
      />
      <span className="whitespace-nowrap font-display text-xl leading-none text-white sm:text-2xl">
        Backrooms <em className="text-gold">Studio</em>
      </span>
    </a>
  );
}

export function Navbar() {
  const { scrollY } = useScroll();
  const lenis = useLenis();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 40);
    setHidden(y > prev && y > 400 && !menuOpen);
  });

  useEffect(() => {
    if (menuOpen) lenis?.stop();
    else lenis?.start();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lenis, menuOpen]);

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50"
      animate={{ y: hidden ? "-110%" : "0%" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <a
        href="#contenuto"
        className="sr-only rounded-full bg-gold px-4 py-2 font-semibold text-obsidian focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70]"
      >
        Salta al contenuto
      </a>
      <div className="container-x pt-4">
        <nav
          aria-label="Navigazione principale"
          className={cn(
            "flex items-center justify-between rounded-full px-4 py-3 transition-all duration-700 ease-[var(--ease-expo)] sm:px-6",
            scrolled || menuOpen ? "glass" : "border border-transparent",
          )}
        >
          <Logo />

          <ul className="hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="group relative block overflow-hidden px-4 py-2 text-sm font-medium text-mist transition-colors hover:text-white"
                >
                  <span className="block transition-transform duration-500 ease-[var(--ease-expo)] group-hover:-translate-y-full">{l.label}</span>
                  <span aria-hidden="true" className="absolute inset-x-4 top-full block text-gold transition-transform duration-500 ease-[var(--ease-expo)] group-hover:-translate-y-full">
                    {l.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <Magnetic className="hidden sm:inline-block">
              <BookingTrigger className={buttonStyles.small}>Prenota</BookingTrigger>
            </Magnetic>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Chiudi il menu" : "Apri il menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="relative block h-3 w-5" aria-hidden="true">
                <span className={cn("absolute left-0 h-px w-5 bg-white transition-all duration-500", menuOpen ? "top-1.5 rotate-45" : "top-0")} />
                <span className={cn("absolute left-0 h-px w-5 bg-white transition-all duration-500", menuOpen ? "top-1.5 -rotate-45" : "top-3")} />
              </span>
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="glass mt-3 rounded-3xl p-6 lg:hidden"
            >
              <ul className="grid gap-1">
                {LINKS.map((l, i) => (
                  <motion.li key={l.href} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                    <a href={l.href} onClick={() => setMenuOpen(false)} className="block py-2 font-display text-4xl text-white">
                      {l.label}
                    </a>
                  </motion.li>
                ))}
              </ul>
              <BookingTrigger className={cn(buttonStyles.primary, "mt-6 w-full")}>Prenota una Sessione</BookingTrigger>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
