import { loadEnv } from "vite";
const key = loadEnv("development", "./backend", "NANSEN_").NANSEN_API_KEY;
if (!key) throw new Error("NANSEN_API_KEY missing");
const response = await fetch(
  "https://api.nansen.ai/api/v1/smart-money/dex-trades",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Origin: "http://127.0.0.1:5173",
    },
    body: JSON.stringify({
      chains: ["robinhood"],
      pagination: { page: 1, per_page: 3 },
      order_by: [{ field: "trade_value_usd", direction: "DESC" }],
    }),
    signal: AbortSignal.timeout(30000),
  },
);
const body = await response.json();
console.log(
  JSON.stringify({
    status: response.status,
    allowOrigin: response.headers.get("access-control-allow-origin"),
    rows: body.data?.length,
    error: body.message || body.error || body.detail || undefined,
  }),
);
const wallet = body.data?.[0]?.trader_address;
if (response.ok && wallet) {
  const holdings = await fetch(
    "https://api.nansen.ai/api/v1/profiler/address/pnl",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({
        address: wallet,
        chain: "robinhood",
        filters: { show_realized: false },
        date: { from: new Date(0).toISOString(), to: new Date().toISOString() },
        pagination: { page: 1, per_page: 1000 },
        order_by: [{ field: "holding_usd", direction: "DESC" }],
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  const result = await holdings.json();
  console.log(
    JSON.stringify({
      holdingsStatus: holdings.status,
      rows: result.data?.length,
      error: result.message || result.error || result.detail || undefined,
    }),
  );
}
