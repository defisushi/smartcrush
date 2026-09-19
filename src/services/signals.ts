import type { ContextBadge, Holding, RawTrade, Signal } from "../types";
import { QUOTE_SYMBOLS } from "../utils/constants";
import { cleanTokenSymbol } from "../utils/formatters";
export function buildSignals(
  trades: RawTrade[],
  holdings: Record<string, Holding[] | null>,
  allowed: string[],
): Signal[] {
  const addresses = new Set(allowed.map((a) => a.toLowerCase()));
  const result = new Map<string, Signal>();
  const balances = new Map<string, number>();
  for (const [wallet, rows] of Object.entries(holdings))
    for (const row of rows || [])
      balances.set(
        `${wallet.toLowerCase()}:${row.address.toLowerCase()}`,
        row.holdingAmount,
      );
  const unique = [
    ...new Map(
      trades.map((t) => [
        `${t.transaction_hash}:${t.trader_address}:${t.token_bought_address}:${t.token_sold_address}`,
        t,
      ]),
    ).values(),
  ];
  // Walk backwards from current balances. Transfers and indexing delays can affect this estimate.
  for (const t of unique.sort((a, b) =>
    b.block_timestamp.localeCompare(a.block_timestamp),
  )) {
    const wallet = t.trader_address.toLowerCase();
    if (
      !addresses.has(wallet) ||
      !t.transaction_hash ||
      !Number.isFinite(Date.parse(t.block_timestamp))
    )
      continue;
    for (const action of ["buy", "sell"] as const) {
      const buying = action === "buy";
      const tokenAddress = buying
        ? t.token_bought_address
        : t.token_sold_address;
      const symbol = buying ? t.token_bought_symbol : t.token_sold_symbol;
      const quantity = buying ? t.token_bought_amount : t.token_sold_amount;
      if (!tokenAddress) continue;
      const balanceKey = `${wallet}:${tokenAddress.toLowerCase()}`;
      const after = balances.get(balanceKey) ?? 0;
      let context: ContextBadge = "unknown";
      if (
        holdings[wallet] &&
        typeof quantity === "number" &&
        Number.isFinite(quantity) &&
        quantity > 0
      ) {
        const before = buying ? after - quantity : after + quantity;
        const tolerance = Math.max(1e-9, quantity * 1e-6);
        if (before >= -tolerance)
          context = buying
            ? before <= tolerance
              ? "new_position"
              : "adding"
            : after <= tolerance
              ? "full_exit"
              : "taking_profit";
        balances.set(balanceKey, before);
      }
      // Omit the cash leg, but preserve both legs of token-to-token swaps.
      if (QUOTE_SYMBOLS.has((symbol || "").toUpperCase())) continue;
      const id = `${t.transaction_hash.toLowerCase()}:${wallet}:${action}:${tokenAddress.toLowerCase()}`;
      result.set(id, {
        id,
        walletAddress: t.trader_address,
        walletLabel: t.trader_address_label || null,
        action,
        tokenAddress,
        tokenSymbol: cleanTokenSymbol(symbol || "Unknown"),
        amountUsd: t.trade_value_usd ?? 0,
        quantity:
          typeof quantity === "number" && Number.isFinite(quantity)
            ? quantity
            : null,
        timestamp: t.block_timestamp,
        txHash: t.transaction_hash,
        contextBadge: context,
      });
    }
  }
  return [...result.values()];
}
export function dexLink(
  template: string | undefined,
  token: string,
): string | null {
  if (!template?.includes("{token}")) return null;
  try {
    const url = new URL(
      template.replaceAll("{token}", encodeURIComponent(token)),
    );
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
