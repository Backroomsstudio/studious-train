import { Flame, House, LibraryBig, Search, SlidersHorizontal, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

/** Le 5 voci della tab bar del mockup. "Studio" porta ai servizi dello studio (mix, master, registrazione). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/beats", label: "Home", icon: House, match: (p) => p === "/beats" },
  { href: "/beats/feed", label: "Feed", icon: Flame, match: (p) => p.startsWith("/beats/feed") },
  { href: "/beats/cerca", label: "Cerca", icon: Search, match: (p) => p.startsWith("/beats/cerca") },
  { href: "/#servizi", label: "Studio", icon: SlidersHorizontal, match: () => false },
  { href: "/beats/libreria", label: "Libreria", icon: LibraryBig, match: (p) => p.startsWith("/beats/libreria") },
];
