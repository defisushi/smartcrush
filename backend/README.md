# Copycats backend

See [the root README](../README.md) for setup, Robinhood scope, fixtures, live reads, policy details, and the credit warning.

Run locally from this folder:

```sh
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Mock mode is enabled by default. The existing `.env` is supported; root `.env.local` overrides it. The API key stays on the server.

```sh
.venv/bin/python -m pytest -q
```

The mounted API is now the Robinhood-only Copycats game. Legacy generic proxy modules remain on disk for reference but are not mounted. Existing SQLite snapshot tables are preserved.
