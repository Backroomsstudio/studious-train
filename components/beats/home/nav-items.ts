import { Flame, Gavel, House, Layers, LibraryBig, Mic, Package, Search, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  /** Solo nella barra desktop (la tab bar mobile resta a 5 voci). */
  desktopOnly?: boolean;
  /** Voce centrale della tab bar mobile (il tasto rosso di registrazione). */
  center?: boolean;
  /** Mostra il contatore dei messaggi non letti di Cerco feat. */
  featBadge?: boolean;
}

/**
 * Tab bar mobile: Home, Feed, Registra al centro, Studio, Libreria (Cerca passa alla lente
 * nell'header). Da desktop anche Cerca, Swipe, Kit, Aste e Feat; Master A/B si apre dallo Studio.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/beats", label: "Home", icon: House, match: (p) => p === "/beats" },
  { href: "/beats/feed", label: "Feed", icon: Flame, match: (p) => p.startsWith("/beats/feed") },
  { href: "/beats/cerca", label: "Cerca", icon: Search, match: (p) => p.startsWith("/beats/cerca"), desktopOnly: true },
  { href: "/beats/swipe", label: "Swipe", icon: Layers, match: (p) => p.startsWith("/beats/swipe"), desktopOnly: true },
  { href: "/beats/registra", label: "Registra", icon: Mic, match: (p) => p.startsWith("/beats/registra"), center: true },
  {
    href: "/beats/studio",
    label: "Studio",
    icon: SlidersHorizontal,
    match: (p) => p.startsWith("/beats/studio") || p.startsWith("/beats/master"),
  },
  { href: "/beats/kit", label: "Kit", icon: Package, match: (p) => p.startsWith("/beats/kit"), desktopOnly: true },
  { href: "/beats/aste", label: "Aste", icon: Gavel, match: (p) => p.startsWith("/beats/aste"), desktopOnly: true },
  { href: "/beats/feat", label: "Feat", icon: Users, match: (p) => p.startsWith("/beats/feat"), desktopOnly: true, featBadge: true },
  { href: "/beats/libreria", label: "Libreria", icon: LibraryBig, match: (p) => p.startsWith("/beats/libreria") },
];
