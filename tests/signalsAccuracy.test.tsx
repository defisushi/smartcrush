import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildSignals } from "../src/services/signals";
import { buildSignalsSummary } from "../src/utils/signalSummary";
import { recentSignals } from "../src/utils/signalWindow";
import { emptySession, useAppStore } from "../src/store/useAppStore";
import { SignalCard } from "../src/components/SignalCard";
import { SignalsFeed } from "../src/components/SignalsFeed";
import { demoDeck } from "../src/services/demo";
import type { RawTrade, Signal } from "../src/types";

const now = Date.now();
const base: RawTrade = {
  trader_address: "0xabc",
  transaction_hash: "0xtx",
  block_timestamp: new Date(now - 1000).toISOString(),
  token_bought_address: "0xtoken",
  token_bought_symbol: "TOK",
  token_bought_amount: 10,
  token_sold_address: "0xusd",
  token_sold_symbol: "USDG",
  token_sold_amount: 100,
  trade_value_usd: 100,
};
const holdings = (amount: number) => ({
  "0xabc": [
    {
      address: "0xtoken",
      symbol: "TOK",
      holdingAmount: amount,
      holdingUsd: amount * 10,
      unrealizedRoi: null,
    },
  ],
});
const signal = (changes: Partial<Signal> = {}): Signal => ({
  id: "signal",
  walletAddress: "0xabc",
  walletLabel: null,
  action: "buy",
  tokenSymbol: "TOK",
  tokenAddress: "0xtoken",
  amountUsd: 100,
  quantity: 10,
  timestamp: base.block_timestamp,
  txHash: "0xtx",
  contextBadge: "unknown",
  ...changes,
});

describe("signal accuracy", () => {
  it("sums distinct routed legs once and classifies the combined purchase", () => {
    const second = {
      ...base,
      token_sold_address: "0xusdc",
      token_sold_symbol: "USDC",
      token_bought_amount: 20,
      trade_value_usd: 200,
    };
    const result = buildSignals(
      [
        base,
        second,
        { ...base, trader_address: "0xABC", transaction_hash: "0xTX" },
        second,
      ],
      holdings(30),
      ["0xabc"],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      quantity: 30,
      amountUsd: 300,
      contextBadge: "new_position",
    });
    expect(buildSignals([second, base], holdings(30), ["0xabc"])).toEqual(
      result,
    );
  });
  it("retains differing quantities for the same pair within one transaction", () => {
    const result = buildSignals(
      [
        base,
        {
          ...base,
          token_bought_amount: 20,
          token_sold_amount: 200,
          trade_value_usd: 200,
        },
      ],
      holdings(30),
      ["0xabc"],
    );
    expect(result[0]).toMatchObject({ quantity: 30, amountUsd: 300 });
  });
  it("does not infer position intent from a same-transaction round trip", () => {
    const sell = {
      ...base,
      token_bought_address: "0xusd",
      token_bought_symbol: "USDG",
      token_sold_address: "0xtoken",
      token_sold_symbol: "TOK",
      token_bought_amount: 100,
      token_sold_amount: 10,
    };
    const result = buildSignals([base, sell], holdings(0), ["0xabc"]);
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.contextBadge === "unknown")).toBe(true);
  });
  it("keeps incomplete aggregate values unknown and distinguishes real zero", () => {
    const result = buildSignals(
      [
        base,
        {
          ...base,
          token_sold_address: "0xother",
          token_bought_amount: 20,
          trade_value_usd: null,
        },
      ],
      holdings(30),
      ["0xabc"],
    );
    expect(result[0]).toMatchObject({ quantity: 30, amountUsd: null });
    expect(
      buildSignals([{ ...base, trade_value_usd: 0 }], holdings(10), [
        "0xabc",
      ])[0].amountUsd,
    ).toBe(0);
    expect(
      buildSignals([{ ...base, trade_value_usd: undefined }], holdings(10), [
        "0xabc",
      ])[0].amountUsd,
    ).toBeNull();
  });
  it("uses neutral partial-sale copy and renders unknown values as Unavailable", () => {
    const html = renderToStaticMarkup(
      <SignalCard
        signal={signal({
          action: "sell",
          contextBadge: "taking_profit",
          amountUsd: null,
        })}
        demo
        onCopy={() => {}}
      />,
    );
    expect(html).toContain("Reducing position");
    expect(html).toContain("Unavailable");
    expect(html).not.toContain("Taking profit");
    expect(html).not.toContain("$0");
  });
  it("omits incomplete tokens from net rankings but retains known shared-wallet counts", () => {
    const summary = buildSignalsSummary([
      signal(),
      signal({ id: "unknown-buy", walletAddress: "0xdef", amountUsd: null }),
      signal({ id: "sell", action: "sell", amountUsd: 10 }),
    ]);
    expect(summary.topNetBuys).toEqual([]);
    expect(summary.topNetSells).toEqual([]);
    expect(summary.topBuyOverlap[0]).toMatchObject({
      walletCount: 2,
      volumeUsd: null,
    });
  });
  it("expires trades at 24 hours and excludes invalid/future timestamps", () => {
    const rows = [
      signal(),
      signal({
        id: "boundary",
        timestamp: new Date(now - 86400000).toISOString(),
      }),
      signal({ id: "future", timestamp: new Date(now + 1).toISOString() }),
      signal({ id: "invalid", timestamp: "invalid" }),
    ];
    expect(recentSignals(rows, now).map((s) => s.id)).toEqual(["signal"]);
    expect(recentSignals(rows.slice(0, 1), now + 86400000)).toEqual([]);
  });
  it("filters feed and rankings together so old buys cannot reverse current net sells", () => {
    const old = signal({
      id: "old",
      tokenSymbol: "OLD",
      amountUsd: 10000,
      timestamp: new Date(now - 48 * 3600000).toISOString(),
    });
    const current = signal({ action: "sell", amountUsd: 100 });
    const html = renderToStaticMarkup(
      <SignalsFeed
        data={{
          ...emptySession(),
          signals: [old, current],
          roster: [
            {
              wallet: demoDeck()[0],
              addedAt: now,
              pnlSinceAdded: null,
              pnlUpdatedAt: null,
              winRateSinceAdded: null,
              salesSinceAdded: null,
              holdingsUpdatedAt: null,
              holdingsError: false,
            },
          ],
        }}
        loading={false}
        demo
        onRefresh={() => {}}
        onSwipe={() => {}}
        onCopy={() => {}}
      />,
    );
    expect(html).toContain("Top Net Sells");
    expect(html).not.toContain("Top Net Buys");
    expect(html).not.toContain("OLD");
    expect(html.match(/class="signal-card"/g)).toHaveLength(1);
    expect(
      buildSignalsSummary(recentSignals([old, current], now)).topNetSells[0]
        .volumeUsd,
    ).toBe(100);
  });
  it("prunes expired cached trades on restore without altering roster state", () => {
    const state = useAppStore.getState();
    const saved = {
      ...state,
      live: {
        ...emptySession(),
        signals: [
          signal(),
          signal({
            id: "old",
            timestamp: new Date(now - 172800000).toISOString(),
          }),
        ],
      },
    };
    const restored = useAppStore.persist.getOptions().merge!(saved, state);
    expect(restored.live.signals.map((s) => s.id)).toEqual(["signal"]);
    expect(restored.live.seenTxHashes).toEqual(["signal"]);
    expect(restored.onboardingComplete).toBe(state.onboardingComplete);
  });
  it("discards obsolete computed signals on upgrade and preserves user preferences", async () => {
    const saved = {
      ...useAppStore.getState(),
      onboardingComplete: true,
      theme: "dark",
      live: {
        ...emptySession(),
        signals: [signal()],
        nicknames: { "0xabc": "My match" },
      },
    };
    const migrated = (await useAppStore.persist.getOptions().migrate!(
      saved,
      4,
    )) as typeof saved;
    expect(migrated.live.signals).toEqual([]);
    expect(migrated.live.lastPolledAt).toBe(0);
    expect(migrated.live.nicknames).toEqual(saved.live.nicknames);
    expect(migrated.onboardingComplete).toBe(true);
    expect(migrated.theme).toBe("dark");
  });
});
