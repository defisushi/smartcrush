# Prompt 01 handoff — backend scaffold and Nansen client

## What was built

- `backend/app/main.py` — FastAPI application, startup/shutdown lifecycle, health route, router registration, and Nansen error mapping.
- `backend/app/config.py` — environment-backed settings for the API key, base URL, SQLite path, and poll interval.
- `backend/app/models.py` — request, pagination, ordering, and health response models with forward-compatible extra fields.
- `backend/app/nansen_client.py` — async Nansen client covering all 32 requested endpoints, authentication, error parsing, three-attempt retry/backoff, timing, estimated credit logging, and response credit metadata.
- `backend/app/db.py` — asynchronous SQLite initialization and persistence for netflow snapshots, Robinhood screener snapshots, and API call metadata.
- `backend/app/services/token_registry.py` — the fixed BTC/ETH/SOL/HYPE/UNI registry and dynamic Robinhood token discovery.
- `backend/app/routers/smart_money.py` — smart-money netflow and DEX trade proxy routes; netflow responses are snapshotted.
- `backend/app/routers/token.py` — token information, flows, and holders proxy routes.
- `backend/app/routers/profiler.py` — wallet PnL summary and DEX trade proxy routes.
- `backend/app/routers/screener.py` — dynamic Robinhood-chain meme screener route; results are snapshotted.
- `backend/app/routers/helpers.py` — app dependency access and tolerant extraction of rows from Nansen response envelopes.
- `backend/.env.example` — environment template.
- `backend/requirements.txt` — runtime dependencies.
- `backend/requirements-dev.txt` — runtime dependencies plus pytest.
- `backend/README.md` — setup, run, endpoint check, and test instructions.
- `backend/tests/test_backend.py` — credit-free tests for client auth/payloads, database initialization/persistence, screener filters, and health startup.
- `frontend/dist/` — responsive five-asset smart-money dashboard, also served by FastAPI at the site root.

## Decisions made

- The health route never makes a Nansen call, so checking local service health cannot unexpectedly consume credits. API-key validity changes from `not_checked` to `valid` or `invalid` after a real proxied request.
- Credit balance is populated only if Nansen returns a recognized remaining-credit response header; otherwise it remains `null`.
- API credit costs are estimates based on the ranges in Prompt 01. Failed HTTP responses are logged with zero estimated credits.
- Request models allow additional fields. This avoids blocking newly added Nansen filters while retaining validation for pagination and order direction.
- Both response envelopes and raw lists are supported when writing snapshots because Nansen endpoints may wrap rows differently.
- No background polling loop was added. Prompt 01 specifies a poll interval setting and persistence schema, but not automatic polling behavior; scheduled ingestion can be added in a later phase without silently spending credits now.

## Uncertainties

- Exact Nansen credit charges can vary within the stated 1–5 and 5–25 ranges. The local log therefore records configured estimates, not authoritative billing.
- The prompt does not identify a dedicated credit-balance endpoint. The backend reads balance headers when present instead of inventing or calling an undocumented endpoint.
- A live API-key test was intentionally not run during the build, so no Nansen credits were consumed.

## Start the server

```bash
cd "/Users/lfgcap/Desktop/Nansen Smart Money/backend"
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set NANSEN_API_KEY.
uvicorn app.main:app --reload
```

## Test it

```bash
cd "/Users/lfgcap/Desktop/Nansen Smart Money/backend"
source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q
curl http://localhost:8000/api/health
curl -X POST http://localhost:8000/api/smart-money/netflow \
  -H 'content-type: application/json' \
  -d '{"chains":["ethereum"]}'
curl http://localhost:8000/api/screener/robinhood-memes
```
