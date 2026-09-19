import type {
  Holding,
  PnlRow,
  PnlSummary,
  RawTrade,
  WalletProfile,
} from "../types";
import { CHAIN, DAY_MS, DECK_SIZE } from "../utils/constants";
import { cleanTokenSymbol } from "../utils/formatters";
// API key is NEVER baked into the frontend bundle. The proxy injects it.
export const configuredApiKey = "";
export const projectConnectionAvailable: boolean =
  import.meta.env.VITE_NANSEN_PROXY === true;
let apiKey = "";
let usingProjectKey = projectConnectionAvailable;
let controller = new AbortController();
let queue: Promise<unknown> = Promise.resolve();
let nextRequestAt = 0;
export const hasApiKey = () => Boolean(apiKey || usingProjectKey);
export function setApiKey(key: string) {
  controller.abort();
  controller = new AbortController();
  apiKey = key.trim();
  usingProjectKey = false;
}
export function useProjectKey() {
  setApiKey("");
  usingProjectKey = projectConnectionAvailable;
}
export class NansenError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
export function retryDelay(
  header: string | null,
  attempt: number,
  now = Date.now(),
) {
  if (header !== null) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - now);
  }
  return 1000 * 2 ** attempt;
}
export async function nansenPost<T>(
  endpoint: string,
  body: object,
): Promise<T> {
  const key = apiKey,
    signal = controller.signal,
    projectKey = usingProjectKey;
  if (!key && !projectKey)
    throw new NansenError("Add your Nansen API key to meet live wallets.", 401);
  const run = async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      await pause(Math.max(0, nextRequestAt - Date.now()), signal);
      nextRequestAt = Date.now() + 260; // Below both free-plan request limits.
      let response: Response;
      try {
        response = await fetch(
          `${projectConnectionAvailable ? "/api/nansen" : "https://api.nansen.ai"}${endpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(key ? { apikey: key } : {}),
            },
            body: JSON.stringify(body),
            signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
          },
        );
      } catch (error) {
        if (signal.aborted) throw error;
        throw new NansenError(
          "Couldn’t reach Nansen. Check your connection; browser access may also be blocked by CORS. Your roster is saved.",
        );
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const wait = retryDelay(response.headers.get("Retry-After"), attempt);
        if (wait > 60000)
          throw new NansenError(
            `Nansen needs a breather. Try again in ${Math.ceil(wait / 60000)} minutes.`,
            429,
          );
        await pause(wait, signal);
        continue;
      }
      if (!response.ok) {
        const messages: Record<number, string> = {
          401: "This API key wasn’t accepted. Check your key in Connection settings.",
          402: "Nansen credits are needed to fetch live data. Check your Nansen account.",
          403: "Your Nansen plan doesn’t allow this request. Check your access and credits.",
          422: "Nansen couldn’t process this Robinhood request. The endpoint may not yet have data for this chain or date range.",
          429: "Nansen is rate limiting requests. Give it a moment, then try again.",
        };
        throw new NansenError(
          messages[response.status] ||
            `Nansen is unavailable (${response.status}). Please try again.`,
          response.status,
        );
      }
      return response.json() as Promise<T>;
    }
    throw new NansenError(
      "Nansen couldn’t complete this request. Please try again.",
    );
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}
interface Page<T> {
  data: T[];
  pagination?: { is_last_page: boolean };
}
async function pages<T>(
  endpoint: string,
  body: object,
  maxPages = 20,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const result = await nansenPost<Page<T>>(endpoint, {
      ...body,
      pagination: { page, per_page: 1000 },
    });
    if (!Array.isArray(result.data))
      throw new NansenError(
        "Nansen returned an unexpected response. Please try again.",
      );
    all.push(...result.data);
    if (
      result.pagination?.is_last_page === true ||
      (!result.pagination && result.data.length < 1000) ||
      result.data.length === 0
    )
      return all;
  }
  throw new NansenError(
    "Too much activity to load completely. Please retry later; your last complete feed is preserved.",
  );
}
export async function discoverSmartWallets() {
  const rows = await pages<RawTrade>("/api/v1/smart-money/dex-trades", {
    chains: [CHAIN],
    filters: {
      include_smart_money_labels: [
        "Smart Trader",
        "30D Smart Trader",
        "90D Smart Trader",
        "180D Smart Trader",
      ],
    },
    order_by: [{ field: "trade_value_usd", direction: "DESC" }],
  });
  return [
    ...new Map(
      rows
        .filter((t) => /^0x[0-9a-f]{40}$/i.test(t.trader_address))
        .map((t) => [
          t.trader_address.toLowerCase(),
          { address: t.trader_address, label: t.trader_address_label || null },
        ]),
    ).values(),
  ];
}
// Explicit dates satisfy the current summary schema. A fixed origin includes all Robinhood history.
export const pnlRange = (from = 0) => ({
  from: new Date(from).toISOString(),
  to: new Date().toISOString(),
});
export async function getWalletPnlSummary(
  address: string,
  since = 0,
): Promise<PnlSummary | null> {
  const raw = await nansenPost<PnlSummary | { data: PnlSummary | null } | null>(
    "/api/v1/profiler/address/pnl-summary",
    { address, chain: CHAIN, date: pnlRange(since) },
  );
  const summary = raw && "data" in raw ? raw.data : raw;
  if (
    !summary ||
    !Number.isFinite(summary.win_rate) ||
    !Number.isFinite(summary.realized_pnl_usd)
  )
    return null;
  return summary;
}
export async function getWalletPnlDetail(address: string): Promise<PnlRow[]> {
  const result = await nansenPost<Page<PnlRow>>(
    "/api/v1/profiler/address/pnl",
    {
      address,
      chain: CHAIN,
      filters: { show_realized: true },
      date: pnlRange(),
      pagination: { page: 1, per_page: 10 },
      order_by: [{ field: "roi_percent_realised", direction: "DESC" }],
    },
  );
  return result.data || [];
}
export async function getWalletHoldings(address: string): Promise<Holding[]> {
  const rows = await pages<PnlRow>("/api/v1/profiler/address/pnl", {
    address,
    chain: CHAIN,
    filters: { show_realized: false },
    date: pnlRange(),
    order_by: [{ field: "holding_usd", direction: "DESC" }],
  });
  return rows
    .filter((r) => r.holding_amount > 0)
    .map((r) => ({
      symbol: cleanTokenSymbol(r.token_symbol || "Unknown"),
      address: r.token_address,
      holdingUsd: r.holding_usd ?? 0,
      holdingAmount: r.holding_amount,
      unrealizedRoi: r.roi_percent_unrealised ?? null,
    }));
}
export const getWalletRecentTrades = (addresses: string[]) =>
  addresses.length === 0
    ? Promise.resolve([])
    : pages<RawTrade>("/api/v1/smart-money/dex-trades", {
        chains: [CHAIN],
        filters: { trader_address: addresses },
        order_by: [{ field: "block_timestamp", direction: "DESC" }],
      });
export function normalizeProfile(
  address: string,
  label: string | null,
  s: PnlSummary,
  rows: PnlRow[],
  holdings: Holding[] | null,
): WalletProfile {
  const winners = new Map<string, WalletProfile["topTokens"][number]>();
  for (const t of s.top5_tokens || []) {
    if (t.realized_pnl > 0)
      winners.set(t.token_address.toLowerCase(), {
        symbol: cleanTokenSymbol(t.token_symbol || "Unknown"),
        address: t.token_address,
        realizedPnl: t.realized_pnl,
        realizedRoi: null,
      });
  }
  // Current Nansen schema: detail ROI is a ratio, NOT multiplied by 100. 1.42 ROI = 2.42×.
  for (const t of rows)
    if (t.pnl_usd_realised > 0)
      winners.set(t.token_address.toLowerCase(), {
        symbol: cleanTokenSymbol(t.token_symbol || "Unknown"),
        address: t.token_address,
        realizedPnl: t.pnl_usd_realised,
        realizedRoi: Number.isFinite(t.roi_percent_realised)
          ? 1 + t.roi_percent_realised
          : null,
      });
  return {
    address,
    label,
    winRate: Math.max(0, Math.min(1, s.win_rate)),
    realizedPnlUsd: s.realized_pnl_usd,
    realizedPnlPercent: s.realized_pnl_percent,
    tradedTokenCount: s.traded_token_count,
    tradedTimes: s.traded_times,
    topTokens: [...winners.values()]
      .sort((a, b) => (b.realizedRoi ?? -1) - (a.realizedRoi ?? -1))
      .slice(0, 5),
    currentHoldings: (holdings || []).slice(0, 5),
    holdingsAvailable: holdings !== null,
  };
}
export async function buildDeck(
  seen: Record<string, number>,
  rosterAddresses: string[],
  onProgress: (n: number) => void,
) {
  const signal = controller.signal;
  const candidates = await discoverSmartWallets();
  signal.throwIfAborted();
  const roster = new Set(rosterAddresses.map((a) => a.toLowerCase()));
  const eligible = candidates.filter(
    (w) =>
      !roster.has(w.address.toLowerCase()) &&
      (!seen[w.address.toLowerCase()] ||
        seen[w.address.toLowerCase()] < Date.now() - DAY_MS),
  );
  const deck: WalletProfile[] = [];
  for (const w of eligible) {
    signal.throwIfAborted();
    const summary = await getWalletPnlSummary(w.address);
    if (!summary || !summary.traded_token_count) continue;
    const results = await Promise.allSettled([
      getWalletPnlDetail(w.address),
      getWalletHoldings(w.address),
    ]);
    signal.throwIfAborted();
    const detail = results[0].status === "fulfilled" ? results[0].value : [];
    const holdings =
      results[1].status === "fulfilled" ? results[1].value : null;
    deck.push(normalizeProfile(w.address, w.label, summary, detail, holdings));
    onProgress(deck.length);
    if (deck.length >= DECK_SIZE) break;
  }
  return deck;
}
