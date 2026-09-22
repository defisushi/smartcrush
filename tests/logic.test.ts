import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptySession, useAppStore } from "../src/store/useAppStore";
import { demoAddress, demoDeck } from "../src/services/demo";
import { buildSignals, dexLink } from "../src/services/signals";
import { normalizeProfile, retryDelay } from "../src/services/nansen";
import { matchTime } from "../src/utils/formatters";
import type { PnlSummary, RawTrade } from "../src/types";
const storage = new Map<string, string>();
beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
  vi.stubGlobal("window", new EventTarget());
  storage.clear();
  useAppStore.setState({
    mode: "demo",
    demo: emptySession(),
    live: emptySession(),
  });
});
describe("display formatting", () => {
  it("shows relative match time on the same day and a compact date afterward", () => {
    const now = new Date(2026, 8, 19, 15, 30).getTime();

    expect(matchTime(new Date(2026, 8, 19, 13, 30).getTime(), now)).toBe(
      "2h ago",
    );
    expect(matchTime(new Date(2026, 8, 18, 23, 59).getTime(), now)).toBe(
      "18 Sep 26",
    );
  });
});
describe("swiping and roster lifecycle", () => {
  it("holds the eleventh card when full, then resumes after a breakup", () => {
    useAppStore.getState().setDeck("demo", demoDeck().slice(0, 20));
    for (let i = 0; i < 10; i++)
      expect(useAppStore.getState().swipe("right")).toBe("matched");
    const before = useAppStore.getState().demo;
    expect(useAppStore.getState().swipe("right")).toBe("full");
    expect(useAppStore.getState().demo.deckPosition).toBe(10);
    expect(useAppStore.getState().demo.heldWalletAddress).toBe(
      before.deck[10].address,
    );
    // A session boundary cannot replace the prospect waiting for a free slot.
    useAppStore.getState().setDeck("demo", demoDeck().slice(20, 40));
    expect(useAppStore.getState().demo.deck[10].address).toBe(
      before.deck[10].address,
    );
    useAppStore.getState().breakUp(before.roster[0].wallet.address);
    expect(useAppStore.getState().swipe("right")).toBe("matched");
    expect(useAppStore.getState().demo.roster.at(-1)?.wallet.address).toBe(
      before.deck[10].address,
    );
    expect(useAppStore.getState().demo.roster).toHaveLength(10);
  });
  it("marks displayed wallets seen, passes, and preserves separate live/demo state", () => {
    useAppStore.getState().setDeck("demo", demoDeck().slice(0, 20));
    expect(
      useAppStore.getState().demo.seenWallets[demoAddress(0)],
    ).toBeGreaterThan(0);
    useAppStore.getState().swipe("left");
    expect(useAppStore.getState().demo.roster).toHaveLength(0);
    expect(
      useAppStore.getState().demo.seenWallets[demoAddress(1)],
    ).toBeGreaterThan(0);
    useAppStore.getState().setMode("live");
    expect(useAppStore.getState().live.deckPosition).toBe(0);
    expect(useAppStore.getState().demo.deckPosition).toBe(1);
  });
  it("deduplicates polls and removes a broken-up wallet even during an in-flight poll", () => {
    useAppStore.getState().setDeck("demo", demoDeck());
    useAppStore.getState().swipe("right");
    const signals = buildSignals([trade()], { [demoAddress(0)]: [] }, [
      demoAddress(0),
    ]);
    useAppStore.getState().applyPoll("demo", signals, {
      [demoAddress(0)]: {
        addedAt: useAppStore.getState().demo.roster[0].addedAt,
        performance: { pnl: 123, winRate: 0.5, sales: 2 },
      },
    });
    useAppStore.getState().applyPoll("demo", signals, {});
    expect(useAppStore.getState().demo.signals).toHaveLength(1);
    expect(useAppStore.getState().demo.roster[0].pnlSinceAdded).toBe(123);
    useAppStore.getState().breakUp(demoAddress(0));
    useAppStore.getState().applyPoll("demo", signals, {});
    expect(useAppStore.getState().demo.signals).toHaveLength(0);
  });
  it("serializes roster, deck position and expiry for reloads", () => {
    useAppStore.getState().setDeck("demo", demoDeck());
    useAppStore.getState().swipe("right");
    const saved = JSON.parse(storage.get("smart-crush-v1")!);
    expect(saved.state.demo.roster).toHaveLength(1);
    expect(saved.state.demo.deckPosition).toBe(1);
    expect(saved.state.demo.deckRefreshAt).toBeGreaterThan(Date.now());
  });
});
function trade(overrides: Partial<RawTrade> = {}): RawTrade {
  return {
    trader_address: demoAddress(0),
    token_bought_symbol: "HOOD",
    token_sold_symbol: "USDC",
    token_bought_address: demoAddress(100),
    token_sold_address: demoAddress(101),
    token_bought_amount: 10,
    token_sold_amount: 100,
    trade_value_usd: 100,
    block_timestamp: new Date(Date.now() - 3600000).toISOString(),
    transaction_hash: "0xabc",
    ...overrides,
  };
}
describe("signal interpretation", () => {
  it("identifies new positions by reversing the buy from the current balance", () => {
    const holdings = {
      [demoAddress(0)]: [
        {
          address: demoAddress(100),
          symbol: "HOOD",
          holdingAmount: 10,
          holdingUsd: 100,
          unrealizedRoi: null,
        },
      ],
    };
    const signals = buildSignals([trade(), trade()], holdings, [
      demoAddress(0),
    ]);
    expect(signals).toHaveLength(1);
    expect(signals[0].contextBadge).toBe("new_position");
    expect(signals[0].quantity).toBe(10);
  });
  it("preserves both legs of a token-to-token swap and classifies exits", () => {
    const signals = buildSignals(
      [trade({ token_sold_symbol: "PEPE" })],
      { [demoAddress(0)]: [] },
      [demoAddress(0)],
    );
    expect(signals).toHaveLength(2);
    expect(signals.find((s) => s.action === "sell")?.contextBadge).toBe(
      "full_exit",
    );
    expect(new Set(signals.map((s) => s.id)).size).toBe(2);
  });
  it("does not invent context when holdings or quantities are missing", () => {
    expect(
      buildSignals([trade()], { [demoAddress(0)]: null }, [demoAddress(0)])[0]
        .contextBadge,
    ).toBe("unknown");
    expect(
      buildSignals(
        [trade({ token_bought_amount: undefined })],
        { [demoAddress(0)]: [] },
        [demoAddress(0)],
      )[0].contextBadge,
    ).toBe("unknown");
    expect(buildSignals([trade()], {}, [demoAddress(2)])).toHaveLength(0);
  });
  it("reconstructs a buy followed by a partial sale", () => {
    const rows = [
      trade(),
      trade({
        token_bought_symbol: "USDC",
        token_sold_symbol: "HOOD",
        token_bought_address: demoAddress(101),
        token_sold_address: demoAddress(100),
        token_sold_amount: 4,
        block_timestamp: new Date(Date.now() - 1800000).toISOString(),
        transaction_hash: "0xdef",
      }),
    ];
    const holdings = {
      [demoAddress(0)]: [
        {
          address: demoAddress(100),
          symbol: "HOOD",
          holdingAmount: 6,
          holdingUsd: 60,
          unrealizedRoi: null,
        },
      ],
    };
    const signals = buildSignals(rows, holdings, [demoAddress(0)]);
    expect(signals[0].contextBadge).toBe("taking_profit");
    expect(signals[1].contextBadge).toBe("new_position");
  });
});
describe("Nansen normalization and connection safety", () => {
  it("uses the current documented ROI ratio rather than dividing it by 100", () => {
    const summary = {
      win_rate: 0.73,
      realized_pnl_usd: 847291,
      realized_pnl_percent: 1.2,
      traded_token_count: 3,
      traded_times: 10,
      top5_tokens: [],
    } satisfies PnlSummary;
    const result = normalizeProfile(
      demoAddress(0),
      null,
      summary,
      [
        {
          token_address: demoAddress(100),
          token_symbol: "HOOD",
          roi_percent_realised: 141,
          pnl_usd_realised: 100,
          holding_amount: 0,
          holding_usd: 0,
        },
      ],
      null,
    );
    expect(result.topTokens[0].realizedRoi).toBe(142);
    expect(result.holdingsAvailable).toBe(false);
  });
  it("honors Retry-After seconds and HTTP dates", () => {
    expect(retryDelay("4", 0)).toBe(4000);
    expect(
      retryDelay(
        "Fri, 18 Sep 2026 12:00:05 GMT",
        0,
        Date.parse("2026-09-18T12:00:00Z"),
      ),
    ).toBe(5000);
    expect(retryDelay(null, 2)).toBe(4000);
  });
  it("requires an explicitly configured HTTPS DEX and safely encodes tokens", () => {
    expect(dexLink(undefined, "0xabc")).toBeNull();
    expect(dexLink("javascript:{token}", "0xabc")).toBeNull();
    expect(dexLink("https://dex.example/swap?token={token}", "0xabc")).toBe(
      "https://dex.example/swap?token=0xabc",
    );
  });
});
