# Smart Crush — Session Handoff

## What this is

Smart Crush is a "Smart Money Tinder" — a dating-app-themed mobile web app that lets users browse smart money wallets on Robinhood chain (via Nansen API), swipe right to curate a roster, and monitor their trades as signals. Built by ChatGPT Codex from a spec Claude wrote, then reviewed and deployment-prepped by Claude.

## Where everything lives

- **Source code**: on the user's Mac at `~/Desktop/Nansen Smart Money/`
- **Build spec (original prompt to Codex)**: `claude/CODEX_BUILD_PROMPT.md` in the Claude project
- **Code review doc**: https://claude.ai/code/artifact/38f3f46d-02eb-4fc4-80df-0bd55d259692
- **This handoff**: `handoffs/03-deployment-and-review-handoff.md`

## Tech stack

React 19 + TypeScript + Vite + Zustand + Framer Motion. Fixed 390px mobile frame centered on desktop with dark `#121212` background. No backend — client-side with a server-side proxy for API key security.

## Current state

### What's done

1. **Full three-screen app** — Scout (Tinder swipe deck), Roster (curated wallets), Signals (trade feed)
2. **Nansen API integration** — discovery via dex-trades, PnL summary/detail, holdings, signal polling
3. **Demo mode** — 60 fictional wallets for testing without an API key
4. **Deployment proxy infrastructure** — written and committed to the project folder:
   - `api/nansen/[...path].ts` — Vercel serverless catch-all proxy (injects `NANSEN_API_KEY` server-side)
   - `vercel.json` — framework config + SPA rewrite
   - `vite.config.ts` — updated: `VITE_NANSEN_PROXY` is true during production builds, dev proxy uses `backend/.env`
   - `src/services/nansen.ts` — updated: removed `VITE_NANSEN_API_KEY` path (key never bakes into bundle), renamed proxy flag
   - `package.json` — added `@vercel/node` devDependency
   - `.gitignore` — added `.vercel/`, `backend/.env`
   - `DEPLOY.md` — deployment guide
5. **Code review completed** — 8-section review doc covering verdict, spec compliance, handoff assessment, code quality, data accuracy, UX/visual design, security/deployment, and prioritized next steps

### What's NOT done

1. **Hosting platform choice is OPEN** — the proxy files currently target Vercel, but the user doesn't want Vercel. Alternatives discussed: Cloudflare Pages + Workers (recommended), Netlify, Railway, Render. The user also mentioned a "new members grading dashboard" they hosted somewhere before — check if they remember where. **Ask the user which platform they want and rewrite the proxy accordingly.** The frontend stays identical — only the serverless function file and deploy config change.

2. **GitHub repo not yet created** — code hasn't been pushed yet.

3. **`npm install` not yet run** — needed to pick up `@vercel/node` (or whatever replaces it for the chosen platform).

### Code review findings (prioritized)

From the completed review doc (link above). Item #1 is DONE (proxy written). Remaining:

1. ~~Production proxy~~ — **DONE** (but platform TBD, see above)
2. **Fix QUOTE_SYMBOLS filtering** — currently hides ETH/WBTC trades users would want to see. Remove WETH/ETH/WBTC/BTC from the filter, or filter by quote side of the swap pair instead.
3. **Bump font sizes** — multiple CSS rules use 6–9px. Minimum should be 10–11px.
4. **Surface retry delays** — show a toast when waiting on Retry-After so it doesn't look like a hang.
5. **Rename `seenTxHashes`** → `seenSignalIds` (it stores composite keys, not tx hashes).
6. **Handle $0 trade values** — show "unknown" instead of $0 when `trade_value_usd` is missing.
7. **Add localStorage schema versioning** — version field so future changes can migrate cleanly.
8. **Roster loading skeleton** — add shimmer placeholders matching scout deck's loading treatment.
9. **Extract App.tsx hooks** — pull polling and mode-switching into custom hooks (544 lines currently).
10. **v2 considerations** — premium polling (15m), auto-copy execution, multi-user auth.

## Architecture

```
Browser  →  /api/nansen/*  →  Serverless Function  →  api.nansen.ai
                                    ↑
                              NANSEN_API_KEY
                           (platform env variable)
```

**Dual key flow:**
- User enters own key → sent as `apikey` header → proxy forwards it
- User clicks "Use project API key" → no header → proxy injects server-side key
- Rate-limit `Retry-After` headers forwarded back to client

**Build-time flag:** `VITE_NANSEN_PROXY` is `true` during `vite build` (production) and when `backend/.env` has a key (dev). Controls whether frontend hits `/api/nansen/...` (proxied) or `https://api.nansen.ai` directly (CORS-blocked).

## Key files (`~/Desktop/Nansen Smart Money/`)

```
api/nansen/[...path].ts    — Vercel proxy (needs rewrite for chosen platform)
src/
├── App.tsx                 — 544-line main orchestrator (tabs, connection, modals, polling)
├── services/nansen.ts      — API layer: queue, retry, rate limiting, all endpoints
├── components/
│   ├── Connection.tsx      — onboarding + API key entry
│   ├── SwipeDeck.tsx       — Framer Motion card stack + swipe physics
│   ├── RosterList.tsx      — roster management + break-up flow
│   ├── SignalsFeed.tsx     — trade signal feed + polling
│   └── ... (other components)
├── store/useAppStore.ts    — Zustand store (persists to localStorage)
├── types/index.ts          — TypeScript interfaces
├── utils/constants.ts      — CHAIN="robinhood", DECK_SIZE=20, ROSTER_LIMIT=10, etc.
vite.config.ts              — proxy config + build flags
vercel.json                 — SPA rewrite (platform-specific, may need replacing)
DEPLOY.md                   — deployment guide (currently Vercel-targeted)
package.json                — dependencies
handoffs/                   — all handoff docs from each build phase
```

## Nansen API endpoints used

All POST requests to `https://api.nansen.ai`, authed via `apikey` header:

| Endpoint | Purpose |
|----------|---------|
| `/api/v1/smart-money/dex-trades` | Discover smart wallets + monitor roster trades (24h window) |
| `/api/v1/profiler/address/pnl-summary` | Wallet headline stats (win rate, PnL, token count) |
| `/api/v1/profiler/address/pnl` | Trophy case (realized, top ROI) + holdings (unrealized) |

**API quirks Codex discovered:**
- PnL endpoints require explicit `date: {from, to}` — not optional
- ROI is a ratio, not percentage: `1 + roi_percent_realised` = display multiple
- Per-wallet holdings use PnL Detail with `show_realized: false`, not the aggregate Holdings endpoint
- CORS blocks direct browser→Nansen calls — proxy is mandatory
- Chain identifier is `"robinhood"` (Robinhood is an Arbitrum L2)

## Workflow context

The user's workflow: Claude writes specs and reviews, Codex builds. For code changes, write a clear prompt for Codex or make the changes directly on the user's machine. The user prefers directness and decisive recommendations over hedged responses.
