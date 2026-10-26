import { Gavel, House, Mic, Package, Play, Search, UserRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  /** Voce centrale della barra (il tasto rosso di registrazione). */
  center?: boolean;
}

/**
 * Le 7 sezioni, nello stesso ordine in basso su mobile (come Instagram) e in alto da desktop:
 * Home, Swipe, Cerca, Registra (al centro), Aste, Kit, Profilo.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/beats", label: "Home", icon: House, match: (p) => p === "/beats" },
  { href: "/beats/swipe", label: "Swipe", icon: Play, match: (p) => p.startsWith("/beats/swipe") },
  { href: "/beats/cerca", label: "Cerca", icon: Search, match: (p) => p.startsWith("/beats/cerca") },
  {
    href: "/beats/registra",
    label: "Registra",
    icon: Mic,
    match: (p) => p.startsWith("/beats/registra") || p.startsWith("/beats/master"),
    center: true,
  },
  { href: "/beats/aste", label: "Aste", icon: Gavel, match: (p) => p.startsWith("/beats/aste") },
  { href: "/beats/kit", label: "Kit", icon: Package, match: (p) => p.startsWith("/beats/kit") },
  {
    href: "/beats/profilo",
    label: "Profilo",
    icon: UserRound,
    match: (p) => ["/beats/profilo", "/beats/piani", "/beats/wrapped", "/beats/stanza"].some((x) => p.startsWith(x)),
  },
];
