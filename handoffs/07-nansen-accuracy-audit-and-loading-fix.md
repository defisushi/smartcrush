# Smartcrush — Nansen accuracy audit and loading alignment

20 September 2026, Asia/Singapore. Read handoff 06 for the accepted palette and handoff 05 for product context. The current root application remains authoritative; the Python Copycats backend and nested frontend are legacy applications.

## Conclusion

The tested Nansen requests authenticate and accept Robinhood, and the app correctly maps the sampled realized P&L, win-rate fractions, quantities, and detailed ROI multiples. Smartcrush is useful for discovering and observing selected wallets. Several labels and summaries invite stronger conclusions than the data supports, and there are reproducible aggregation/freshness defects.

This was an evaluation, not a rewrite of the data logic. The only product change made was the user's requested loading alignment: the heart and progress text now sit together in the center of the search card. Placeholder bars are omitted for that state; compact loading cards retain them. The cream/coral palettes remain intact.

## Verification and scope

- Read handoffs 05 and 06, current React services/store/components, both proxies, tests, README, and the legacy backend entry point to establish the active data path.
- Existing 21 unit tests, formatting, TypeScript, and production build pass. The two existing browser suites passed earlier in this audit. Following the loading-only edit, unit checks/build were rerun and a targeted disposable-browser check verified exact horizontal/vertical centering, no overflow, and no page errors in both themes at 390 × 844.
- Live checks: 24 successful HTTP 200 responses in total, including the initial two-call smoke test. The 22 recorded requests reported 30 credits used; the initial smoke test did not record credit headers. Discovery testing fetched one page of 1,000 rows, containing 215 distinct wallets, with another page available. Only two wallets received detailed sampling. This is not a complete discovery-pool or chain audit.
- The exact app shapes were exercised for discovery, all-history P&L summaries, top-10 detailed ROI, paginated holdings, two-wallet roster trades, and rolling-24-hour summaries. Short-range summaries also succeeded through the actual local proxy without a browser-supplied credential and returned zero activity.
- Compared fresh P&L holdings with the dedicated current-balance endpoint for the same two wallets. Compared the API evidence with the app's actual normalization, signal builder, summary builder, formatter, and store functions using an offline diagnostic harness.
- There was a usage-limit interruption. Initial evidence is from approximately **20 Sep 04:25 SGT**; resumed checks are from **14:41–14:43 SGT**. The first resumed balance comparison used the old P&L cutoff and must not be treated as contemporaneous. The separate `crosscheck-now-responses.json` comparison corrects this.
- No independent RPC/explorer reconstruction of transactions or cost bases was performed. Live acceptance establishes API compatibility, not the economic correctness of every upstream figure. No user browser storage was reset. No deployment occurred.

## Recorded examples: API values to displayed values

These examples use the initial captured responses, not continuously current prices.

| Wallet | Raw realized P&L | Display | Raw win rate | Display | Greatest Hit |
| --- | ---: | --- | ---: | --- | --- |
| `0xfd7081fd01e6db24107e04b76a25fced7c46ac41` | $240,950.3414568 | +$241.0K | 0.4054054054 | 41% | PONS: ROI 1.0928406367 → 2.1× |
| `0x9fc71adf531476bcf08fcd31e6eff5f52c2f9daf` | $208,283.5932500 | +$208.3K | 0.2578616352 | 26% | QUOTRON: ROI 28.8433505358 → 29.8× |

The ROI mapping `1 + roi_percent_realised` is correct for this endpoint. It is a return multiple on the realized portion, not a multiple on the wallet's whole portfolio. Summary figures can be cached for about an hour, and sales counts can include outflows as well as DEX sells. [Nansen P&L reference](https://docs.nansen.ai/api/profiler/address-pnl-and-trade-performance).

The all-history/24-hour queries returned different results as expected. The first wallet's 24-hour summary returned +$68,721.09; the second returned −$495.53. This supports date filtering but does not independently establish exact boundary treatment or every historical cost basis. The two short-range proxy queries returned zero P&L, zero trades, and zero tokens.

## Prioritized findings

### 1. P1 — “24H Activity” and summary rankings include older saved trades

Confirmed with the actual summary/store functions. A $10,000 buy from 48 hours ago plus a current $100 sale produces **Top Net Buys: $9,900**, although the actual current-window activity in this example is a $100 sale. Saved signals are retained without a date filter, up to 1,000 rows. The visible feed is also unfiltered. The archive footnote does not resolve the conflicting 24-hour heading.

Locations: [SignalsFeed.tsx:40](</Users/lfgcap/Desktop/Nansen Smart Money/src/components/SignalsFeed.tsx:40>), [signalSummary.ts:38](</Users/lfgcap/Desktop/Nansen Smart Money/src/utils/signalSummary.ts:38>), [useAppStore.ts:193](</Users/lfgcap/Desktop/Nansen Smart Money/src/store/useAppStore.ts:193>).

Recommended fix: derive a time-filtered 24-hour view for both feed and boards, and offer saved history separately with its own explicit period. Mark incomplete coverage after long offline gaps or retention truncation. The upstream Smart Money DEX endpoint exposes only a trailing 24-hour window. [Nansen DEX reference](https://docs.nansen.ai/api/smart-money/dex-trades).

### 2. P2 — “Taking profit” does not establish profit

Confirmed: a sale that leaves a positive balance receives `taking_profit`, without consulting sale cost basis. A constructed loss-making sale produces the same badge. “Looks like” and the estimate footnote soften certainty but do not change the claim conveyed by the label.

Location: [signals.ts:54](</Users/lfgcap/Desktop/Nansen Smart Money/src/services/signals.ts:54>).

Recommended fix: call this “Partial sale” or “Reducing position.” Reserve profitable-sale claims for reconciled realized P&L. “New position” means an inferred zero balance before the observed buy, not the wallet's first-ever purchase or necessarily a voluntary investment decision.

### 3. P2 — Signal IDs can discard separate legs in one transaction

Confirmed with two rows sharing wallet, transaction, and bought token, but using different sold tokens. The raw deduplication keeps both rows; the emitted signal map overwrites the first buy with the second. A 10-token/$100 leg plus a 20-token/$200 leg becomes **20 tokens/$200**, not 30/$300. This affects summaries and displayed quantities. The captured nine-row sample did not itself contain this collision.

Location: [signals.ts:18](</Users/lfgcap/Desktop/Nansen Smart Money/src/services/signals.ts:18>), especially the emission key at line 68.

Recommended fix: preserve an upstream execution identity when available; otherwise explicitly aggregate distinct constituent legs before generating a wallet/transaction/token/action signal. Define duplicate versus distinct execution handling rather than summing every repeated record.

### 4. P2 — “Currently Into” is a P&L-derived subset, not a verified complete portfolio

The current app uses P&L rows instead of dedicated balances and shows only four symbols. Contemporaneous checks around 14:43 SGT found:

- Wallet 0: 27 positive P&L holdings versus 28 current-balance tokens. The missing token was USDG; quantities agreed for all shared tokens.
- Wallet 1: 19 positive P&L holdings versus 16 current-balance tokens. USDG was missing from P&L, four P&L tokens were absent from the spam-filtered balance response, and ETH quantities disagreed (0.2170960 versus 0.1659179). Requests were seconds apart; endpoint timing, spam filtering, or accounting scope may explain this. This is an unresolved reconciliation difference, not proof of a false blockchain balance.
- The wallet-1 visible top four differed: P&L showed QUOTRON, ETH, VLAD, FLOCK; balances showed QUOTRON, ETH, USDG, FLOCK.

Location: [nansen.ts:225](</Users/lfgcap/Desktop/Nansen Smart Money/src/services/nansen.ts:225>). Dedicated endpoint: [Nansen current balances](https://docs.nansen.ai/api/profiler/address-current-balances).

Recommended fix: use current balances for portfolio presence and position reconstruction, state the spam/quote policy explicitly, and retain P&L for performance. Until reconciled, use “Top tracked holdings” and keep context badges tentative. Do not conclude that omitted assets have a zero balance.

### 5. P2 — Missing trade valuations become $0

Confirmed: `trade_value_usd: null` becomes `amountUsd: 0`, which renders as a real zero-value trade and contributes zero dollars to rankings. Nansen's schema permits missing valuations.

Location: [signals.ts:76](</Users/lfgcap/Desktop/Nansen Smart Money/src/services/signals.ts:76>).

Recommended fix: retain an unknown value, show “Value unavailable,” and state how missing valuations affect rankings. Validate nullable API fields at the boundary instead of relying only on TypeScript interfaces.

### 6. P2 — Successful checking can be mistaken for fresh data

Confirmed: `applyPoll` advances Signals' `lastPolledAt` even if every data request failed, while preserving old signal/P&L values. Signals then says “Updated just now.” The error banner provides context during that visit, but it is transient. Roster freshness uses the newest P&L timestamp across wallets, so a partially refreshed roster can also appear uniformly fresh.

Locations: [useAppStore.ts:208](</Users/lfgcap/Desktop/Nansen Smart Money/src/store/useAppStore.ts:208>), [SignalsFeed.tsx:27](</Users/lfgcap/Desktop/Nansen Smart Money/src/components/SignalsFeed.tsx:27>), [RosterList.tsx:41](</Users/lfgcap/Desktop/Nansen Smart Money/src/components/RosterList.tsx:41>).

Recommended fix: distinguish last attempt, successful trades fetch, and successful performance/holdings fetches. Preserve a page-wide partial/stale status without reintroducing repeated per-card timestamps.

### 7. P2 — Match baseline actually comes from deck preparation

The match stores the already-loaded `wallet` object and records a new `addedAt`. It does not refresh lifetime statistics at matching. With a four-hour deck, “Stats At Match” can predate matching substantially; upstream caching can add delay. “ACTIVE IN THE LAST 24H” is likewise a statement at discovery time rather than a continuously checked status.

Locations: [useAppStore.ts:149](</Users/lfgcap/Desktop/Nansen Smart Money/src/store/useAppStore.ts:149>), [RosterEntry.tsx:188](</Users/lfgcap/Desktop/Nansen Smart Money/src/components/RosterEntry.tsx:188>).

Recommended fix: save an explicit profile observation timestamp and label the baseline “Stats when discovered,” or request a new baseline on matching. Since-match realized P&L is correctly requested using `addedAt`; it does not depend on subtracting this stale baseline.

### 8. P2 — Sales wording is narrower than Nansen's accounting definition

`traded_times` is rendered as “sold N times.” The documented count includes outflows, so it should not be interpreted as exactly N DEX executions or N independent trading decisions. The sample's summary counts and recent DEX row counts differ; that alone is expected and does not prove a request bug.

Location: [RosterEntry.tsx:103](</Users/lfgcap/Desktop/Nansen Smart Money/src/components/RosterEntry.tsx:103>). Suggested wording: “N recorded sells/outflows.” Win rate is copied correctly as a fraction, but its detailed denominator was not independently reconstructed. Do not describe it as a forecast of the next trade's success probability.

### 9. P1 before public deployment — Shared-key hosted proxy has no application access/budget controls

Static review: the Vercel handler forwards a caller-supplied path/method with the server's API key when no client key is supplied. Unlike the development proxy, it does not restrict callers to the three read endpoints, and there is no in-handler authorization, rate limit, or credit budget. If publicly deployed without external access controls, other callers could consume project credits. This was not tested against a deployed host.

Location: [api/nansen/[...path].ts:4](</Users/lfgcap/Desktop/Nansen Smart Money/api/nansen/[...path].ts:4>).

Recommended fix before publishing: allowlist method and endpoint, validate inputs, require the intended access policy, and enforce server-side budgets/rate limits. Keeping the key out of JavaScript is good but does not itself protect the billable proxy.

## What the observed data can and cannot tell you

**Supported:** a sampled wallet had Nansen-reported realized P&L on Robinhood over the requested period; it was selected by one of the requested Smart Trader category filters and had recent indexed DEX activity; it bought/sold the reported token quantities; multiple distinct roster addresses traded the same token within the actual analyzed records.

**Not established:** future returns, copy-trading profitability, the user's achievable entry/exit price, total portfolio return, independent ownership of different addresses, current conviction, or a complete flow history. Selection favors wallets with large recent individual trades, not a ranking of the best risk-adjusted traders. One large trade can dominate discovery ordering. Greatest Hits deliberately displays winners and omits the loss distribution.

**A concrete warning against inferring profit from net signals:** wallet 1 bought and then sold 92,870.938526 ORBIO. The buy row recorded 5,000 USDG paid and the sale 4,886.012994 USDG received. Nansen's 24-hour P&L summary reported an ORBIO loss of **$114.0169**. However, the DEX rows' supplied `trade_value_usd` fields were $4,994.2910 and $5,400.9438, causing Smartcrush's net-sell board to report **$406.6528**. The app copied those valuation fields correctly; their difference is not a realized-profit calculation. The reason for the upstream valuation discrepancy was not independently established.

**Historical concentration:** in the captured lifetime summaries, PONS realized gains equaled about 91% of wallet 0's net realized P&L; QUOTRON equaled about 76% of wallet 1's. These are shares of net realized profit, not portfolio weights. Positive P&L with a sub-50% displayed win rate is possible, and selected historical winners do not establish consistent repeatable performance.

**Scope of Signals:** replaying the nine captured DEX rows emitted only four non-quote signals: two PONS sells and an ORBIO buy/sell. Five ETH/USDG swaps disappeared by design because both legs are in the quote-symbol set. Thus a quiet feed does not imply an inactive wallet. ETH and BTC are excluded along with stablecoins; symbol-based identification can also suppress unrelated tokens using the same ticker. Prefer chain/address-based token identities and disclose which assets are omitted.

**Shared buys:** two addresses buying a token means address overlap, not two independent people agreeing, net accumulation, or a coordinated entry. Both addresses may subsequently have sold; the current shared-buy board still counts their buys. A browser-specific saved archive also makes rankings dependent on when the app was open.

**Since-match P&L:** this measures the tracked wallet's realized results during a period. Sales may realize gains built up before the match. It is not what a fresh investment at the match timestamp would have earned, and it does not include all open-position losses, execution friction, or missed signals in a hypothetical follower's return.

## Project assessment

| Dimension | Assessment |
| --- | --- |
| Correctness | Core request/field mappings passed the sample; period filtering, event identity, freshness, and interpretation need correction. |
| Security | Server-side key handling and memory-only client keys are good; protect the hosted shared-key proxy before public use. |
| Performance | Client requests are serialized and discovery reads all pages before filling up to 20 profiles. Correctness-first pagination is good, but costs and long loading times can grow with unrelated activity. Add bounded candidate selection/caching with explicit coverage. |
| Maintainability | The active root app has focused modules and passing tests. Legacy apps and stale README connection/schema text make source-of-truth confusion possible; document the current path clearly. |

Positive safeguards already present: demo/live isolation, no silent demo substitution on errors, retry/backoff, complete-page checks, preserved previous values on partial failure, address-based token grouping, opposite-leg retention for ordinary swaps, and protection against stale responses updating rematched wallets.

## Artifacts and resuming

All evidence is under `/Users/lfgcap/Desktop/Nansen Smart Money/artifacts/audit-2026-09-20/`:

- `live-responses.json`: original ten API response records, request bodies, timestamps, and credit headers; no request credentials.
- `crosscheck-responses.json`: first five resumed checks; balance comparisons span the interruption and are not contemporaneous.
- `crosscheck-now-responses.json`: seven fresh reconciliation/proxy checks.
- `analysis.json`: app-derived sample displays, live signal replay, and six deterministic defect/limitation reproductions.
- `audit-data.ts`: offline diagnostic harness. Run `node_modules/.bin/vite-node --mode test artifacts/audit-2026-09-20/audit-data.ts`. Assertions document audited behavior, including defects; this is not part of the normal desired-behavior test suite.
- `loading-light.png`, `loading-dark.png`, and `check-loading.mjs`: loading-state evidence and isolated visual check. Network calls are intercepted in this check.
- `live-audit.mjs` and `crosscheck.mjs`: repeatable live probes; running them again consumes Nansen credits.

Product edits: `src/components/SkeletonCard.tsx` and `src/index.css`. Build output is refreshed. The regular preview was restarted on `http://127.0.0.1:5173/`. Check whether it is still running before starting another server.

Recommended next implementation order: explicit 24-hour versus archive views; neutral sale labels and unknown-value handling; collision-safe signal aggregation; accurate page-wide freshness; holdings reconciliation and observation timestamps; hosted proxy protection before deployment. These recommendations have not yet been implemented.
