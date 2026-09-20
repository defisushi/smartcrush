import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const address = (n) => `0x${n.toString(16).padStart(40, "0")}`;
let requests = [],
  rateLimited = false,
  failAuth = true,
  emptyDiscovery = false,
  rosterPolling = false,
  failPortfolio = false,
  failTrades = false;
const timestamp = new Date().toISOString();
const trade = (n) => ({
  trader_address: address(n),
  trader_address_label: "Smart Trader",
  token_bought_symbol: "HOOD",
  token_bought_address: address(100),
  token_sold_symbol: "USDG",
  token_sold_address: address(101),
  token_bought_amount: 10,
  token_sold_amount: 100,
  trade_value_usd: 100,
  block_timestamp: timestamp,
  transaction_hash: `0x${n.toString(16).padStart(64, "0")}`,
});
await page.route("https://api.nansen.ai/**", async (route) => {
  const req = route.request(),
    body = req.postDataJSON(),
    endpoint = new URL(req.url()).pathname;
  requests.push({ body, endpoint });
  assert.equal(req.headers().apikey, "test-key");
  if (failAuth)
    return route.fulfill({ status: 401, json: { message: "Invalid API key" } });
  if (!rateLimited) {
    rateLimited = true;
    return route.fulfill({
      status: 429,
      headers: { "Retry-After": "0" },
      json: {},
    });
  }
  if (endpoint.endsWith("dex-trades")) {
    if (body.filters.trader_address) rosterPolling = true;
    if (body.filters.trader_address && failTrades)
      return route.fulfill({
        status: 400,
        json: { message: "Test trades unavailable" },
      });
    assert.deepEqual(body.chains, ["robinhood"]);
    if (emptyDiscovery)
      return route.fulfill({
        json: { data: [], pagination: { is_last_page: true } },
      });
    const rows = body.filters.trader_address
      ? [trade(2)]
      : [trade(1), trade(2), trade(2), trade(3)];
    return route.fulfill({
      json: { data: rows, pagination: { is_last_page: true } },
    });
  }
  assert.equal(body.chain, "robinhood");
  if (failPortfolio)
    return route.fulfill({
      status: 400,
      json: { message: "Test portfolio unavailable" },
    });
  if (endpoint.endsWith("pnl-summary")) {
    assert.ok(body.date.from && body.date.to);
    const sinceMatch = body.date.from !== "1970-01-01T00:00:00.000Z";
    return route.fulfill({
      json:
        body.address === address(1)
          ? { data: null }
          : {
              win_rate: sinceMatch ? 0.25 : 0.73,
              realized_pnl_usd: sinceMatch ? -125 : 847291,
              realized_pnl_percent: 1.4,
              traded_token_count: 142,
              traded_times: sinceMatch ? 4 : 320,
              top5_tokens: [
                {
                  token_symbol: "HOOD",
                  token_address: address(100),
                  realized_pnl: 10000,
                  realized_roi: 14100,
                },
              ],
            },
    });
  }
  assert.ok(body.date.from && body.date.to);
  return route.fulfill({
    json: {
      data: [
        {
          token_symbol: rosterPolling ? "FRESH" : "HOOD",
          token_address: address(100),
          roi_percent_realised: 141,
          pnl_usd_realised: 10000,
          holding_amount: 10,
          holding_usd: 100,
          roi_percent_unrealised: 0.2,
        },
      ],
      pagination: { is_last_page: true },
    },
  });
});
await page.goto(process.env.APP_URL || "http://127.0.0.1:5174");
await page
  .getByRole("button", { name: "Enter Smartcrush", exact: true })
  .click();
await page.getByLabel("Your Nansen API key", { exact: true }).fill("test-key");
await page.getByRole("button", { name: "Let’s find your type" }).click();
await expect(page.getByRole("alert")).toContainText("API key wasn’t accepted");
failAuth = false;
await page.getByRole("button", { name: "Try again" }).click();
await page.getByRole("button", { name: "Match with this wallet" }).waitFor();
await expect(page.locator(".deck-meta")).toContainText("1 of 2");
await expect(page.locator(".wallet-card")).toContainText("142×");
await page.getByRole("button", { name: "Match with this wallet" }).click();
await page.getByRole("button", { name: "Keep swiping", exact: true }).click();
await page.getByRole("button", { name: "Signals", exact: true }).click();
await page.locator(".signal-card").waitFor();
await expect(page.locator(".signal-card")).toContainText("New position");
assert.equal(await page.locator(".signal-card").count(), 1);
await page.getByRole("button", { name: "Roster", exact: false }).click();
await expect(page.locator(".roster-performance")).toContainText("25%");
await expect(page.locator(".roster-performance")).toContainText("−$125");
const matchedAt = await page.evaluate(
  () =>
    JSON.parse(localStorage.getItem("smart-crush-v1")).state.live.roster[0]
      .addedAt,
);
assert.ok(
  requests.some(
    (r) =>
      r.endpoint.endsWith("pnl-summary") &&
      r.body.date.from === new Date(matchedAt).toISOString(),
  ),
);
await page.locator(".roster-disclosure").click();
await expect(page.locator(".roster-details .token-chips")).toContainText(
  "FRESH",
);
await expect(page.locator(".roster-details .trophies")).toContainText("142×");
await expect(page.locator(".roster-baseline-section")).toContainText(
  "Stats At Discovery",
);
failPortfolio = true;
await page.getByRole("button", { name: "Refresh roster", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Refresh roster", exact: true }),
).toBeEnabled({ timeout: 15000 });
await expect(page.locator(".roster-performance")).toContainText("25%");
await expect(page.getByRole("alert")).toContainText(
  "Some trades, holdings or performance figures couldn’t be refreshed.",
);
await expect(page.locator(".roster-refresh-control")).toContainText(
  "Refresh failed",
);
await expect(page.locator(".roster-details .token-chips")).toContainText(
  "FRESH",
);
await page.getByRole("button", { name: "Signals", exact: true }).click();
await expect(page.locator(".roster-refresh-control")).toContainText(
  "Context incomplete",
);
failTrades = true;
await page.getByRole("button", { name: "Refresh signals" }).click();
await expect(
  page.getByRole("button", { name: "Refresh signals" }),
).toBeEnabled();
await expect(page.locator(".roster-refresh-control")).toContainText(
  "Refresh failed",
);
await expect(page.locator(".roster-refresh-control")).toContainText(
  "Last checked",
);
assert.equal(await page.locator(".signal-card").count(), 1);
const overflow = await page
  .locator(".main-content")
  .evaluate((el) => el.scrollWidth > el.clientWidth);
assert.equal(overflow, false);
await page.screenshot({ path: "artifacts/signals-failed-refresh.png" });
failPortfolio = false;
failTrades = false;
assert.equal(
  await page
    .getByRole("link", { name: "Copy this trade" })
    .getAttribute("href"),
  `https://app.uniswap.org/explore/tokens/robinhood/${address(100)}`,
);
await page.getByRole("button", { name: "Refresh signals" }).click();
await expect(
  page.getByRole("button", { name: "Refresh signals" }),
).toBeEnabled();
assert.equal(await page.locator(".signal-card").count(), 1);
await expect(page.locator(".roster-refresh-control")).toContainText("Checked");
await expect(page.locator(".roster-refresh-control")).not.toContainText(
  "failed",
);
const saved = await page.evaluate(() => localStorage.getItem("smart-crush-v1"));
assert.ok(!saved.includes("test-key"));
await page.reload();
await expect(
  page.getByLabel("Your Nansen API key", { exact: true }),
).toBeVisible();
// Empty discovery and retained saved roster on reconnect.
emptyDiscovery = true;
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("smart-crush-v1"));
  s.state.live.deckRefreshAt = 0;
  localStorage.setItem("smart-crush-v1", JSON.stringify(s));
});
await page.reload();
await page.getByLabel("Your Nansen API key", { exact: true }).fill("test-key");
await page.getByRole("button", { name: "Let’s find your type" }).click();
await expect(page.locator(".empty-state")).toContainText("A little quiet");
await page.getByRole("button", { name: "Roster", exact: false }).click();
assert.equal(await page.locator(".roster-card").count(), 1);
assert.ok(requests.some((r) => r.body.filters?.trader_address));
await browser.close();
console.log(
  "Mocked API checks passed: authentication error + retry, 429 retry, chain/date fields, duplicate discovery, missing PnL skip, smaller deck, ROI, live signals, holdings context, Uniswap link, refresh deduplication, empty pool, key not persisted, roster retained.",
);
