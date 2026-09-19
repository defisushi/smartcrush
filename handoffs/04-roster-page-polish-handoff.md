# Smartcrush handoff — polished Roster page and current product state

Prepared on **19 September 2026 (Asia/Singapore)** for a fresh Codex session.

**Workspace:** `/Users/lfgcap/Desktop/Nansen Smart Money`

**Local demo:** `http://127.0.0.1:5173/`

## Start here

Continue in the **root React/Vite application**. The current source of truth is the filesystem under `src/`, not the older `frontend/` or `backend/` applications.

The workspace root is **not a Git repository**. There is no root commit or diff to recover from, so preserve the current files carefully and use this handoff as the implementation record.

The user has completed a detailed visual and product pass on the **Swipe** and **Roster** pages. The Roster page is now substantially polished and should be preserved unless the user requests a specific change. The likely remaining page for a comparable polish pass is **Signals**.

Read these only for supporting history:

- `handoffs/02-swipe-page-polish-handoff.md` — accepted Swipe-page behavior and earlier terminology.
- `handoffs/03-deployment-and-review-handoff.md` — deployment architecture and older technical follow-ups.

This document supersedes either handoff wherever the visible UI or current implementation differs.

Never print, expose, or commit the Nansen API key. Local development reads it through the proxy configuration; it must not enter the browser bundle.

## First five minutes in a fresh session

```sh
cd '/Users/lfgcap/Desktop/Nansen Smart Money'
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. Use **demo mode** for visual work unless the user explicitly requests live Nansen data.

Routine verification:

```sh
npm test
npm run build
```

Current scripts:

- `npm run dev` — local app on port `5173`.
- `npm run dev:test` — isolated test app on port `5174`.
- `npm test` — Vitest unit suite.
- `npm run build` — TypeScript and Vite production build.
- `npm run test:browser` — browser and API regression scripts; requires the test server.

At this handoff:

- **18 unit tests pass** across `tests/logic.test.ts` and `tests/roster.test.ts`.
- The latest **production build passes**.
- The browser/API regression suite was not rerun after the final cosmetic edits. Earlier major Roster behavior was browser-tested; run the full suite before deployment or a major refactor.

## Current browser and demo state

The in-app browser is open at `http://127.0.0.1:5173/` in **demo mode**, on the **Roster** page.

At the time this handoff was written, localStorage contained a demo roster of roughly **5/10 wallets**, including a few user-created nicknames. This state is only useful for visual review and may change. Demo state persists under the Zustand localStorage key `smart-crush-v1`.

Do not reset the demo session unless the user asks. **Reset demo** refreshes the fictional Swipe deck while preserving the roster.

## Product in one paragraph

Smartcrush is a mobile-first, dating-app-themed interface for discovering Nansen Smart Money wallets on Robinhood Chain. Users swipe on a session of eligible wallets, match with up to ten Smartcrushes, monitor each wallet’s post-match performance, compare current performance with the snapshot captured at matching, inspect current holdings and historical wins, assign human-friendly nicknames, and break up with weak performers. Signals provides a feed of roster-wallet trading activity.

## Terminology and copy rules

Use these forms consistently in user-facing UI:

- Product name: **Smartcrush**.
- Plural: **Smartcrushes**.
- Profit/loss abbreviation: **P&L**, never `PNL` or `PnL`.
- Wallet headline metric: **REALIZED P&L**.
- The bottom navigation remains **Swipe**, **Roster**, **Signals**.

Some earlier docs still show `REALIZED PNL`; those references are outdated.

## Header state

The top-left brand lockup now contains:

- the coral heart mark;
- the Smartcrush wordmark and trademark symbol;
- the subtitle **POWERED BY NANSEN** beneath the wordmark.

The subtitle is intentionally tiny and **right-aligned beneath the wordmark**, closer to the `crush` side. Relevant files:

- `src/App.tsx`
- the `.brand-*` rules near the top of `src/index.css`

The existing chain pill and connection-settings icon remain on the right.

## Swipe page: preserve the accepted design

The Swipe page remains the accepted design described in `02-swipe-page-polish-handoff.md`, with these later updates:

- All P&L labels are standardized to **P&L**.
- The wallet-address copy control is icon-only and has **no border or background box**.
- Greatest Hits token names and ROI multiples are centered in their respective tiles.
- The roster capacity display remains at the bottom of the page.

Avoid broad Swipe-page redesigns without an explicit request.

## Roster page: current visible structure

### Page heading and capacity

The page begins with:

> My Roster

> Up to 10 Smartcrushes you're giving your attention to.

The capacity indicator matches the Swipe page and shows `Roster: N/10` with ten person icons. The former duplicate explanatory line beneath this Roster-page capacity display was intentionally removed.

Empty-state copy:

> Still single?

> Start swiping to find matches and build your roster!

### Sorting and roster refresh

Users can sort by:

- **REALIZED P&L since matching**
- **WIN RATE since matching**

Users can order either metric:

- **Worst first**
- **Best first**

Unknown metrics always sort last.

The sort controls use the custom `RosterDropdown` component rather than native `<select>` elements. This was done because the native expanded menu used a heavier operating-system border than the closed field. Both closed and expanded states now share the same one-pixel border, radius, typography, background, hover state, selection highlight, and checkmark.

There is no separate section header under the sort controls (page title **My Roster** is enough). A single roster-wide freshness label sits with the Refresh action:

> Updated just now

The timestamp is intentionally not repeated on every card or inside expanded details. `RosterList` derives it from the most recent `pnlUpdatedAt` across the roster.

### Wallet identity and nickname controls

Roster cards do not use profile images.

Without a nickname, the identity hierarchy is:

1. truncated wallet address;
2. standalone copy icon;
3. a compact **pencil + Add Nickname** pill;
4. Nansen wallet label;
5. match/activity line.

With a nickname, the hierarchy is:

1. nickname plus a compact **pencil + Edit Nickname** pill;
2. truncated wallet address plus standalone copy icon;
3. Nansen wallet label;
4. match/activity line.

The copy icon intentionally uses its earlier compact treatment: 13px, original neutral color, default Lucide stroke, and no surrounding box. Do not automatically re-standardize it with the nickname pencil; the user explicitly asked to revert that consistency treatment.

The nickname pills are intentionally small:

- 24px minimum height;
- 8px label;
- 11px pencil;
- compact padding and pill radius.

The nickname modal:

- uses **Name your Smartcrush** for a new nickname and **Edit nickname** for an existing one;
- shows the short address;
- limits nicknames to 24 characters in code but does not state the limit in visible copy;
- helper copy is: `Saved on this device. Delete nickname to use the original wallet address again.`;
- primary action is simply **Save**;
- saving an empty value removes the nickname and restores the address as the display name.

Nicknames are stored locally per mode through Zustand.

### Match and activity line

Under the Nansen wallet label, tenure and activity are grouped on one line:

> Matched 47m ago, sold 15 times since matching.

Singular grammar is handled for one trade. If performance data is not yet available, the sentence shows only the match time.

Match-time formatting is deliberate:

- matches from today use `just now`, minutes, or hours;
- older matches use an absolute date such as `19 Sep 26`.

The formatter is `matchTime` in `src/utils/formatters.ts`.

### Collapsed performance card

The main card always prioritizes current post-match performance:

- **WIN RATE** / `since matching`
- **REALIZED P&L** / `since matching`

Values use a 23px metric scale. Positive P&L is green; negative P&L is red. A wallet may correctly show a high win rate and negative realized P&L when one large loss outweighs many smaller wins.

The footer controls are:

- **View Details** / **Hide Details** with a disclosure chevron;
- **Break up** as one rounded coral button containing a white broken-heart icon and white text.

The breakup action still opens the confirmation modal; it must not immediately remove the wallet.

### Expanded View Details hierarchy

The expanded section intentionally follows **current → baseline → historical context**:

1. **Currently Into**
2. **Stats At Match**
3. **Greatest Hits**

This ordering was chosen because the collapsed card already shows current post-match stats. Showing baseline data before current holdings produced an awkward current → old → current sequence.

#### Currently Into

This is the wallet’s refreshed current holdings, not a matching-time snapshot. It appears first in View Details as token chips. Refresh failures preserve the last successful holdings snapshot and expose an unavailable message when needed.

The former per-section `Checked just now` line was intentionally removed because freshness is already shown once beside the roster Refresh control.

#### Stats At Match

Heading:

> Stats At Match

Subline:

> This Smartcrush's stats when you first swiped on em.

This section shows the discovery snapshot captured when the wallet was matched:

- **WIN RATE** / `at matching`
- **REALIZED P&L** / `at matching`

The at-match metric typography exactly matches the main since-matching metric typography:

- 9px metric labels;
- 9px supporting labels;
- 23px values;
- the same spacing and value letter-spacing.

The baseline comes from `entry.wallet.winRate` and `entry.wallet.realizedPnlUsd`. Roster refreshes update since-match performance and current holdings but do not overwrite these discovery metrics.

#### Greatest Hits

Heading:

> Greatest Hits

Subline:

> This Smartcrush's historical wins when you first swiped on em.

The section shows up to three discovery-time top tokens and ROI multiples. Both the token symbol and multiple are centered within each tile.

### Footer note

Current Roster footer:

> Nansen figures can lag by up to an hour.

The clauses `P&L is realized` and `win rate measures profitable sales` were intentionally removed after the metric labels became self-explanatory.

## Data model and update behavior

Relevant types are in `src/types/index.ts`.

Each `RosterEntry` contains:

- `wallet` — discovery profile and the latest current holdings;
- `addedAt` — matching timestamp;
- `pnlSinceAdded` — realized P&L for the post-match date range;
- `winRateSinceAdded` — profitable-outcome rate for that date range;
- `salesSinceAdded` — activity count currently derived from Nansen `traded_times`;
- `pnlUpdatedAt` — successful performance refresh time;
- `holdingsUpdatedAt` and `holdingsError` — holdings freshness/error state.

When a user matches with a wallet, the current `WalletProfile` is stored as the immutable discovery baseline for win rate, realized P&L, and Greatest Hits. `applyPoll` later updates only:

- since-match realized P&L;
- since-match win rate;
- the activity count;
- current holdings and holdings status.

The holdings array lives inside `entry.wallet`, so it changes over time. The discovery metrics and `topTokens` stay unchanged.

### Important production data-definition check

The interface currently says:

> sold 15 times since matching.

The underlying count is derived from `PnlSummary.traded_times` in `src/utils/roster.ts`. Nansen defines this as total sales (outflow or DEX sell), including partial sells — not round-trip closed trades. UI copy uses **sold X times since matching**.

## Key implementation files

- `src/App.tsx`
  - app orchestration, tabs, polling, modals, mode banner, header brand lockup.
- `src/components/RosterList.tsx`
  - capacity, sorting state, roster-wide freshness, nickname modal, empty state.
- `src/components/RosterDropdown.tsx`
  - custom Sort by and Order menus, outside-click close, Escape close, selection UI.
- `src/components/RosterEntry.tsx`
  - card identity, nickname pills, copy control, current metrics, activity sentence, View Details hierarchy.
- `src/components/NicknameModal.tsx`
  - local nickname form and current copy.
- `src/store/useAppStore.ts`
  - persisted demo/live sessions, roster match/breakup/nickname actions, performance and holdings updates, storage migration.
- `src/utils/roster.ts`
  - post-match performance normalization and stable unknown-last sorting.
- `src/utils/formatters.ts`
  - compact money, signed money, percentages, relative time, absolute match dates.
- `src/services/demo.ts`
  - deterministic fictional post-match performance and holdings.
- `src/index.css`
  - most visual treatment, including header, custom dropdowns, compact cards, nickname pills, baseline tiles, and responsive mobile frame.
- `tests/roster.test.ts`
  - since-match calculations, stale-response protection, refresh-failure preservation, sorting, and migration.

## Accessibility and interaction notes

- Roster cards can be toggled by clicking non-interactive card space.
- Buttons, links, inputs, selects, and text selection do not trigger card expansion.
- Copy and nickname controls have accessible labels and tooltips.
- View Details uses `aria-expanded` and `aria-controls`.
- The custom dropdown exposes a popup button, listbox, and selected option; it closes on outside click and Escape.
- The shared `Modal` component handles focus trapping, Escape, backdrop dismissal, and focus restoration.
- Reduced-motion behavior already exists for swipe and match animations.

One future accessibility improvement would be fuller arrow-key navigation within `RosterDropdown`; do not replace it with the inconsistent native menu merely for convenience.

## Known follow-ups and sensible next work

### Product and UX

1. **Polish Signals** to the same standard as Swipe and Roster. This is the clearest next visual task.
2. ~~Verify activity-count wording~~ Done: use **sold X times since matching** (`traded_times` = sales).
3. Consider whether a dedicated comparison treatment should calculate deltas between at-match and since-match metrics. The user has not requested deltas yet; current UI shows both snapshots without claiming they are directly additive.
4. Recheck the smallest 6–9px type across the whole app before production. The user deliberately approved several compact 8–9px labels, so do not globally increase them without a visual review.

### Engineering

1. Run the complete browser/API regression suite after starting `npm run dev:test`.
2. Choose a hosting platform and finalize the production proxy; `03-deployment-and-review-handoff.md` documents the open deployment decision.
3. Create a root Git repository before broader work so future handoffs can reference commits and diffs.
4. Revisit the older review items: quote-symbol filtering, retry-delay feedback, `$0` trade-value handling, and the `seenTxHashes` naming mismatch.

## Things not to regress

- Do not reintroduce a profile image on Roster cards.
- Do not put per-wallet freshness timestamps back on every card or inside View Details.
- Do not move sales/activity back into a disconnected detail section; tenure and activity belong together.
- Do not show the copy text label; copy controls are icon-only.
- Do not restore copy-icon boxes on Swipe or Roster.
- Do not make the nickname action consume its own full row.
- Do not put Currently Into below the matching-time snapshot again.
- Do not replace `P&L` with `PNL` or `PnL`.
- Do not clear the user’s demo roster while doing ordinary visual work.

## Suggested first message for the next session

Use this prompt to resume cleanly:

> Read `/Users/lfgcap/Desktop/Nansen Smart Money/handoffs/04-roster-page-polish-handoff.md`, inspect the current root app, start it in demo mode at `http://127.0.0.1:5173/`, and confirm you understand the product and current Swipe/Roster state. Preserve the accepted Swipe and Roster designs unless I request a specific change. We will continue with the remaining page polish.

