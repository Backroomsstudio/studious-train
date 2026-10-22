import { Flame, Gavel, House, LibraryBig, Package, Search, SlidersHorizontal, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  /** Solo nella barra desktop (la tab bar mobile resta a 5 voci). */
  desktopOnly?: boolean;
}

/** Le 5 voci della tab bar del mockup più Kit e Aste da desktop (da mobile si raggiungono dallo Studio). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/beats", label: "Home", icon: House, match: (p) => p === "/beats" },
  { href: "/beats/feed", label: "Feed", icon: Flame, match: (p) => p.startsWith("/beats/feed") },
  { href: "/beats/cerca", label: "Cerca", icon: Search, match: (p) => p.startsWith("/beats/cerca") },
  { href: "/beats/studio", label: "Studio", icon: SlidersHorizontal, match: (p) => p.startsWith("/beats/studio") },
  { href: "/beats/kit", label: "Kit", icon: Package, match: (p) => p.startsWith("/beats/kit"), desktopOnly: true },
  { href: "/beats/aste", label: "Aste", icon: Gavel, match: (p) => p.startsWith("/beats/aste"), desktopOnly: true },
  { href: "/beats/libreria", label: "Libreria", icon: LibraryBig, match: (p) => p.startsWith("/beats/libreria") },
];
