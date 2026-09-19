import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  Mode,
  RosterUpdate,
  SessionData,
  Signal,
  Theme,
  WalletProfile,
} from "../types";
import {
  DAY_MS,
  ROSTER_LIMIT,
  SESSION_MS,
  STORAGE_KEY,
} from "../utils/constants";
export const emptySession = (): SessionData => ({
  nicknames: {},
  heldWalletAddress: null,
  deck: [],
  deckPosition: 0,
  deckRefreshAt: 0,
  seenWallets: {},
  roster: [],
  signals: [],
  seenTxHashes: [],
  lastPolledAt: 0,
});
interface Store {
  mode: Mode | null;
  theme: Theme;
  demo: SessionData;
  live: SessionData;
  setMode: (mode: Mode | null) => void;
  setTheme: (theme: Theme) => void;
  setDeck: (mode: Mode, wallets: WalletProfile[]) => void;
  resetDemoSession: () => void;
  swipe: (
    direction: "left" | "right",
    expectedAddress?: string,
  ) => "passed" | "matched" | "full" | "empty";
  breakUp: (address: string) => void;
  setNickname: (mode: Mode, address: string, nickname: string) => void;
  applyPoll: (
    mode: Mode,
    signals: Signal[],
    updates: Record<string, RosterUpdate>,
  ) => void;
}
const safeStorage = {
  getItem: (name: string) => {
    try {
      const v = localStorage.getItem(name);
      if (v) JSON.parse(v);
      return v;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      window.dispatchEvent(new Event("storage-unavailable"));
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* storage unavailable */
    }
  },
};
export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      mode: null,
      theme: "light",
      demo: emptySession(),
      live: emptySession(),
      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      setDeck: (mode, deck) =>
        set((state) => {
          const data = state[mode];
          if (data.heldWalletAddress) return {};
          const seenWallets = Object.fromEntries(
            Object.entries(data.seenWallets).filter(
              ([, at]) => at > Date.now() - DAY_MS,
            ),
          );
          if (deck[0]) seenWallets[deck[0].address.toLowerCase()] = Date.now();
          return {
            [mode]: {
              ...data,
              deck,
              deckPosition: 0,
              deckRefreshAt: Date.now() + SESSION_MS,
              seenWallets,
            },
          };
        }),
      resetDemoSession: () =>
        set((state) => ({
          demo: {
            ...state.demo,
            heldWalletAddress: null,
            deck: [],
            deckPosition: 0,
            deckRefreshAt: 0,
            seenWallets: {},
          },
        })),
      swipe: (direction, expectedAddress) => {
        const { mode } = get();
        if (!mode) return "empty";
        const data = get()[mode],
          wallet = data.deck[data.deckPosition];
        if (!wallet || (expectedAddress && wallet.address !== expectedAddress))
          return "empty";
        if (direction === "right" && data.roster.length >= ROSTER_LIMIT) {
          set({ [mode]: { ...data, heldWalletAddress: wallet.address } });
          return "full";
        }
        const alreadyMatched = data.roster.some(
          (r) =>
            r.wallet.address.toLowerCase() === wallet.address.toLowerCase(),
        );
        set({
          [mode]: {
            ...data,
            deckPosition: data.deckPosition + 1,
            heldWalletAddress: null,
            seenWallets: {
              ...data.seenWallets,
              [wallet.address.toLowerCase()]: Date.now(),
              ...(data.deck[data.deckPosition + 1]
                ? {
                    [data.deck[data.deckPosition + 1].address.toLowerCase()]:
                      Date.now(),
                  }
                : {}),
            },
            roster:
              direction === "right" && !alreadyMatched
                ? [
                    ...data.roster,
                    {
                      wallet,
                      addedAt: Date.now(),
                      pnlSinceAdded: null,
                      pnlUpdatedAt: null,
                      winRateSinceAdded: null,
                      salesSinceAdded: null,
                      holdingsUpdatedAt: null,
                      holdingsError: false,
                    },
                  ]
                : data.roster,
          },
        });
        return direction === "right" ? "matched" : "passed";
      },
      breakUp: (address) => {
        const { mode } = get();
        if (!mode) return;
        const data = get()[mode];
        set({
          [mode]: {
            ...data,
            roster: data.roster.filter((r) => r.wallet.address !== address),
            signals: data.signals.filter(
              (s) => s.walletAddress.toLowerCase() !== address.toLowerCase(),
            ),
          },
        });
      },
      setNickname: (mode, address, nickname) =>
        set((state) => {
          const nicknames = { ...state[mode].nicknames };
          const value = nickname.trim().slice(0, 24);
          if (value) nicknames[address.toLowerCase()] = value;
          else delete nicknames[address.toLowerCase()];
          return { [mode]: { ...state[mode], nicknames } };
        }),
      applyPoll: (mode, signals, updates) =>
        set((state) => {
          const data = state[mode];
          const addresses = new Set(
            data.roster.map((r) => r.wallet.address.toLowerCase()),
          );
          const byId = new Map(
            data.signals
              .filter((s) => addresses.has(s.walletAddress.toLowerCase()))
              .map((s) => [s.id, s]),
          );
          for (const s of signals)
            if (addresses.has(s.walletAddress.toLowerCase())) byId.set(s.id, s);
          const merged = [...byId.values()]
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .slice(0, 1000);
          return {
            [mode]: {
              ...data,
              signals: merged,
              seenTxHashes: merged.map((s) => s.id),
              lastPolledAt: Date.now(),
              roster: data.roster.map((r) => {
                const update = updates[r.wallet.address];
                // A response from an earlier match must never update a rematched wallet.
                if (!update || update.addedAt !== r.addedAt) return r;
                const next = { ...r };
                if (update.performance) {
                  next.pnlSinceAdded = update.performance.pnl;
                  next.winRateSinceAdded = update.performance.winRate;
                  next.salesSinceAdded = update.performance.sales;
                  next.pnlUpdatedAt = Date.now();
                }
                if (update.holdings !== undefined) {
                  next.holdingsError = update.holdings === null;
                  if (update.holdings !== null) {
                    next.wallet = {
                      ...r.wallet,
                      currentHoldings: update.holdings.slice(0, 5),
                      holdingsAvailable: true,
                    };
                    next.holdingsUpdatedAt = Date.now();
                  }
                }
                return next;
              }),
            },
          };
        }),
    }),
    {
      name: STORAGE_KEY,
      version: 3,
      migrate: (persisted) => {
        const state = persisted as Pick<
          Store,
          "mode" | "theme" | "demo" | "live"
        > & {
          theme?: Theme;
        };
        if (state.theme !== "light" && state.theme !== "dark") {
          state.theme = "light";
        }
        for (const mode of ["demo", "live"] as const) {
          state[mode] = {
            ...emptySession(),
            ...state[mode],
            lastPolledAt: 0,
            roster: (state[mode]?.roster || []).map((entry) => ({
              ...entry,
              pnlSinceAdded: null,
              pnlUpdatedAt: null,
              winRateSinceAdded: null,
              salesSinceAdded: null,
              holdingsUpdatedAt: null,
              holdingsError: false,
            })),
          };
        }
        return state;
      },
      storage: createJSONStorage(() => safeStorage),
    },
  ),
);
