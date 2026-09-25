"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { BookingTrigger } from "@/components/BookingModal";
import { Magnetic } from "@/components/Magnetic";
import { buttonStyles, cn } from "@/lib/cn";
import { playlistUrl, reviews } from "@/lib/content";
import { studio } from "@/lib/studio";

/** Voci di navigazione: quelle di sezioni non ancora attive (playlist, recensioni) vengono omesse. */
const LINKS = [
  { href: "#lounge", label: "Lounge", short: "Lounge", icon: "lounge" },
  { href: "#servizi", label: "Servizi", short: "Servizi", icon: "services" },
  { href: "#live", label: "Live", short: "Live", icon: "live" },
  ...(playlistUrl ? [{ href: "#ascolta", label: "Ascolta", short: "Ascolta", icon: "listen" }] : []),
  ...(reviews.length ? [{ href: "#recensioni", label: "Testimonianze", short: "Artisti", icon: "reviews" }] : []),
  { href: "#contatti", label: "Contatti", short: "Contatti", icon: "contact" },
];

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    lounge: <path d="M4 13v-2a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2M3 15a2 2 0 0 1 4 0v1h10v-1a2 2 0 0 1 4 0v4H3v-4Z" />,
    services: <path d="M4 6h16M4 12h16M4 18h10" />,
    live: (
      <>
        <circle cx="12" cy="12" r="2.5" />
        <path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" />
      </>
    ),
    listen: <path d="M9 18V6l11-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm11-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z" />,
    reviews: <path d="M5 5h14v10H9l-4 4V5Z" />,
    contact: <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  };
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Logo() {
  return (
    <a href="#top" className="group flex items-center gap-3" aria-label={`${studio.name} – torna all'inizio`}>
      <Image
        src="/brand/logo-br-120.webp"
        alt=""
        width={60}
        height={47}
        unoptimized
        className="h-10 w-auto drop-shadow-[0_0_12px_rgba(255,255,255,0.25)] transition-transform duration-700 ease-[var(--ease-expo)] group-hover:rotate-[-6deg] group-hover:scale-110 sm:h-11"
      />
      <span className="whitespace-nowrap font-display text-xl leading-none text-white sm:text-2xl">
        Backrooms <em className="chrome-text">Studio</em>
      </span>
    </a>
  );
}

/** Barra superiore (desktop: link completi · mobile: logo + CTA) + barra inferiore su mobile. */
export function Navbar() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 40);
    setHidden(y > prev && y > 400);
  });

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        animate={{ y: hidden ? "-110%" : "0%" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <a
          href="#contenuto"
          className="sr-only rounded-full bg-white px-4 py-2 font-semibold text-obsidian focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70]"
        >
          Salta al contenuto
        </a>
        <div className="container-x pt-3 sm:pt-4">
          <nav
            aria-label="Navigazione principale"
            className={cn(
              "flex items-center justify-between rounded-full px-3 py-2.5 transition-all duration-700 ease-[var(--ease-expo)] sm:px-6 sm:py-3",
              scrolled ? "glass" : "border border-transparent",
            )}
          >
            <Logo />

            <ul className="hidden items-center gap-1 lg:flex">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="group relative block overflow-hidden px-4 py-2 text-sm font-medium text-mist transition-colors hover:text-white">
                    <span className="block transition-transform duration-500 ease-[var(--ease-expo)] group-hover:-translate-y-full">{l.label}</span>
                    <span aria-hidden="true" className="absolute inset-x-4 top-full block text-white transition-transform duration-500 ease-[var(--ease-expo)] group-hover:-translate-y-full">
                      {l.label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <Magnetic>
              <BookingTrigger className={buttonStyles.small}>Prenota</BookingTrigger>
            </Magnetic>
          </nav>
        </div>
      </motion.header>

      {/* Barra di navigazione inferiore: solo mobile/tablet, pensata per il traffico dal link in bio */}
      <nav
        aria-label="Navigazione rapida"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-obsidian/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {LINKS.slice(0, 4).map((l) => (
            <li key={l.href} className="flex-1">
              <a
                href={l.href}
                className="press flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-mist transition-colors active:text-white"
              >
                <NavIcon name={l.icon} />
                {l.short}
              </a>
            </li>
          ))}
          <li className="flex flex-1 items-center justify-center">
            <BookingTrigger className="press chrome-surface flex h-11 items-center justify-center rounded-full px-4 text-[0.68rem] font-bold uppercase tracking-[0.14em]">
              Prenota
            </BookingTrigger>
          </li>
        </ul>
      </nav>
    </>
  );
}
