# Smartcrush — freshness and discovery baseline fixes

21 September 2026, Asia/Singapore. Implements audit findings 6 and 7 at the user's request.

Freshness now describes successful checks, not guaranteed upstream freshness:

- Signals keeps separate persisted fields for the last polling attempt, last successful trades fetch, and complete/partial/failed refresh status. A failed request preserves the successful check time and displays “Refresh failed · Last checked …”. A successful trades fetch with unavailable holdings displays “Trades checked … · Context incomplete”. A successful empty response counts as a check; a failed empty feed no longer claims that the wallets were quiet.
- Each roster entry records performance failure independently from holdings failure. The single roster-wide label uses the oldest successful performance or holdings check across the roster. Partial and total failures are explicit. A successful wallet cannot make the rest of the roster appear current. Existing values remain visible after failed requests; successful recovery clears the failure flags.
- Failed polling outside the normal settled-request path also records failure. Poll throttling still uses attempt time so failures cannot trigger a rapid request loop.
- Status survives reload. Persistence is version 6. Version-5 signals, roster values, and preferences are preserved; signals from older schemas retain their prior migration behavior. Legacy attempt timestamps are not treated as successful trades-fetch timestamps; a new check is requested.
- Longer freshness messages can wrap beside Refresh on mobile.

The baseline is now “Stats At Discovery,” with “at discovery” under its metrics. Supporting copy explains that the snapshot was captured when the wallet was added to the swipe deck. Greatest Hits uses the same discovery wording. The Swipe activity badge says “ACTIVE IN 24H BEFORE DISCOVERY.” Since-match performance queries and metrics remain since-match measurements. No extra API calls or newly invented observation timestamps were added.

Validation: 37 unit tests pass, including six new cases covering persisted total failure, mixed-age roster data, partial holdings failure, recovery, empty successful feeds, legacy timestamps, and discovery labels. Formatting/TypeScript and production build pass. All three browser suites pass, with added fixture checks for partial context, total refresh failure, retained signals, recovery, discovery copy, and mobile overflow. No live API credits were needed. Screenshot: `artifacts/signals-failed-refresh.png`.

Audit findings 4 (holdings reconciliation), 8 (sales-count wording), and 9 (hosted proxy protection) remain unchanged.
