# Smartcrush — approved signal accuracy fixes

20 September 2026, Asia/Singapore. Follows audit 07; its raw evidence remains a historical record of pre-fix behavior.

The user approved findings 1, 2, 3, and 5. They specified a rolling 24-hour view with no saved-history view, the label “Reducing position,” the recommended aggregation fix, and the exact text “Unavailable” for missing dollar values. They asked for clarification of finding 4 rather than approving a holdings-source change.

Implemented:

- Signals and all four summary boards use the same rolling 24-hour subset. The existing app clock removes expired rows from the visible view while the page is open; returning to a visible tab also updates it. Invalid/future timestamps are excluded. Cached expired rows are pruned when polling and restoring storage. No archive UI was added. The existing 1,000-signal safety cap remains.
- “Taking profit” is now “Reducing position.” The internal `taking_profit` discriminator remains for persisted-data compatibility; it no longer appears as a profitability claim in the interface.
- Distinct token pairs or quantities within the same wallet/transaction are summed into a single token/action signal before reverse balance reconstruction. Repeated execution observations are deduplicated using transaction, wallet, token pair, quantities, and time, normalizing address/hash case. Both sides of a same-token round trip are retained but receive unknown context. Unknown quantities invalidate older balance estimates instead of inventing position context.
- Missing/nonfinite/negative dollar values remain null and display “Unavailable”; actual zero remains $0. If any constituent leg lacks a valuation, the combined signal's total is also unavailable. Incomplete tokens are excluded from net-dollar boards. Shared-wallet counts still include those trades, with “Unavailable” for incomplete action volume and a short explanation beneath the boards.
- Persistence schema is now version 5. Earlier computed signal caches are cleared so overwritten legs and invented zero values do not survive the upgrade; polling repopulates the recent window. Version-4 roster performance, matches, nicknames, mode, theme, and welcome-screen preference are preserved. Older migrations retain their existing performance reset behavior.

Limits: the API payload does not supply an execution/log index. Two genuinely distinct executions with exactly the same transaction, wallet, token pair, amounts, and time cannot be distinguished from duplicate observations. The fix preserves distinguishable constituent legs and explicitly documents that limitation. No new live requests were needed for these corrections.

Finding 4 impact explained to the user: the P&L-derived holdings list may omit a token or disagree with the dedicated balance endpoint, affecting “Currently Into” and position-context estimates. This does not invalidate the correctly mapped headline realized P&L. The holdings source was left unchanged. Other audit findings remain open.

Tests: 31 unit tests pass, including ten new accuracy checks. Formatting/TypeScript and production build pass. The browser suite now includes `scripts/verify-signals.mjs`, which checks the 24-hour feed and summaries, expiry as the clock advances, “Unavailable,” and “Reducing position.” Existing browser scripts now enter through the current welcome screen in both desktop and mobile profiles. Formatting-only normalization was applied to the existing App, Welcome, and CSS files to satisfy the project check.

Final browser results: the existing full interaction suite, mocked API suite, and focused Signals expiry suite all passed. The focused suite uses normal localStorage restoration for its fixtures; the initial dynamic-module injection approach was replaced because Vite can serve a separate module instance after hot updates. This was a fixture issue, not a product-state failure. Screenshot: `artifacts/signals-accuracy.png`.

Key files: `src/services/signals.ts`, `src/utils/signalWindow.ts`, `src/utils/signalSummary.ts`, `src/components/SignalCard.tsx`, `src/components/SignalsFeed.tsx`, `src/components/SignalsSummary.tsx`, `src/types/index.ts`, `src/store/useAppStore.ts`, and `tests/signalsAccuracy.test.tsx`.

The earlier offline diagnostic `artifacts/audit-2026-09-20/audit-data.ts` intentionally asserted pre-fix defects and is no longer a passing regression suite. Use the tests under `tests/` and `npm run test:browser` to validate current behavior.
