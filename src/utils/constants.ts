export const CHAIN = "robinhood";
export const DECK_SIZE = 20;
export const ROSTER_LIMIT = 10;
export const SESSION_MS = 4 * 60 * 60 * 1000;
export const POLL_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const STORAGE_KEY = "smart-crush-v1";
export const QUOTE_SYMBOLS = new Set([
  "USDG",
  "USDC",
  "USDT",
  "DAI",
  "USD",
  "USDC.E",
  "WETH",
  "ETH",
  "WBTC",
  "BTC",
]);

export const DEFAULT_DEX_URL =
  "https://fomo.family/tokens/robinhood/{token}";
