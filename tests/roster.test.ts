import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoDeck, demoRosterUpdates } from "../src/services/demo";
import { emptySession, useAppStore } from "../src/store/useAppStore";
import { sinceMatchPerformance, sortRoster } from "../src/utils/roster";
import type { PnlSummary } from "../src/types";

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  useAppStore.setState({
    mode: "demo",
    demo: emptySession(),
    live: emptySession(),
  });
  useAppStore.getState().setDeck("demo", demoDeck());
  for (let i = 0; i < 4; i++) useAppStore.getState().swipe("right");
});

describe("roster decisions", () => {
  it("sorts gains, losses, zero and pending results in both directions without mutating the roster", () => {
    const source = useAppStore.getState().demo.roster.map((r, i) => ({
      ...r,
      pnlSinceAdded: [null, 100, -50, 0][i],
      winRateSinceAdded: [null, 0.8, 0, 0.5][i],
    }));
    for (const [metric, key] of [
      ["pnl", "pnlSinceAdded"],
      ["winRate", "winRateSinceAdded"],
    ] as const) {
      expect(sortRoster(source, metric, "worst").map((r) => r[key])).toEqual(
        metric === "pnl" ? [-50, 0, 100, null] : [0, 0.5, 0.8, null],
      );
      expect(sortRoster(source, metric, "best").map((r) => r[key])).toEqual(
        metric === "pnl" ? [100, 0, -50, null] : [0.8, 0.5, 0, null],
      );
    }
    expect(source[0].pnlSinceAdded).toBeNull();
  });

  it("does not invent a zero-percent win rate for wallets with no sales or unknown data", () => {
    const summary = {
      realized_pnl_usd: 0,
      win_rate: 0,
      traded_times: 0,
    } as PnlSummary;
    expect(sinceMatchPerformance(summary)).toEqual({
      pnl: 0,
      winRate: null,
      sales: 0,
    });
    expect(sinceMatchPerformance({ ...summary, traded_times: 3 }).winRate).toBe(
      0,
    );
    expect(
      sinceMatchPerformance({ ...summary, traded_times: 3, win_rate: 73 })
        .winRate,
    ).toBeNull();
    expect(
      sinceMatchPerformance({ ...summary, traded_times: NaN }).winRate,
    ).toBeNull();
  });

  it("preserves nicknames across reload, demo reset and breakup, and keeps live names separate", async () => {
    const address = useAppStore.getState().demo.roster[0].wallet.address;
    useAppStore
      .getState()
      .setNickname("demo", address.toUpperCase(), "  Pepe Whale  ");
    useAppStore.getState().setNickname("live", address, "Live Whale");
    useAppStore.getState().breakUp(address);
    useAppStore.getState().resetDemoSession();
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().demo.nicknames[address]).toBe("Pepe Whale");
    expect(useAppStore.getState().live.nicknames[address]).toBe("Live Whale");
    useAppStore.getState().setNickname("demo", address, "  ");
    expect(useAppStore.getState().demo.nicknames[address]).toBeUndefined();
  });

  it("retains prior performance and holdings on failed requests, and accepts empty holdings", () => {
    const entry = useAppStore.getState().demo.roster[0];
    const address = entry.wallet.address;
    const updates = demoRosterUpdates([entry]);
    useAppStore.getState().applyPoll("demo", [], updates);
    const checked = useAppStore.getState().demo.roster[0];
    useAppStore.getState().applyPoll("demo", [], {
      [address]: { addedAt: entry.addedAt, holdings: null },
    });
    const failed = useAppStore.getState().demo.roster[0];
    expect(failed.pnlUpdatedAt).toBe(checked.pnlUpdatedAt);
    expect(failed.winRateSinceAdded).toBe(checked.winRateSinceAdded);
    expect(failed.holdingsUpdatedAt).toBe(checked.holdingsUpdatedAt);
    expect(failed.wallet.currentHoldings).toEqual(
      checked.wallet.currentHoldings,
    );
    expect(failed.holdingsError).toBe(true);
    useAppStore.getState().applyPoll("demo", [], {
      [address]: { addedAt: entry.addedAt, holdings: [] },
    });
    expect(
      useAppStore.getState().demo.roster[0].wallet.currentHoldings,
    ).toEqual([]);
    expect(useAppStore.getState().demo.roster[0].holdingsError).toBe(false);
  });

  it("ignores a response for a previous matching period", () => {
    const entry = useAppStore.getState().demo.roster[0];
    useAppStore.getState().applyPoll("demo", [], {
      [entry.wallet.address]: {
        addedAt: entry.addedAt - 1,
        performance: { pnl: 999, winRate: 1, sales: 9 },
        holdings: [],
      },
    });
    expect(useAppStore.getState().demo.roster[0].pnlSinceAdded).toBeNull();
    expect(useAppStore.getState().demo.roster[0].holdingsUpdatedAt).toBeNull();
  });

  it("migrates existing saved rosters without substituting historical win rates", async () => {
    const legacy = useAppStore.getState().demo;
    storage.set(
      "smart-crush-v1",
      JSON.stringify({
        version: 1,
        state: {
          mode: "demo",
          demo: {
            ...legacy,
            nicknames: undefined,
            roster: legacy.roster.map((r) => ({
              wallet: r.wallet,
              addedAt: r.addedAt,
              pnlSinceAdded: 0,
              pnlUpdatedAt: r.addedAt,
            })),
          },
          live: emptySession(),
        },
      }),
    );
    await useAppStore.persist.rehydrate();
    const migrated = useAppStore.getState().demo;
    expect(migrated.roster).toHaveLength(4);
    expect(migrated.deck).toEqual(legacy.deck);
    expect(migrated.nicknames).toEqual({});
    expect(migrated.roster[0].winRateSinceAdded).toBeNull();
    expect(migrated.roster[0].holdingsUpdatedAt).toBeNull();
    expect(migrated.lastPolledAt).toBe(0);
  });
});
