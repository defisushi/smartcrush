# Prompt 01 — Backend Scaffold + Nansen API Client

## Context

You are building a local smart money flow dashboard powered by the Nansen API. This is Prompt 01 of a multi-phase build. Your job is to produce a working Python backend with a complete Nansen API client, a FastAPI server, and a SQLite persistence layer. No frontend yet — that comes in later prompts.

The project folder is `Nansen Smart Money/` on the user's Desktop. All backend code goes under `Nansen Smart Money/backend/`.

## Scope — What You're Tracking

This dashboard tracks smart money flows for a **fixed, narrow universe**:

### Large-cap tokens (spot + on-chain flows):
| Token | Chain(s) | Notes |
|-------|----------|-------|
| BTC | `bitcoin` | Native; Nansen has bitcoin chain support from Jul 2015 |
| ETH | `ethereum` | Native; also track as ERC-20 where needed (WETH) |
| SOL | `solana` | Native |
| HYPE | `hyperevm`, `hyperliquid` | HyperEVM for on-chain; Hyperliquid for perps (uses `token_symbol` not address) |
| UNI | `ethereum` | ERC-20: `0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984` |

### Meme ecosystem:
| Scope | Chain | Notes |
|-------|-------|-------|
| Recently launched meme tokens | `robinhood` | Robinhood Chain (supported since Apr 2026). Use the token screener to discover trending memes dynamically — do NOT hardcode specific meme token addresses. Filter by `token_age_days` (max 90), sort by volume/trader count. |

## Nansen API Reference

**Base URL:** `https://api.nansen.ai`  
**Auth:** Header `apikey: <key>`  
**Method:** ALL endpoints are `POST` with JSON body  
**Credits:** 1-5 per call for most endpoints; 25 for historical/backtesting  

### Endpoints to Implement

Build a Python client class `NansenClient` with async methods for every endpoint below. Group them logically.

#### Smart Money (5 credits each)
| Method Name | Path | Purpose |
|-------------|------|---------|
| `get_smart_money_netflow` | `/api/v1/smart-money/netflow` | Net flows by token across chains |
| `get_smart_money_dex_trades` | `/api/v1/smart-money/dex-trades` | 24h DEX trades by smart money |
| `get_smart_money_holdings` | `/api/v1/smart-money/holdings` | Current aggregated holdings |
| `get_smart_money_historical_holdings` | `/api/v1/smart-money/historical-holdings` | Historical balance snapshots |

#### Token God Mode (1-5 credits each)
| Method Name | Path | Purpose |
|-------------|------|---------|
| `get_token_screener` | `/api/v1/tgm/token-screener` | Discover tokens — used for Robinhood memes |
| `get_flow_intelligence` | `/api/v1/tgm/flow-intelligence` | Multi-wallet flow summary by cohort |
| `get_token_flows` | `/api/v1/tgm/flows` | In/outflow by label (smart_money, whale, exchange) |
| `get_token_holders` | `/api/v1/tgm/holders` | Top holders with balance changes |
| `get_who_bought_sold` | `/api/v1/tgm/who-bought-sold` | Recent buyers/sellers |
| `get_token_dex_trades` | `/api/v1/tgm/dex-trades` | DEX trades for a token |
| `get_token_information` | `/api/v1/tgm/token-information` | Market cap, price, metadata |
| `get_token_indicators` | `/api/v1/tgm/indicators` | Risk/reward metrics |
| `get_token_ohlcv` | `/api/v1/tgm/token-ohlcv` | OHLCV price data |

#### Profiler (1-5 credits each)
| Method Name | Path | Purpose |
|-------------|------|---------|
| `get_address_balance` | `/api/v1/profiler/address/current-balance` | Wallet holdings |
| `get_address_historical_balances` | `/api/v1/profiler/address/historical-balances` | Historical holdings |
| `get_address_pnl_summary` | `/api/v1/profiler/address/pnl-summary` | Win rate, realized/unrealized PnL |
| `get_address_pnl` | `/api/v1/profiler/address/pnl` | Trade-level PnL history |
| `get_address_dex_trades` | `/api/v1/profiler/dex-trades` | All DEX trades for a wallet |
| `get_address_related_wallets` | `/api/v1/profiler/address/related-wallets` | Cluster detection |
| `get_address_counterparties` | `/api/v1/profiler/address/counterparties` | Who they trade with |
| `get_address_labels` | `/api/v1/profiler/address/labels` | Nansen labels on wallet |

#### Hyperliquid-Specific (perps)
| Method Name | Path | Purpose |
|-------------|------|---------|
| `get_perp_screener` | `/api/v1/tgm/perp-screener` | Hyperliquid token discovery |
| `get_perp_positions` | `/api/v1/tgm/perp-positions` | Open positions for a token |
| `get_perp_trades` | `/api/v1/tgm/perp-trades` | Trade history for a token |
| `get_smart_money_perp_trades` | `/api/v1/smart-money/perp-trades` | Smart money Hyperliquid activity |
| `get_perp_leaderboard` | `/api/v1/perp-leaderboard` | Top Hyperliquid traders |
| `get_address_perp_positions` | `/api/v1/profiler/perp-positions` | Wallet's open perp positions |
| `get_address_perp_trades` | `/api/v1/profiler/perp-trades` | Wallet's perp trade history |

#### Backtesting / Historical (5-25 credits each)
| Method Name | Path | Purpose |
|-------------|------|---------|
| `get_historical_who_bought_sold` | `/api/v1beta1/tgm/historical-who-bought-sold` | Point-in-time buyers/sellers |
| `get_historical_flow_summary` | `/api/v1beta1/tgm/historical-token-flow-summary` | Point-in-time flow summary |
| `get_historical_top_holders` | `/api/v1beta1/tgm/historical-top-holders` | Point-in-time holder snapshot |
| `get_historical_token_screener` | `/api/v1beta1/token-screener/historical` | Point-in-time screener |
| `get_historical_smart_money_balances` | `/api/v1beta1/smart-money/historical-token-balances` | Point-in-time SM balances |

### Common Request Patterns

**Smart Money Labels** (use in `filters.include_smart_money_labels`):
`"Fund"`, `"Smart Trader"`, `"30D Smart Trader"`, `"90D Smart Trader"`, `"180D Smart Trader"`, `"Smart HL Perps Trader"`

**Pagination:** `{"page": 1, "per_page": 100}` — max 1000 per page

**Ordering:** `[{"field": "net_flow_24h_usd", "direction": "DESC"}]`

**Chain values:** `"bitcoin"`, `"ethereum"`, `"solana"`, `"hyperevm"`, `"hyperliquid"`, `"robinhood"`, or `"all"`

**Hyperliquid difference:** Perp endpoints use `token_symbol: "BTC"` instead of `token_address`.

## What to Build

### 1. Project structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app with lifespan
│   ├── config.py             # Pydantic Settings (reads .env)
│   ├── nansen_client.py      # NansenClient class — all API methods
│   ├── models.py             # Pydantic models for requests/responses
│   ├── db.py                 # SQLite setup via aiosqlite
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── smart_money.py    # /api/smart-money/* proxy routes
│   │   ├── token.py          # /api/token/* routes
│   │   ├── profiler.py       # /api/profiler/* routes
│   │   └── screener.py       # /api/screener/* routes
│   └── services/
│       ├── __init__.py
│       └── token_registry.py # Maps token symbols to chain+address
├── requirements.txt
├── .env.example
└── README.md
```

### 2. `config.py`
- Use `pydantic-settings` to load from `.env`
- Fields: `NANSEN_API_KEY`, `NANSEN_BASE_URL` (default `https://api.nansen.ai`), `DB_PATH` (default `./data/nansen.db`), `POLL_INTERVAL_MINUTES` (default 60), `MEME_POLL_INTERVAL_MINUTES` (default 240)

### 3. `nansen_client.py`
- Async class using `httpx.AsyncClient`
- Constructor takes `api_key` and `base_url`
- Every endpoint method accepts typed kwargs and returns parsed JSON
- Built-in retry with exponential backoff (3 attempts) for 429/5xx
- Request logging (log endpoint, credit cost, response time)
- A `_post(path, payload)` base method that handles auth header, error parsing, retries

### 4. `token_registry.py`
- A `TOKEN_UNIVERSE` dict mapping symbol → metadata:
```python
TOKEN_UNIVERSE = {
    "BTC": {"chains": ["bitcoin"], "addresses": {}, "type": "native"},
    "ETH": {"chains": ["ethereum"], "addresses": {}, "type": "native"},
    "SOL": {"chains": ["solana"], "addresses": {}, "type": "native"},
    "HYPE": {"chains": ["hyperevm", "hyperliquid"], "addresses": {}, "type": "native"},
    "UNI": {"chains": ["ethereum"], "addresses": {"ethereum": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"}, "type": "erc20"},
}
```
- A helper `get_robinhood_memes()` that calls the token screener with `chains=["robinhood"]`, `token_age_days.max=90`, sorted by volume DESC, and returns the top 20

### 5. `db.py`
- SQLite via aiosqlite
- Tables:
  - `netflow_snapshots` — periodic snapshots of smart money netflow data (token, chain, net_flow_1h/24h/7d/30d, trader_count, market_cap, timestamp)
  - `screener_snapshots` — periodic token screener results for Robinhood memes
  - `api_call_log` — track credit usage (endpoint, credits, timestamp, response_ms)
- Auto-create tables on startup

### 6. FastAPI Routers
These are thin proxy routes that call `NansenClient` methods and return the data. The frontend will call these instead of Nansen directly.

**`/api/smart-money/netflow`** — POST, accepts chain/label filters, returns netflow table  
**`/api/smart-money/dex-trades`** — POST, returns recent SM DEX trades  
**`/api/token/{chain}/{address}/info`** — GET, returns token info  
**`/api/token/{chain}/{address}/flows`** — POST, returns flows by label  
**`/api/token/{chain}/{address}/holders`** — POST, returns holder table  
**`/api/screener/robinhood-memes`** — GET, returns current trending Robinhood memes  
**`/api/profiler/{address}/summary`** — GET, returns wallet PnL summary  
**`/api/profiler/{address}/trades`** — POST, returns DEX trade history  
**`/api/health`** — GET, returns API key validity + credit balance if available  

### 7. `.env.example`
```
NANSEN_API_KEY=your_key_here
NANSEN_BASE_URL=https://api.nansen.ai
DB_PATH=./data/nansen.db
POLL_INTERVAL_MINUTES=60
MEME_POLL_INTERVAL_MINUTES=240
```

### 8. `requirements.txt`
```
fastapi>=0.110
uvicorn[standard]>=0.29
httpx>=0.27
pydantic>=2.7
pydantic-settings>=2.2
aiosqlite>=0.20
python-dotenv>=1.0
```

## Acceptance Criteria

When done, I should be able to:
1. `cp .env.example .env` → fill in my API key
2. `pip install -r requirements.txt`
3. `uvicorn app.main:app --reload`
4. Hit `http://localhost:8000/api/health` and get a 200
5. Hit `http://localhost:8000/api/smart-money/netflow` with a POST body `{"chains": ["ethereum"]}` and get real Nansen data back
6. Hit `http://localhost:8000/api/screener/robinhood-memes` and get trending Robinhood chain memes
7. See the SQLite DB created at `./data/nansen.db` with the tables above

## Handoff

When you're done, write `handoffs/01-backend-scaffold-handoff.md` with:
- What you built (file list with one-line descriptions)
- Any decisions you made that weren't specified here
- Anything that didn't work or you're unsure about
- The exact commands to start and test the server
