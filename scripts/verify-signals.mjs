import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  await page.goto(process.env.APP_URL || "http://127.0.0.1:5174");
  await page
    .getByRole("button", { name: "Enter Smartcrush", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Take a peek with demo wallets" })
    .click();
  await page.getByRole("button", { name: "Match with this wallet" }).click();
  await page.getByRole("button", { name: "Keep swiping", exact: true }).click();
  await page.getByRole("button", { name: "Signals", exact: true }).click();
  await page.locator(".signal-card").first().waitFor();
  await page.evaluate(
    ({ now }) => {
      const saved = JSON.parse(localStorage.getItem("smart-crush-v1"));
      const data = saved.state.demo;
      const base = {
        id: "unknown",
        walletAddress: data.roster[0].wallet.address,
        walletLabel: null,
        action: "sell",
        tokenSymbol: "MISSING",
        tokenAddress: "0xmissing",
        amountUsd: null,
        quantity: 10,
        timestamp: new Date(now - 1000).toISOString(),
        txHash: "0xtx",
        contextBadge: "taking_profit",
      };
      const fixture = {
        demo: {
          ...data,
          lastPolledAt: now,
          signals: [
            base,
            {
              ...base,
              id: "old",
              tokenSymbol: "EXPIRED",
              tokenAddress: "0xexpired",
              amountUsd: 10000,
              action: "buy",
              timestamp: new Date(now - 172800000).toISOString(),
            },
            {
              ...base,
              id: "aging",
              tokenSymbol: "AGING",
              tokenAddress: "0xaging",
              amountUsd: 50,
              timestamp: new Date(now - 86400000 + 5000).toISOString(),
            },
          ],
        },
      };
      saved.state.demo = fixture.demo;
      localStorage.setItem("smart-crush-v1", JSON.stringify(saved));
    },
    { now },
  );
  await page.reload();
  await page.getByRole("button", { name: "Signals", exact: true }).click();
  const missing = page.locator(".signal-card").filter({ hasText: "MISSING" });
  await expect(missing).toContainText("Unavailable");
  await expect(missing).toContainText("Reducing position");
  await expect(page.locator(".signals-list")).not.toContainText("EXPIRED");
  await expect(page.locator(".signals-summary")).not.toContainText("EXPIRED");
  await expect(
    page.locator(".signal-card").filter({ hasText: "AGING" }),
  ).toHaveCount(1);
  await page.clock.fastForward(20000);
  await expect(
    page.locator(".signal-card").filter({ hasText: "AGING" }),
  ).toHaveCount(0);
  await expect(page.locator(".signals-summary")).not.toContainText("AGING");
  assert.equal(await missing.count(), 1);
  await page.screenshot({ path: "artifacts/signals-accuracy.png" });
  console.log(
    "Signals checks passed: matching 24-hour feed/summary, automatic expiry, Unavailable values, and Reducing position copy.",
  );
} finally {
  await browser.close();
}
