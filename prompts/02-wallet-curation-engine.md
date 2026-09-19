# Prompt 02 — Robinhood Meme Wallet Curation Engine

## Context

This is Prompt 02. Prompt 01 built the backend scaffold: FastAPI server, `NansenClient` (async Nansen API wrapper), SQLite via aiosqlite, and a config layer reading from `.env`. All of that is under `backend/app/`. Read the code from Prompt 01 before building — don't duplicate or overwrite what's already there. Extend it.

You are building a wallet curation engine that identifies and monitors elite meme traders on the Robinhood chain. This is the core alpha-generation module of the dashboard.

## What This Module Does

### Step 1 — Daily Discovery Scan

Every 24 hours, scan Robinhood chain meme tokens to find wallets that have **realized** 20x+ returns on at least 5 separate memecoins. These wallets get added to a **Watchlist**.

**How it works:**

1. Call `POST /api/v1/tgm/token-screener` with:
   ```json
   {
     "chains": ["robinhood"],
     "filters": {
       "token_age_days": {"max": 90}
     },
     "pagination": {"page": 1, "per_page": 200},
     "order_by": [{"field": "volume", "direction": "DESC"}]
   }
   ```
   This gives you the universe of recent Robinhood meme tokens.

2. For each token returned, call `POST /api/v1/tgm/pnl-leaderboard` with:
   ```json
   {
     "chain": "robinhood",
     "token_address": "<address from screener>",
     "date": {"from": "<90 days ago>", "to": "<today>"},
     "pagination": {"page": 1, "per_page": 100},
     "filters": {
       "pnl_usd_realised": {"min": 1000}
     }
   }
   ```
   This returns the top traders by realized PnL for each meme token.

3. From the leaderboard results, identify wallets where the **realized return multiple is 20x or greater**. The return multiple is calculated as:
   ```
   return_multiple = (pnl_usd_realised + total_cost) / total_cost
   ```
   where `total_cost` is the USD value they spent acquiring the token. If the API returns fields named differently, adapt accordingly — the key metric is **realized return as a multiple of cost basis, >= 20x**.

4. Aggregate across all tokens: count how many distinct meme tokens each wallet achieved 20x+ realized returns on.

5. **Tier assignment:**
   - **Watchlist (Tier 1):** Wallet has 20x+ realized returns on **5 or more** distinct Robinhood meme tokens
   - **Elite (Tier 2):** Wallet has 20x+ realized returns on **10 or more** distinct Robinhood meme tokens
   - **Legendary (Tier 3):** 15 or more (extend the pattern — every 5 additional qualifying plays is a new tier)

6. Store/update the wallet in the database. Never remove a wallet from a tier — tiers only go up.

### Step 2 — 4-Hourly Wallet Monitoring

Every 4 hours, check what the curated wallets are doing right now.

**How it works:**

1. Load all wallets from the Watchlist/Elite/Legendary tiers.

2. For each wallet, call `POST /api/v1/profiler/dex-trades` with:
   ```json
   {
     "address": "<wallet_address>",
     "chains": ["robinhood"],
     "pagination": {"page": 1, "per_page": 50},
     "order_by": [{"field": "timestamp", "direction": "DESC"}]
   }
   ```

3. Compare against the last known trades stored in SQLite. Any **new token that wasn't in their previous trade history** is flagged as a "new entry" — this is the signal.

4. Store the new trades and the alert in the database.

5. New entries are surfaced via API endpoint (and later via Telegram — not in this prompt).

## Database Tables

Add these tables to the existing `db.py` setup. Do NOT replace existing tables — add alongside them.

### `curated_wallets`
| Column | Type | Description |
|--------|------|-------------|
| address | TEXT PRIMARY KEY | Wallet address |
| tier | INTEGER NOT NULL | 1 = Watchlist, 2 = Elite, 3 = Legendary, etc. |
| qualifying_plays | INTEGER NOT NULL | Total count of 20x+ meme trades |
| first_seen | TEXT NOT NULL | ISO timestamp when first added |
| last_updated | TEXT NOT NULL | ISO timestamp of last tier check |
| labels | TEXT | JSON array of Nansen labels if available |
| notes | TEXT | Optional manual notes |

### `qualifying_trades`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | |
| wallet_address | TEXT NOT NULL | FK to curated_wallets |
| token_address | TEXT NOT NULL | The meme token |
| token_symbol | TEXT | |
| chain | TEXT NOT NULL | Always "robinhood" for now |
| return_multiple | REAL NOT NULL | e.g. 25.3 for a 25.3x |
| pnl_usd_realised | REAL | Realized USD profit |
| cost_basis_usd | REAL | What they spent |
| discovered_at | TEXT NOT NULL | When our scan found this |
| UNIQUE(wallet_address, token_address) | | Prevent double-counting |

### `wallet_activity`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | |
| wallet_address | TEXT NOT NULL | FK to curated_wallets |
| token_address | TEXT NOT NULL | |
| token_symbol | TEXT | |
| chain | TEXT NOT NULL | |
| action | TEXT NOT NULL | "buy" or "sell" |
| value_usd | REAL | Trade value |
| timestamp | TEXT NOT NULL | Trade timestamp from Nansen |
| detected_at | TEXT NOT NULL | When our monitor found it |
| is_new_entry | BOOLEAN DEFAULT FALSE | TRUE if this is a new token for this wallet |
| notified | BOOLEAN DEFAULT FALSE | For future Telegram integration |

## New Files to Create

### `backend/app/services/wallet_curation.py`
The core engine. Contains:

- `async def run_discovery_scan(client: NansenClient, db) -> dict`
  - Runs the full daily scan described in Step 1
  - Returns a summary: `{"wallets_found": N, "new_additions": N, "promotions": [...]}`

- `async def run_wallet_monitor(client: NansenClient, db) -> dict`
  - Runs the 4-hourly check described in Step 2
  - Returns: `{"wallets_checked": N, "new_entries": [{"wallet": "0x...", "tier": 2, "token": "CASHCAT", "value_usd": 5000}, ...]}`

- `async def get_wallet_tier(db, address: str) -> dict`
  - Returns full wallet profile: tier, qualifying plays, trade list, recent activity

- `async def get_new_entries(db, since_hours: int = 4) -> list`
  - Returns all new token entries detected in the last N hours, sorted by wallet tier (Elite first)

### `backend/app/routers/wallets.py`
New router — add to the FastAPI app in `main.py`.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/wallets/curated` | GET | List all curated wallets with tier, qualifying play count. Query params: `tier` (filter), `sort_by` (qualifying_plays, first_seen) |
| `/api/wallets/{address}` | GET | Full wallet profile — tier, all qualifying trades, recent activity |
| `/api/wallets/{address}/trades` | GET | Recent trades for a curated wallet on Robinhood chain |
| `/api/wallets/new-entries` | GET | New token entries from monitored wallets. Query param: `hours` (default 4) |
| `/api/wallets/scan/trigger` | POST | Manually trigger the discovery scan (for testing) |
| `/api/wallets/monitor/trigger` | POST | Manually trigger the wallet monitor (for testing) |

### Scheduler Integration

Add two new scheduled jobs to the existing APScheduler setup from Prompt 01:

- **Discovery scan:** Runs once daily at 00:00 UTC
- **Wallet monitor:** Runs every 4 hours (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)

Both jobs should:
- Log start/end time and summary to the console
- Handle errors gracefully (log and continue, don't crash the server)
- Store run metadata in a `scan_runs` table (run_type, started_at, finished_at, status, summary_json)

## Credit Budget

- Daily discovery: ~200 tokens × 5 credits each for PnL leaderboard = ~1,000 credits/day (this is the expensive part)
- 4-hourly monitor: depends on wallet count. At 30 wallets × 1 credit × 6 times/day = 180 credits/day
- Total: ~1,180 credits/day = ~35,400/month

**Important optimisation:** The daily discovery scan should paginate through the token screener but **stop early** if it has already processed tokens with near-zero volume. Sort by volume DESC and stop when volume drops below $10,000 — most of the long tail won't have meaningful leaderboard data anyway. This could easily cut the scan from 200 tokens to 30-50, saving ~750 credits/day.

## Acceptance Criteria

When done, I should be able to:
1. Start the server with `uvicorn app.main:app --reload`
2. `POST /api/wallets/scan/trigger` — runs the discovery scan, returns summary
3. `GET /api/wallets/curated` — see the curated wallet list with tiers
4. `GET /api/wallets/{address}` — see a wallet's qualifying trades and tier
5. `POST /api/wallets/monitor/trigger` — runs the monitor, returns new entries
6. `GET /api/wallets/new-entries` — see recent new token buys from curated wallets
7. The scheduler runs discovery daily and monitor every 4 hours automatically

## Handoff

When done, write `handoffs/02-wallet-curation-handoff.md` with:
- What you built (file list with one-line descriptions)
- How many wallets the first discovery scan found (if you tested it)
- Any decisions you made about PnL calculation or return multiple logic
- Any API response fields that didn't match what this prompt assumed
- The exact commands to test each endpoint
