# Smartcrush

A mobile-only smart-money dating app built from `CODEX_BUILD_PROMPT.md`. Scout wallets on Robinhood chain, match with up to ten, and follow their trades.

This is the current application at the **project root**. The previous `backend/` and `frontend/` applications are legacy; local development still reads the project credential from `backend/.env`.

## Run

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The app stays 390px wide on every screen, centered against a dark desktop background. The content scrolls inside the phone frame, with navigation always available.

For local development, the app automatically uses `NANSEN_API_KEY` from `backend/.env` when present. The development server forwards only the three Nansen read endpoints used by this app and keeps that key out of browser code. If you are already in demo mode, open Connection settings and select **Use project API key**.

Without a configured project key, enter your own key on the welcome screen or choose **Take a peek with demo wallets**. Demo mode uses explicitly labeled fictional data, requires no credentials, and makes no Nansen requests. Demo and live state are stored separately.

An API key entered in the app stays in memory for that visit. After a page reload, reconnect to restore live access; your roster and cached deck remain saved. Alternatively, copy `.env.example` to `.env.local` and set `VITE_NANSEN_API_KEY` for personal use. Vite environment values are public in the browser bundle: do not publish a shared secret through this option.

## Included

- React 19, TypeScript, Vite, Zustand, and Framer Motion.
- Touch/pointer swipe gestures with drag-follow, rotation, match/pass stamps, snap-back, and tap controls. Reduced motion is respected.
- Up to 20 wallet profiles per four-hour session. Discovery addresses are deduplicated, existing roster members are excluded, and displayed wallets are excluded from discovery for 24 hours.
- Realized P&L, win rate, three historical winning tokens, and current holdings on each Swipe profile.
- A ten-wallet roster, persistent matching timestamps, confirmation before breakups, and preserved card position when a full roster rejects a match.
- Per-wallet realized P&L and win rate queried from the exact matching timestamp. Sort either metric best or worst first (default: P&L, worst first). Unavailable metrics stay last; zero sales leave win rate unranked.
- Wallet nicknames (24 characters maximum) saved on this device, isolated by demo/live mode and retained through breakups and demo resets. Clear a nickname to return to the address.
- Expand one roster card at a time for historical Greatest Hits from discovery and Currently Into holdings refreshed with the hourly poll or manual Roster refresh. Failed refreshes preserve prior results and check times. Wallet performance is not a copy-trading return calculation.
- Hourly signal polling while the app is open, catch-up after tab visibility returns, immediate polling on roster changes, and manual refresh.
- Reverse-chronological buys and sells, token quantities, transaction deduplication, and estimated position context. Non-cash token swaps retain both legs.
- **Copy this trade** opens the token on Uniswap for Robinhood chain. It does not connect a wallet or execute a trade. Demo tokens only offer address copying.
- Premium 15-minute signals and auto-copy are clearly marked as unavailable placeholders.
- Loading, empty, error, full-roster, and exhausted-deck states; API retry handling; keyboard-accessible dialogs with focus containment.
- Versioned localStorage persistence, with a notice if browser storage cannot save changes. The v2 migration preserves saved rosters and decks and requests fresh period performance and holdings.

## Data integration

All Nansen requests are in `src/services/nansen.ts`. During local development with `backend/.env`, requests go through the Vite server at `/api/nansen`; it supplies the `apikey` header and forwards to `https://api.nansen.ai`. This is necessary because live testing confirmed that Nansen does not provide the CORS headers required for direct browser access. There is no separate backend process.

The project key is never inherited by production builds. A hosted deployment needs an equivalent credentialed proxy before live data can work there; the static build alone supports demo mode. The direct-browser path remains available for explicitly entered keys if Nansen enables CORS in the future.

The implementation follows the current official API schema where it differs from the prompt:

1. **Robinhood is supported** by the current Smart Money and Profiler PnL chain enums.
2. **PnL requests require a nonempty `date` range in live use, including holdings.** Headline requests use an explicit epoch-to-now range to cover all available chain history. Since-match requests start at the exact matching timestamp. Actual coverage depends on Nansen's history and indexing.
3. **Detailed `roi_percent_realised` is a ratio, not a percentage multiplied by 100.** Return multiple is `1 + roi_percent_realised`; a value of 141 becomes 142×. Summary winners are cross-referenced with detailed ROI. A missing detailed ROI is shown as unavailable rather than guessed.
4. Holdings are fetched from the per-wallet PnL endpoint, not aggregate Smart Money holdings. Paginated holdings and trade feeds are read to completion; if the safety limit of 20 pages × 1,000 rows is exceeded, the app preserves the previous complete feed and reports an error.
5. Requests are serialized with at least 260ms between starts. HTTP 429 and server errors retry up to three times, respecting `Retry-After` seconds or dates. Delays over a minute are shown to the user rather than retried early. Requests time out after 30 seconds.
6. New-position/add/partial-sale/full-exit labels are **estimates** reconstructed backwards from current holdings and the recent trade window. Unknown or inconsistent data produces “Context unavailable.” Transfers and indexing delays can affect estimates. “Reducing position” means an estimated partial sale, not a verified profitable sale.
7. Signal IDs include transaction hash, wallet, token, and action. Distinct token-pair/quantity observations within a transaction are aggregated by wallet, token, and action before position context is calculated. Repeated identical observations are deduplicated. The API has no execution index, so otherwise identical same-transaction executions cannot be independently distinguished. Opposite token-swap legs are preserved. Only signals in the rolling last 24 hours are shown in the feed and summary boards, with a 1,000-signal safety cap. Expired signals are pruned on polls and restore; there is no saved-history view. A breakup removes that wallet’s signals, including results from a poll already in progress.

Missing trade values display **Unavailable**. Tokens with any unvalued trade are excluded from net-dollar rankings; shared-wallet counts remain available and incomplete shared-action volume displays **Unavailable**.

Nansen exposes only the trailing 24 hours of DEX trades. A browser-only app cannot fetch during a closed session, so gaps longer than a day cannot be reconstructed. PnL summaries may lag by up to an hour. Failed performance updates keep their prior value and “checked” timestamp.

A custom HTTPS DEX URL can be supplied with `VITE_ROBINHOOD_DEX_URL`; it must contain `{token}`. The default is `https://app.uniswap.org/explore/tokens/robinhood/{token}`, which opens the chain-specific token page without assuming trade size or direction.

Official references verified during implementation:

- [Nansen Smart Money DEX Trades](https://docs.nansen.ai/api/smart-money/dex-trades)
- [Nansen PnL summary and detail](https://docs.nansen.ai/api/profiler/address-pnl-and-trade-performance)
- [Uniswap on Robinhood Chain](https://blog.uniswap.org/robinhood-chain-is-live)

## Verify

```sh
npm run lint
npm test
npm run build
```

`npm run lint` checks formatting and TypeScript (including unused code). Run `npm run format` to apply formatting fixes.

For browser checks, start the isolated test preview (port 5174, project key disabled) in another terminal, then run the suite with Google Chrome installed:

```sh
npm run dev:test
# In another terminal:
npm run test:browser
```

The browser suite uses isolated temporary profiles. `verify-browser.mjs` checks mobile/desktop dimensions, swiping, roster capacity, confirmation/cancellation, the held-card flow, persistence, signals, and session exhaustion. `verify-api.mjs` intercepts all Nansen requests with fixtures and checks request fields, authentication errors, rate-limit retries, empty/missing data, ROI, holdings context, Uniswap links, refresh deduplication, and secret-free persistence. It consumes no API credits. Screenshots are written to `artifacts/`.

The unit suite checks state transitions, in-flight breakup handling, persistence, swap interpretation, missing-data behavior, ROI normalization, Retry-After handling, and HTTPS link validation. Roster coverage also includes both sort directions, zero-sales win rate, nickname persistence, v1 migration, retained data on failures, and protection against responses for an earlier matching period. Browser checks exercise nickname editing, keyboard disclosure, sorting, one expanded card, and mocked since-match metrics and refreshed holdings.

**Live validation:** the project key authenticated successfully, Robinhood discovery returned live trades, and profile hydration loaded through the local development proxy. The key was not printed or copied into app source. Account credits and Nansen availability still govern subsequent requests; errors never silently substitute demo data.

## Source map

- `src/App.tsx`: navigation, refresh orchestration, connection settings, toasts, and dialogs.
- `src/components/`: swipe deck, wallet profiles, roster, signals, setup, and reusable UI.
- `src/store/useAppStore.ts`: persisted and isolated demo/live state, roster limits, and signal merging.
- `src/services/nansen.ts`: authenticated requests, throttling, retries, pagination, and profile hydration.
- `src/services/signals.ts`: trade classification, deduplication, and external links.
- `src/services/demo.ts`: fictional wallet pool and sample signals.
- `src/index.css`: fixed phone frame, coral/cream visual theme, and reduced-motion treatment.
