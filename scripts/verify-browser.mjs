import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 980 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.APP_URL || "http://127.0.0.1:5174");
await page
  .getByRole("button", { name: "Take a peek with demo wallets" })
  .click();
await page.getByRole("button", { name: "Match with this wallet" }).waitFor();
assert.equal(
  await page
    .locator(".app-frame")
    .evaluate((el) => el.getBoundingClientRect().width),
  390,
);
await page.screenshot({ path: "artifacts/scout-desktop.png" });
await page.getByRole("button", { name: "Match with this wallet" }).click();
await page.getByRole("button", { name: "Keep swiping", exact: true }).click();
await page.getByRole("button", { name: "Roster", exact: false }).click();
await page.locator(".roster-card").waitFor();
assert.equal(await page.locator(".roster-card").count(), 1);
await page.getByRole("button", { name: "Add nickname", exact: true }).click();
await page.getByLabel("Nickname", { exact: true }).fill("  Pepe Whale  ");
await page.getByRole("button", { name: "Save", exact: true }).click();
await expect(
  page.getByRole("heading", { name: "Pepe Whale", exact: true }),
).toBeVisible();
await expect(
  page.getByRole("button", { name: "Show details for Pepe Whale" }),
).toHaveAttribute("aria-expanded", "false");
await page
  .getByRole("button", { name: "Show details for Pepe Whale" })
  .press("Enter");
await expect(
  page.getByRole("heading", { name: "Greatest Hits", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Edit nickname", exact: true }).click();
await page.keyboard.press("Escape");
await expect(
  page.getByRole("button", { name: "Edit nickname", exact: true }),
).toBeFocused();
await expect(
  page.getByRole("button", { name: "Hide details for Pepe Whale" }),
).toHaveAttribute("aria-expanded", "true");
await page.getByRole("button", { name: "Signals", exact: true }).click();
await page.locator(".signal-card").first().waitFor();
assert.equal(await page.locator(".signal-card").count(), 2);
await page.screenshot({ path: "artifacts/signals-desktop.png" });
await page.reload();
await page.getByRole("button", { name: "Roster", exact: false }).click();
assert.equal(await page.locator(".roster-card").count(), 1);
await expect(
  page.getByRole("heading", { name: "Pepe Whale", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Swipe", exact: true }).click();
for (let i = 0; i < 9; i++) {
  await page.getByRole("button", { name: "Match with this wallet" }).click();
  await page.getByRole("button", { name: "Keep swiping", exact: true }).click();
}
await page.getByRole("button", { name: "Match with this wallet" }).click();
await page.getByRole("dialog").waitFor();
assert.ok(
  (await page.getByRole("dialog").innerText()).includes("Your roster is full"),
);
await page.getByRole("button", { name: "Make room in my roster" }).click();
await expect(page.locator(".roster-refresh-control")).toContainText("Updated");
// Compare rendered order to stored exact values for both metrics and directions.
for (const metric of ["pnl", "winRate"]) {
  await page
    .getByRole("button", { name: "Sort roster by", exact: true })
    .click();
  await page
    .getByRole("option", {
      name:
        metric === "pnl"
          ? "REALIZED P&L since matching"
          : "WIN RATE since matching",
      exact: true,
    })
    .click();
  for (const direction of ["worst", "best"]) {
    await page
      .getByRole("button", { name: "Roster sort order", exact: true })
      .click();
    await page
      .getByRole("option", {
        name: direction === "worst" ? "Worst first" : "Best first",
        exact: true,
      })
      .click();
    const sorted = await page.evaluate(
      ({ metric, direction }) => {
        const roster = JSON.parse(localStorage.getItem("smart-crush-v1")).state
          .demo.roster;
        const order = [
          ...document.querySelectorAll(
            ".roster-card [aria-label^='Copy wallet address']",
          ),
        ].map((el) =>
          el.getAttribute("aria-label").replace("Copy wallet address ", ""),
        );
        const values = order.map(
          (address) =>
            roster.find((r) => r.wallet.address === address)[
              metric === "pnl" ? "pnlSinceAdded" : "winRateSinceAdded"
            ],
        );
        const known = values.filter((v) => v !== null);
        return (
          values.slice(0, known.length).every((v) => v !== null) &&
          known.every(
            (v, i) =>
              !i ||
              (direction === "worst" ? v >= known[i - 1] : v <= known[i - 1]),
          )
        );
      },
      { metric, direction },
    );
    assert.ok(sorted);
  }
}
await page.getByRole("button", { name: "Sort roster by", exact: true }).click();
await page
  .getByRole("option", { name: "REALIZED P&L since matching", exact: true })
  .click();
await page
  .getByRole("button", { name: "Roster sort order", exact: true })
  .click();
await page.getByRole("option", { name: "Worst first", exact: true }).click();
await page.locator(".roster-disclosure").nth(0).click();
await page.locator(".roster-disclosure").nth(1).click();
assert.equal(
  await page.locator('.roster-disclosure[aria-expanded="true"]').count(),
  1,
);
await page.locator(".roster-disclosure").nth(1).click();
await page.screenshot({ path: "artifacts/roster-desktop.png" });
await page
  .getByRole("button", { name: "Break up", exact: true })
  .first()
  .click();
await page
  .getByRole("button", { name: "Let’s give it another chance" })
  .click();
assert.equal(await page.locator(".roster-card").count(), 10);
await page
  .getByRole("button", { name: "Break up", exact: true })
  .first()
  .click();
await page.getByRole("button", { name: "Yes, break up", exact: true }).click();
assert.equal(await page.locator(".roster-card").count(), 9);
await page.getByRole("button", { name: "Swipe", exact: true }).click();
assert.ok((await page.locator(".deck-meta").innerText()).includes("11"));
await page.getByRole("button", { name: "Match with this wallet" }).click();
await page.getByRole("button", { name: "Keep swiping", exact: true }).click();
assert.ok((await page.locator(".deck-meta").innerText()).includes("12"));
for (let i = 0; i < 9; i++) {
  await page.getByRole("button", { name: "Pass on this wallet" }).click();
  await page.waitForTimeout(60);
}
assert.ok(
  (await page.locator(".empty-state").innerText()).includes(
    "You’ve met everyone",
  ),
);
await page.clock.install();
await page.clock.fastForward(4 * 60 * 60 * 1000 + 15000);
await page.getByRole("button", { name: "Match with this wallet" }).waitFor();
assert.ok((await page.locator(".deck-meta").innerText()).includes("1 of 20"));
const refreshed = await page.evaluate(
  () => JSON.parse(localStorage.getItem("smart-crush-v1")).state.demo,
);
assert.equal(refreshed.deckPosition, 0);
assert.ok(
  refreshed.deck.every(
    (w) => !refreshed.roster.some((r) => r.wallet.address === w.address),
  ),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Roster", exact: false }).click();
await page.screenshot({ path: "artifacts/roster-mobile.png" });
assert.equal(
  await page
    .locator(".app-frame")
    .evaluate((el) => el.getBoundingClientRect().width),
  390,
);
await context.close();
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
  isMobile: true,
  hasTouch: true,
});
const mp = await mobile.newPage();
await mp.goto(process.env.APP_URL || "http://127.0.0.1:5174");
await mp.screenshot({ path: "artifacts/setup-mobile.png" });
await mp.getByRole("button", { name: "Take a peek with demo wallets" }).click();
await mp.getByRole("button", { name: "Match with this wallet" }).waitFor();
await mp.screenshot({ path: "artifacts/scout-mobile.png" });
// Pointer drag follows the same gesture path as a touch swipe.
const box = await mp.locator(".draggable-card").boundingBox();
await mp.mouse.move(box.x + box.width / 2, box.y + 100);
await mp.mouse.down();
await mp.mouse.move(box.x + box.width / 2 - 140, box.y + 100, { steps: 15 });
await mp.mouse.up();
await mp.waitForTimeout(150);
assert.ok((await mp.locator(".deck-meta").innerText()).includes("2"));
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "Browser checks passed: 390px frame, match/pass, signals, persistence, full roster, cancel/confirm breakup, held card, deck exhaustion, four-hour refresh, mobile drag; no page errors.",
);
