import { create } from "zustand";
import type { PrivatePlayerState, PublicGameState } from "../../shared/game/types";

interface GameStore {
  publicState: PublicGameState | null;
  privateState: PrivatePlayerState | null;
  connection: "connecting" | "connected" | "disconnected";
  reconnecting: boolean;
  error: string | null;
  locale: "en" | "it";
  cheatsheetOpen: boolean;
  bidBuilderOpen: boolean;
  setPublicState: (state: PublicGameState | null) => void;
  setPrivateState: (state: PrivatePlayerState | null) => void;
  setConnection: (connection: GameStore["connection"]) => void;
  setReconnecting: (reconnecting: boolean) => void;
  setError: (error: string | null) => void;
  setLocale: (locale: GameStore["locale"]) => void;
  setCheatsheetOpen: (open: boolean) => void;
  setBidBuilderOpen: (open: boolean) => void;
  reset: () => void;
}

const savedLocale = (localStorage.getItem("poker-polacco-locale") === "it" ? "it" : "en") as "en" | "it";

export const useGameStore = create<GameStore>((set) => ({
  publicState: null,
  privateState: null,
  connection: "connecting",
  reconnecting: Boolean(localStorage.getItem("poker-polacco-session")),
  error: null,
  locale: savedLocale,
  cheatsheetOpen: localStorage.getItem("poker-polacco-cheatsheet") === "open",
  bidBuilderOpen: false,
  setPublicState: (publicState) => set({ publicState }),
  setPrivateState: (privateState) => set({ privateState }),
  setConnection: (connection) => set({ connection }),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  setError: (error) => set({ error }),
  setLocale: (locale) => {
    localStorage.setItem("poker-polacco-locale", locale);
    set({ locale });
  },
  setCheatsheetOpen: (cheatsheetOpen) => {
    localStorage.setItem("poker-polacco-cheatsheet", cheatsheetOpen ? "open" : "closed");
    set({ cheatsheetOpen });
  },
  setBidBuilderOpen: (bidBuilderOpen) => set({ bidBuilderOpen }),
  reset: () => set({ publicState: null, privateState: null, reconnecting: false, bidBuilderOpen: false }),
}));
