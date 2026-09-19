import type { Signal } from "../types";

export type SummaryKind = "netBuy" | "netSell" | "buyOverlap" | "sellOverlap";

export interface TokenSummaryRow {
  tokenAddress: string;
  tokenSymbol: string;
  /** Net USD (buy − sell) for volume boards; buy/sell USD for overlap boards. */
  volumeUsd: number;
  /** Distinct Smartcrush wallets with that same action. */
  walletCount: number;
}

export interface SignalsSummary {
  topNetBuys: TokenSummaryRow[];
  topNetSells: TokenSummaryRow[];
  topBuyOverlap: TokenSummaryRow[];
  topSellOverlap: TokenSummaryRow[];
}

interface Acc {
  tokenAddress: string;
  tokenSymbol: string;
  buyUsd: number;
  sellUsd: number;
  buyWallets: Set<string>;
  sellWallets: Set<string>;
}

function topN<T>(rows: T[], n: number, compare: (a: T, b: T) => number): T[] {
  return [...rows].sort(compare).slice(0, n);
}

export function buildSignalsSummary(
  signals: Signal[],
  limit = 3,
): SignalsSummary {
  const byToken = new Map<string, Acc>();
  for (const s of signals) {
    if (!s.tokenAddress || !Number.isFinite(s.amountUsd)) continue;
    const key = s.tokenAddress.toLowerCase();
    const wallet = s.walletAddress.toLowerCase();
    let row = byToken.get(key);
    if (!row) {
      row = {
        tokenAddress: s.tokenAddress,
        tokenSymbol: s.tokenSymbol || "Unknown",
        buyUsd: 0,
        sellUsd: 0,
        buyWallets: new Set(),
        sellWallets: new Set(),
      };
      byToken.set(key, row);
    }
    if (s.tokenSymbol) row.tokenSymbol = s.tokenSymbol;
    if (s.action === "buy") {
      row.buyUsd += s.amountUsd;
      row.buyWallets.add(wallet);
    } else {
      row.sellUsd += s.amountUsd;
      row.sellWallets.add(wallet);
    }
  }

  const tokens = [...byToken.values()];

  const topNetBuys = topN(
    tokens
      .map((t) => ({
        tokenAddress: t.tokenAddress,
        tokenSymbol: t.tokenSymbol,
        volumeUsd: t.buyUsd - t.sellUsd,
        walletCount: t.buyWallets.size,
      }))
      .filter((t) => t.volumeUsd > 0),
    limit,
    (a, b) => b.volumeUsd - a.volumeUsd || b.walletCount - a.walletCount,
  );

  const topNetSells = topN(
    tokens
      .map((t) => ({
        tokenAddress: t.tokenAddress,
        tokenSymbol: t.tokenSymbol,
        volumeUsd: t.sellUsd - t.buyUsd,
        walletCount: t.sellWallets.size,
      }))
      .filter((t) => t.volumeUsd > 0),
    limit,
    (a, b) => b.volumeUsd - a.volumeUsd || b.walletCount - a.walletCount,
  );

  const topBuyOverlap = topN(
    tokens
      .map((t) => ({
        tokenAddress: t.tokenAddress,
        tokenSymbol: t.tokenSymbol,
        volumeUsd: t.buyUsd,
        walletCount: t.buyWallets.size,
      }))
      .filter((t) => t.walletCount >= 2),
    limit,
    (a, b) => b.walletCount - a.walletCount || b.volumeUsd - a.volumeUsd,
  );

  const topSellOverlap = topN(
    tokens
      .map((t) => ({
        tokenAddress: t.tokenAddress,
        tokenSymbol: t.tokenSymbol,
        volumeUsd: t.sellUsd,
        walletCount: t.sellWallets.size,
      }))
      .filter((t) => t.walletCount >= 2),
    limit,
    (a, b) => b.walletCount - a.walletCount || b.volumeUsd - a.volumeUsd,
  );

  return { topNetBuys, topNetSells, topBuyOverlap, topSellOverlap };
}

export function summaryHasRows(summary: SignalsSummary) {
  return (
    summary.topNetBuys.length > 0 ||
    summary.topNetSells.length > 0 ||
    summary.topBuyOverlap.length > 0 ||
    summary.topSellOverlap.length > 0
  );
}
