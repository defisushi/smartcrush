import type { ContextBadge, Holding, RawTrade, Signal } from "../types";
import { QUOTE_SYMBOLS } from "../utils/constants";
import { cleanTokenSymbol } from "../utils/formatters";

const knownAmount = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
const addAmounts = (a: number | null, b: number | null) =>
  a === null || b === null ? null : knownAmount(a + b);

export function buildSignals(
  trades: RawTrade[],
  holdings: Record<string, Holding[] | null>,
  allowed: string[],
): Signal[] {
  const addresses = new Set(allowed.map((a) => a.toLowerCase()));
  const balances = new Map<string, number | null>();
  const knownWallets = new Set<string>();
  for (const [wallet, rows] of Object.entries(holdings)) {
    if (rows === null) continue;
    knownWallets.add(wallet.toLowerCase());
    for (const row of rows)
      balances.set(
        `${wallet.toLowerCase()}:${row.address.toLowerCase()}`,
        knownAmount(row.holdingAmount),
      );
  }

  const transactions = new Map<
    string,
    { at: number; legs: Map<string, Signal> }
  >();
  const seen = new Set<string>();
  for (const t of trades) {
    const wallet = t.trader_address.toLowerCase();
    const at = Date.parse(t.block_timestamp);
    if (!addresses.has(wallet) || !t.transaction_hash || !Number.isFinite(at))
      continue;
    const tx = t.transaction_hash.toLowerCase();
    const bought = (t.token_bought_address || "").toLowerCase();
    const sold = (t.token_sold_address || "").toLowerCase();
    const buyAmount = knownAmount(t.token_bought_amount);
    const sellAmount = knownAmount(t.token_sold_amount);
    // The endpoint has no execution/log index. Deduplicate repeated execution
    // observations, but preserve differing token pairs or quantities in one tx.
    // Identical executions with identical amounts cannot be distinguished here.
    const fingerprint = JSON.stringify([
      tx,
      wallet,
      bought,
      sold,
      buyAmount,
      sellAmount,
      at,
    ]);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    const transactionKey = `${tx}:${wallet}`;
    let transaction = transactions.get(transactionKey);
    if (!transaction) {
      transaction = { at, legs: new Map() };
      transactions.set(transactionKey, transaction);
    }
    for (const action of ["buy", "sell"] as const) {
      const buying = action === "buy";
      const token = buying ? bought : sold;
      if (!token) continue;
      const symbol = buying ? t.token_bought_symbol : t.token_sold_symbol;
      const quantity = buying ? buyAmount : sellAmount;
      const amountUsd = knownAmount(t.trade_value_usd);
      const id = `${transactionKey}:${action}:${token}`;
      const existing = transaction.legs.get(id);
      if (existing) {
        existing.quantity = addAmounts(existing.quantity, quantity);
        existing.amountUsd = addAmounts(existing.amountUsd, amountUsd);
      } else {
        transaction.legs.set(id, {
          id,
          walletAddress: t.trader_address,
          walletLabel: t.trader_address_label || null,
          action,
          tokenAddress: token,
          tokenSymbol: symbol || "Unknown",
          amountUsd,
          quantity,
          timestamp: new Date(at).toISOString(),
          txHash: t.transaction_hash,
          contextBadge: "unknown",
        });
      }
    }
  }

  const result: Signal[] = [];
  // Aggregate the whole transaction before reversing balances, so a routed buy
  // gets one context and neither its quantity nor its value is overwritten.
  for (const transaction of [...transactions.values()].sort(
    (a, b) => b.at - a.at,
  )) {
    const byToken = new Map<string, Signal[]>();
    for (const leg of transaction.legs.values()) {
      const key = `${leg.walletAddress.toLowerCase()}:${leg.tokenAddress}`;
      byToken.set(key, [...(byToken.get(key) || []), leg]);
    }
    for (const [key, legs] of byToken) {
      const wallet = legs[0].walletAddress.toLowerCase();
      const after = balances.has(key) ? balances.get(key)! : 0;
      const quantitiesKnown = legs.every(
        (leg) => leg.quantity !== null && leg.quantity > 0,
      );
      let before: number | null = null;
      if (knownWallets.has(wallet) && after !== null && quantitiesKnown) {
        before = legs.reduce(
          (balance, leg) =>
            balance + (leg.action === "buy" ? -leg.quantity! : leg.quantity!),
          after,
        );
        const tolerance = Math.max(
          1e-9,
          ...legs.map((leg) => leg.quantity! * 1e-6),
        );
        if (!Number.isFinite(before) || before < -tolerance) before = null;
        else {
          before = Math.max(0, before);
          // A token bought and sold within one tx has ambiguous position intent.
          if (legs.length === 1) {
            const leg = legs[0];
            const context: ContextBadge =
              leg.action === "buy"
                ? before <= tolerance
                  ? "new_position"
                  : "adding"
                : after <= tolerance
                  ? "full_exit"
                  : "taking_profit";
            leg.contextBadge = context;
          }
        }
      }
      // An unknown/inconsistent quantity invalidates older balance estimates.
      balances.set(key, before);
      for (const leg of legs) {
        if (QUOTE_SYMBOLS.has(leg.tokenSymbol.toUpperCase())) continue;
        result.push({ ...leg, tokenSymbol: cleanTokenSymbol(leg.tokenSymbol) });
      }
    }
  }
  return result;
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
