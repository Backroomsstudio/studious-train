/**
 * "La tua stanza": ambiente e bio della pagina profilo dell'artista, salvati nel browser.
 * I temi vengono dal prototipo (Level 0, Pool Rooms…); lo stile è in store.css (`.room-t-*`).
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useHydrated } from "./use-hydrated";

export const ROOM_THEMES = [
  { id: "level0", name: "Level 0", tone: "light", hint: "Moquette gialla e neon che ronza" },
  { id: "pool", name: "Pool Rooms", tone: "light", hint: "Piastrelle bianche e acqua ferma" },
  { id: "neon", name: "Neon", tone: "dark", hint: "Griglia blu elettrico nel buio" },
  { id: "chrome", name: "Chrome", tone: "light", hint: "Metallo spazzolato, come il negozio" },
  { id: "notte", name: "Notte", tone: "dark", hint: "Cielo viola e stelle" },
] as const;

export type RoomThemeId = (typeof ROOM_THEMES)[number]["id"];
export const DEFAULT_ROOM_THEME: RoomThemeId = "neon";

export const roomTheme = (id: string) => ROOM_THEMES.find((t) => t.id === id) ?? ROOM_THEMES[2];

interface RoomState {
  theme: RoomThemeId;
  bio: string;
  setTheme: (theme: RoomThemeId) => void;
  setBio: (bio: string) => void;
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set) => ({
      theme: DEFAULT_ROOM_THEME,
      bio: "",
      setTheme: (theme) => set({ theme }),
      setBio: (bio) => set({ bio: bio.slice(0, 160) }),
    }),
    { name: "backrooms-stanza", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

/** Tema e bio salvati (default finché la pagina non è idratata). */
export function useRoom(): { theme: RoomThemeId; bio: string; hydrated: boolean } {
  const hydrated = useHydrated();
  const theme = useRoomStore((s) => s.theme);
  const bio = useRoomStore((s) => s.bio);
  return { theme: hydrated ? theme : DEFAULT_ROOM_THEME, bio: hydrated ? bio : "", hydrated };
}
