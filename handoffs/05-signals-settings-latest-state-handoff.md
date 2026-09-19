# Smartcrush — Signals, Settings, and Latest Product State Handoff

**Written:** 20 Sep 2026 (Asia/Singapore)  
**Project root:** `/Users/lfgcap/Desktop/Nansen Smart Money`  
**Supersedes for current state:** `handoffs/04-roster-page-polish-handoff.md`

## Start here

This document reconciles the repository and running app **after another AI made additional polish changes**. Treat the current files as the source of truth. Earlier handoffs remain useful history, especially:

- `handoffs/02-swipe-page-polish-handoff.md` for the accepted Swipe-page direction;
- `handoffs/04-roster-page-polish-handoff.md` for the detailed Roster decisions.

Where those documents conflict with this one or with the current code, follow the current code and this handoff.

The project root is **not a Git repository**, so there is no reliable diff or commit history to reconstruct the other AI's changes. Do not assume a clean working tree or attempt Git-based rollback.

## Resume commands

```sh
cd "/Users/lfgcap/Desktop/Nansen Smart Money"
npm run dev
```

Open `http://127.0.0.1:5173/`.

Useful verification commands:

```sh
npm test
npm run build
```

For the isolated browser suite:

```sh
npm run dev:test
# In another terminal:
npm run test:browser
```

The app was already running at `http://127.0.0.1:5173/` when this handoff was written.

## Current verification status

- `npm test`: **passes — 21 tests across 4 files**.
- `npm run build`: **passes**.
- Running demo visually inspected in the in-app browser at the fixed 390px phone width.
- Roster, Signals, and the Settings modal were confirmed to render the latest changes.
- The browser regression scripts currently fail on **stale expectations**, not on a compile or unit-test failure:
  - `scripts/verify-browser.mjs` still searches for a button named `Save nickname`; the intentional current label is `Save`.
  - `scripts/verify-api.mjs` still searches for `.holdings-freshness` / `Refresh unavailable`; per-card freshness copy was intentionally removed when freshness became roster-wide.

Update those test selectors/assertions before treating the browser suite as a product regression. After updating them, rerun the entire suite because execution currently stops at the first stale assertion.

## Current browser/demo state

At handoff time:

- mode: **Demo**;
- theme: **Light**;
- current page: **Signals**;
- Settings modal: closed;
- roster: **6/10**;
- the demo roster includes user nicknames such as `cashcat guy` and `pons weirdo`;
- the Signals feed and summary are populated with fictional activity.

This state lives in browser storage and can change. Do not reset it unless the user asks. **Reset demo** loads a fresh fictional Swipe deck but preserves the roster.

## Product in one paragraph

Smartcrush is a mobile-first, dating-app-themed interface for discovering Nansen Smart Money wallets on Robinhood Chain. Users swipe through eligible wallets, match with up to ten Smartcrushes, monitor realized performance after matching, compare current performance with the snapshot taken at match time, inspect holdings and historical wins, assign nicknames, remove weak performers, and follow recent roster-wallet buys and sells through Signals.

## Current product vocabulary

Keep these forms consistent:

- product: **Smartcrush**;
- plural: **Smartcrushes**;
- profit/loss: **P&L**, never `PNL` or `PnL`;
- performance label: **REALIZED P&L**;
- navigation: **Swipe**, **Roster**, **Signals**;
- removal action: **Break up**;
- expansion: **View Details** / **Hide Details**.

## Global shell and header

The UI is a fixed-width mobile application centered against a dark desktop surround. Navigation remains fixed at the bottom of the phone frame.

Current header structure:

- coral heart mark + Smartcrush wordmark and trademark;
- Robinhood chain pill;
- icon-only Settings control.

Important delta from handoff 04: the tiny `POWERED BY NANSEN` subtitle is **no longer under the Smartcrush wordmark**. In the current code, that wording appears in the **live-mode banner**:

> ROBINHOOD CHAIN SMART MONEY · POWERED BY NANSEN

Demo mode instead shows:

> DEMO MODE · FICTIONAL WALLETS

Do not restore the old wordmark subtitle unless the user requests it.

## Settings and theme system

The top-right sliders icon opens a modal titled **Settings**. It contains two segmented controls.

### Data

Helper text:

> Live Nansen feeds or sample wallets.

Options:

- `LIVE DATA`
- `DEMO MODE`

Changing modes closes Settings, returns to Swipe, clears transient loading/errors, and keeps demo/live persisted state isolated.

### Interface

Helper text:

> Light paper or dark night mode.

Options:

- `Light`
- `Dark`

Theme is stored in Zustand and persisted. `AppFrame` applies `data-theme="light"` or `data-theme="dark"`; the dark palette overrides are grouped near the bottom of `src/index.css`.

Relevant files:

- `src/components/SettingsMenu.tsx`
- `src/components/AppFrame.tsx`
- `src/store/useAppStore.ts`
- `src/types/index.ts`
- the `Settings menu + dark theme` section in `src/index.css`

## Swipe page: preserve the accepted direction

Current title and subtitle:

> Find My Smartcrush

> Swipe on 20 eligible smart wallets, and curate your own ultimate Smartcrush roster. Swipe again every 4 hours!

Preserve these later refinements:

- copy-address is icon-only with no icon box;
- Greatest Hits content is centered inside each tile;
- the roster count/capacity indicator sits at the bottom;
- P&L naming uses `P&L` consistently;
- profile images are not used.

The detailed accepted Swipe state is in `handoffs/02-swipe-page-polish-handoff.md`.

## Roster page: current accepted state

Current title and subtitle:

> My Roster

> Up to 10 Smartcrushes you're giving your attention to.

The capacity indicator matches Swipe and shows `Roster: N/10` with ten person icons.

### Sorting and freshness

Sort choices:

- `REALIZED P&L since matching`
- `WIN RATE since matching`

Order choices:

- `Worst first`
- `Best first`

The custom dropdowns intentionally avoid the inconsistent native select-menu border. Unknown metrics sort last.

Freshness is roster-wide and sits next to Refresh:

> Updated just now

Do not reintroduce repeated `Checked...` or `Updated...` copy on individual cards or expanded details.

### Wallet identity

Cards have no profile image.

With a nickname:

1. nickname + compact `Edit Nickname` pill;
2. address + icon-only copy control;
3. Nansen wallet label;
4. match/activity sentence.

Without a nickname:

1. address + icon-only copy control + compact `Add Nickname` pill;
2. Nansen wallet label;
3. match/activity sentence.

The copy icon deliberately uses its earlier compact treatment rather than being visually forced to match the pencil icon.

Nickname modal details:

- new: `Name your Smartcrush`;
- existing: `Edit nickname`;
- primary action: `Save`;
- helper: `Saved on this device. Delete nickname to use the original wallet address again.`;
- 24-character limit exists in code but is not advertised in visible copy;
- saving an empty value deletes the nickname.

### Match activity and collapsed metrics

Example line:

> Matched 47m ago, sold 15 times since matching.

Matches from today use relative time. Older matches use an absolute date such as `19 Sep 26`.

Collapsed cards prioritize:

- **WIN RATE** / `since matching`;
- **REALIZED P&L** / `since matching`.

`traded_times` is rendered to users as times sold. It can include partial sells and is activity context, not a profitability metric.

A high win rate and negative realized P&L is valid when one large loss exceeds several smaller wins.

### Expanded details order

Expanded content follows current → baseline → historical:

1. **Currently Into** — refreshed current holdings;
2. **Stats At Match** — win rate and realized P&L snapshot from first match;
3. **Greatest Hits** — historical winning tokens captured when first swiped.

Subcopy:

> This Smartcrush's stats when you first swiped on em.

> This Smartcrush's historical wins when you first swiped on em.

Greatest Hits names and multiples are centered. The footer warning is only:

> Nansen figures can lag by up to an hour.

For the remaining Roster implementation details, see `handoffs/04-roster-page-polish-handoff.md`.

## Signals page: newly polished state

Current title and subtitle:

> Smartcrush Signals

> Hopefully not mixed. Keep up with the ones you fell for.

The page starts with a single page-wide freshness label and Refresh action. It then renders the new summary, followed by:

> 24H Activity · Updates Hourly

### Signals summary

`SignalsSummary` groups all retained signals by lowercased token address and can show four boards, each limited to three rows:

- **Top Net Buys** — buy USD minus sell USD, positive values only;
- **Top Net Sells** — sell USD minus buy USD, positive values only;
- **Top Shared Buys** — tokens bought by at least two distinct roster wallets;
- **Top Shared Sells** — tokens sold by at least two distinct roster wallets.

Shared boards appear only when overlap exists. Rankings use distinct wallet count first and USD volume second. Each row shows the cleaned token symbol, copyable short token address, and either compact USD value or Smartcrush count plus volume.

Relevant files:

- `src/components/SignalsSummary.tsx`
- `src/utils/signalSummary.ts`
- `tests/signalSummary.test.ts`

### Signal cards

Identity follows the same nickname/address hierarchy as Roster and uses no avatar. Each card shows:

- nickname when available;
- wallet address with icon-only copy;
- Nansen wallet label;
- relative trade time;
- `BOUGHT` or `SOLD` action pill;
- cleaned token symbol;
- USD trade value;
- token quantity, or `Quantity unavailable`;
- estimated position-context badge;
- copyable token address;
- Uniswap token-page action in live mode, or demo token-copy action in demo mode.

Context labels are estimates:

- New position
- Adding more
- Taking profit
- Full exit
- unknown fallback: `I don't know actually…`

The page footnote is intentionally explicit:

> Context badges are estimates from current holdings and recent swaps; transfers can affect them. Updates run while the app is open. Nansen only exposes the last 24 hours; saved signals stay here.

Empty states:

- no roster: `Make the first move.` / `Find a match`;
- roster but no recent signals: `Playing hard to get.` / `Your roster’s been quiet. No new moves detected.`

Relevant files:

- `src/components/SignalsFeed.tsx`
- `src/components/SignalCard.tsx`
- `src/components/SignalsSummary.tsx`
- corresponding signal and summary rules in `src/index.css`

## Signal data semantics

`buildSignals` in `src/services/signals.ts`:

- filters trades to current roster addresses;
- deduplicates raw trades by transaction hash, trader, bought-token address, and sold-token address;
- emits separate buy and sell actions;
- omits configured cash/quote legs;
- preserves both non-cash legs of token-to-token swaps;
- reconstructs context backwards from current holdings;
- uses `unknown` when holdings or quantities are insufficient/inconsistent;
- cleans emoji/pictographs from token symbols before display.

Signal IDs include transaction hash, wallet, action, and token address so opposite swap legs survive deduplication.

The quote-token set currently includes USDG, USDC, USDT, DAI, USD, USDC.E, WETH, ETH, WBTC, and BTC.

Nansen only exposes the recent 24-hour DEX window. Saved signals persist locally, but activity missed while the browser is closed for longer than that window cannot be reconstructed.

## Data refresh and persistence

- Swipe sessions contain up to 20 profiles and refresh every 4 hours.
- Displayed wallets are excluded from rediscovery for 24 hours.
- Roster limit is 10.
- Roster polling runs hourly while the app is open, after visibility returns, on roster changes, and manually.
- A roster poll fetches recent trades once, then holdings and since-match P&L per wallet.
- Partial failures preserve previously saved results and show a page-level error.
- Demo and live state are isolated.
- Up to 1,000 signals are retained.
- Breaking up removes that wallet and its signals while retaining its saved nickname.
- Theme and product state persist under localStorage key `smart-crush-v1`; the persistence schema is currently version 3.

The current store migration normalizes older state, adds theme when missing, and retains demo/live sessions.

## Live connection model

Local development can use `NANSEN_API_KEY` from `backend/.env` through the Vite proxy. The key is kept out of browser code. A user-entered key is memory-only for that visit.

Static production builds do not inherit the project key. Hosted live mode needs an equivalent credentialed proxy. Demo mode remains fully functional without credentials.

Current live banner copy:

> ROBINHOOD CHAIN SMART MONEY · POWERED BY NANSEN

The default trade link is the Robinhood-chain Uniswap token page. `VITE_ROBINHOOD_DEX_URL` may override it, but the template must be HTTPS and contain `{token}`.

See `README.md` for the full Nansen schema, retry, pagination, CORS, and deployment notes.

## Key files

- `src/App.tsx` — page headings, navigation, polling, Settings, mode switching, global modals/toasts.
- `src/index.css` — full visual system, Signals summary/card styling, Settings, dark theme.
- `src/store/useAppStore.ts` — versioned persistence, theme, demo/live sessions, swipes, roster, signal merging.
- `src/components/SwipeDeck.tsx` — Swipe layout and actions.
- `src/components/RosterList.tsx` — capacity, sorting, refresh, empty state.
- `src/components/RosterEntry.tsx` — roster card identity, metrics, nickname, expanded details.
- `src/components/SignalsFeed.tsx` — Signals page states and feed.
- `src/components/SignalsSummary.tsx` — aggregate leaderboards.
- `src/components/SignalCard.tsx` — individual trade cards.
- `src/components/SettingsMenu.tsx` — data-mode and theme controls.
- `src/services/nansen.ts` — Nansen requests and profile normalization.
- `src/services/signals.ts` — trade-to-signal classification.
- `src/services/demo.ts` — fictional deck, roster updates, and signals.
- `src/utils/formatters.ts` — money, address, match-time, and token-symbol formatting.
- `src/utils/signalSummary.ts` — summary aggregation/ranking.
- `tests/` — 21 passing unit tests at this checkpoint.
- `scripts/verify-browser.mjs` and `scripts/verify-api.mjs` — browser regressions needing the two stale expectations updated.

## Known follow-ups and cautions

1. **Repair the stale browser assertions first.** Change the nickname save expectation from `Save nickname` to `Save`, and update/remove the per-card `.holdings-freshness` expectation to match the intentionally centralized freshness model. Then rerun all browser/API checks.
2. **Visually review dark mode across every state.** The theme exists and broad overrides are present, but only light mode was visually inspected during this handoff. Check Swipe drag states, empty/loading/error states, all modals, dropdowns, toasts, and expanded Roster details in dark mode.
3. **Check summary layout with overlap boards.** The current demo only displayed Top Net Buys and Top Net Sells because its sample signals had no repeated-token overlap. Verify Top Shared Buys/Sells visually using fixture data.
4. **Do not confuse “Taking profit” with verified profit.** It currently means a partial sale inferred from holdings.
5. **Do not overstate `traded_times`.** The UI calls it times sold, including partial sales; it is not unique-token count or proof of profitable trades.
6. **Avoid broad Swipe/Roster redesigns.** Those pages were polished iteratively with the user. Continue with targeted changes unless explicitly asked for a redesign.
7. **Keep current state authoritative.** There is no Git history at the root, and handoff 04 contains at least one now-obsolete header description.

## Recommended next-session sequence

1. Read this file completely.
2. Start or confirm the demo at `http://127.0.0.1:5173/`.
3. Inspect the current Signals page and ask what the user wants polished next.
4. If touching regression coverage, fix the two stale browser expectations and rerun the full browser/API suite.
5. Before significant release work, inspect light and dark modes across Swipe, Roster, Signals, Settings, and modals.
6. Run `npm test` and `npm run build` after changes.

## Copy/paste prompt for the fresh session

```text
Read /Users/lfgcap/Desktop/Nansen Smart Money/handoffs/05-signals-settings-latest-state-handoff.md completely, then inspect the current app and source before changing anything. The repository root is not a Git repo, so the current filesystem is authoritative. Fire up or confirm demo mode at http://127.0.0.1:5173/ and continue polishing from the current state. Preserve the accepted Swipe and Roster decisions, note that Signals and Settings/dark mode were added by another AI, and remember that unit tests/build pass while two browser regression assertions are stale (old “Save nickname” copy and removed per-card holdings freshness). Ask me what I want to polish next after confirming where we are.
```
