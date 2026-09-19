export type Tab = "scout" | "roster" | "signals";
export type Mode = "demo" | "live";
export type Theme = "light" | "dark";
export interface TopToken {
  symbol: string;
  address: string;
  realizedRoi: number | null;
  realizedPnl: number;
}
export interface Holding {
  symbol: string;
  address: string;
  holdingUsd: number;
  holdingAmount: number;
  unrealizedRoi: number | null;
}
export interface WalletProfile {
  address: string;
  label: string | null;
  winRate: number;
  realizedPnlUsd: number;
  realizedPnlPercent: number;
  tradedTokenCount: number;
  tradedTimes: number;
  topTokens: TopToken[];
  currentHoldings: Holding[];
  holdingsAvailable: boolean;
}
export interface RosterEntry {
  wallet: WalletProfile;
  addedAt: number;
  pnlSinceAdded: number | null;
  pnlUpdatedAt: number | null;
  winRateSinceAdded: number | null;
  salesSinceAdded: number | null;
  holdingsUpdatedAt: number | null;
  holdingsError: boolean;
}
export interface RosterUpdate {
  addedAt: number;
  performance?: { pnl: number; winRate: number | null; sales: number | null };
  // null means the request failed; [] means a successful check found no holdings.
  holdings?: Holding[] | null;
}
export type ContextBadge =
  "new_position" | "adding" | "taking_profit" | "full_exit" | "unknown";
export interface Signal {
  id: string;
  walletAddress: string;
  walletLabel: string | null;
  action: "buy" | "sell";
  tokenSymbol: string;
  tokenAddress: string;
  amountUsd: number;
  quantity: number | null;
  timestamp: string;
  txHash: string;
  contextBadge: ContextBadge;
}
export interface SessionData {
  nicknames: Record<string, string>;
  heldWalletAddress: string | null;
  deck: WalletProfile[];
  deckPosition: number;
  deckRefreshAt: number;
  seenWallets: Record<string, number>;
  roster: RosterEntry[];
  signals: Signal[];
  seenTxHashes: string[];
  lastPolledAt: number;
}
export interface RawTrade {
  trader_address: string;
  trader_address_label?: string;
  token_bought_symbol: string;
  token_sold_symbol: string;
  token_bought_address: string;
  token_sold_address: string;
  token_bought_amount?: number;
  token_sold_amount?: number;
  trade_value_usd: number;
  block_timestamp: string;
  transaction_hash: string;
}
export interface PnlSummary {
  win_rate: number;
  realized_pnl_usd: number;
  realized_pnl_percent: number;
  traded_token_count: number;
  traded_times: number;
  top5_tokens?: {
    token_symbol: string;
    token_address: string;
    realized_pnl: number;
    realized_roi: number;
  }[];
}
export interface PnlRow {
  token_symbol: string;
  token_address: string;
  roi_percent_realised: number;
  pnl_usd_realised: number;
  holding_usd: number;
  holding_amount: number;
  roi_percent_unrealised?: number;
}
