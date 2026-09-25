"use client";

import { useState } from "react";
import { directionsUrl, fullAddress, mapsQuery, studio } from "@/lib/studio";

/**
 * Mappa in dark mode con pattern "facade":
 * al caricamento mostra una mappa stilizzata leggera (SVG, zero richieste esterne → Lighthouse 100
 * e nessun cookie di terze parti prima del consenso). Google Maps viene caricato solo al click.
 */
export function MapEmbed() {
  const [interactive, setInteractive] = useState(false);
  const query = studio.geo ? `${studio.geo.lat},${studio.geo.lng}` : mapsQuery;
  const embedSrc = `https://maps.google.com/maps?q=${query}&z=16&hl=it&output=embed`;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-obsidian-2">
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
        {interactive ? (
          <iframe
            title={`Mappa: ${studio.name}, ${fullAddress}`}
            src={embedSrc}
            className="absolute inset-0 h-full w-full border-0 [filter:grayscale(1)_invert(0.92)_brightness(0.9)_contrast(1.05)]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setInteractive(true)}
            className="group absolute inset-0 h-full w-full text-left"
            data-cursor="Mappa"
            aria-label="Carica la mappa interattiva di Google Maps"
          >
            <StylizedMap />
            <span className="absolute bottom-5 left-5 rounded-full border border-white/15 bg-obsidian/80 px-4 py-2 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-mist backdrop-blur transition-colors group-hover:border-chrome group-hover:text-chrome">
              Carica mappa interattiva
            </span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 p-5">
        <address className="not-italic">
          <span className="block font-semibold text-white">{studio.name}</span>
          <span className="block text-sm text-mist">{fullAddress}</span>
        </address>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-chrome px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-obsidian transition-shadow hover:shadow-[0_0_30px_-4px_rgba(255,255,255,0.9)]"
        >
          Indicazioni stradali ↗
        </a>
      </div>
    </div>
  );
}

function StylizedMap() {
  return (
    <svg viewBox="0 0 800 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E6E6E6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#E6E6E6" stopOpacity="0" />
        </radialGradient>
        <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0v40" fill="none" stroke="#1C1C1C" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="800" height="500" fill="#101010" />
      <rect width="800" height="500" fill="url(#map-grid)" />
      {/* Tracciati stilizzati */}
      <path d="M-20 140 C 120 180, 220 120, 330 200 S 520 330, 820 300" fill="none" stroke="#8A8A8A" strokeOpacity="0.45" strokeWidth="10" strokeLinecap="round" />
      <path d="M140 520 C 220 420, 300 380, 360 290 S 420 190, 470 -20" fill="none" stroke="#8A8A8A" strokeOpacity="0.3" strokeWidth="6" strokeLinecap="round" />
      {/* Strade principali */}
      <g fill="none" stroke="#2C2C2C" strokeLinecap="round">
        <path d="M0 260 L800 230" strokeWidth="9" />
        <path d="M390 0 L420 500" strokeWidth="9" />
        <path d="M0 420 C 200 380, 500 460, 800 400" strokeWidth="6" />
        <path d="M120 0 C 180 150, 160 350, 240 500" strokeWidth="5" />
        <path d="M620 0 C 560 160, 640 330, 600 500" strokeWidth="5" />
        <path d="M0 90 L800 60" strokeWidth="4" />
        <circle cx="405" cy="245" r="120" strokeWidth="5" strokeOpacity="0.8" />
      </g>
      <g fill="none" stroke="#1A1A1A" strokeWidth="2.5">
        <path d="M60 0 L90 500M250 0 L300 500M520 0 L500 500M720 0 L760 500M0 170 L800 150M0 340 L800 320" />
      </g>
      {/* Pin studio */}
      <circle cx="405" cy="245" r="140" fill="url(#map-glow)" />
      <circle cx="405" cy="245" r="26" fill="none" stroke="#E6E6E6" strokeOpacity="0.5">
        <animate attributeName="r" from="14" to="60" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" from="0.7" to="0" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="405" cy="245" r="10" fill="#E6E6E6" />
      <circle cx="405" cy="245" r="4" fill="#0D0D0D" />
      <text x="425" y="232" fill="#FFFFFF" fontFamily="ui-sans-serif, system-ui" fontSize="18" fontWeight="700">
        {studio.name}
      </text>
      <text x="425" y="254" fill="#B5B5B5" fontFamily="ui-monospace, monospace" fontSize="12" letterSpacing="2">
        ARCUGNANO · VICENZA
      </text>
    </svg>
  );
}
