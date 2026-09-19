import { describe, expect, it } from "vitest";
import type { Signal } from "../src/types";
import { buildSignalsSummary } from "../src/utils/signalSummary";

const base = (
  partial: Partial<Signal> &
    Pick<
      Signal,
      "id" | "action" | "tokenAddress" | "walletAddress" | "amountUsd"
    >,
): Signal => ({
  walletLabel: null,
  tokenSymbol: partial.tokenSymbol || "TOK",
  quantity: 1,
  timestamp: "2026-09-19T12:00:00Z",
  txHash: partial.id,
  contextBadge: "unknown",
  ...partial,
});

describe("buildSignalsSummary", () => {
  it("ranks net buys and sells", () => {
    const summary = buildSignalsSummary([
      base({
        id: "1",
        action: "buy",
        tokenAddress: "0xaaa",
        tokenSymbol: "AAA",
        walletAddress: "0xw1",
        amountUsd: 1000,
      }),
      base({
        id: "2",
        action: "sell",
        tokenAddress: "0xaaa",
        tokenSymbol: "AAA",
        walletAddress: "0xw1",
        amountUsd: 200,
      }),
      base({
        id: "3",
        action: "sell",
        tokenAddress: "0xbbb",
        tokenSymbol: "BBB",
        walletAddress: "0xw2",
        amountUsd: 800,
      }),
      base({
        id: "4",
        action: "buy",
        tokenAddress: "0xbbb",
        tokenSymbol: "BBB",
        walletAddress: "0xw2",
        amountUsd: 100,
      }),
    ]);
    expect(summary.topNetBuys[0]?.tokenSymbol).toBe("AAA");
    expect(summary.topNetBuys[0]?.volumeUsd).toBe(800);
    expect(summary.topNetSells[0]?.tokenSymbol).toBe("BBB");
    expect(summary.topNetSells[0]?.volumeUsd).toBe(700);
  });

  it("ranks shared action overlap by distinct wallets", () => {
    const summary = buildSignalsSummary([
      base({
        id: "1",
        action: "buy",
        tokenAddress: "0xccc",
        tokenSymbol: "CCC",
        walletAddress: "0xw1",
        amountUsd: 50,
      }),
      base({
        id: "2",
        action: "buy",
        tokenAddress: "0xccc",
        tokenSymbol: "CCC",
        walletAddress: "0xw2",
        amountUsd: 50,
      }),
      base({
        id: "3",
        action: "buy",
        tokenAddress: "0xccc",
        tokenSymbol: "CCC",
        walletAddress: "0xw3",
        amountUsd: 50,
      }),
      base({
        id: "4",
        action: "buy",
        tokenAddress: "0xddd",
        tokenSymbol: "DDD",
        walletAddress: "0xw1",
        amountUsd: 500,
      }),
      base({
        id: "5",
        action: "buy",
        tokenAddress: "0xddd",
        tokenSymbol: "DDD",
        walletAddress: "0xw1",
        amountUsd: 500,
      }),
    ]);
    expect(summary.topBuyOverlap[0]?.tokenSymbol).toBe("CCC");
    expect(summary.topBuyOverlap[0]?.walletCount).toBe(3);
    expect(summary.topBuyOverlap.some((r) => r.tokenSymbol === "DDD")).toBe(
      false,
    );
  });
});
