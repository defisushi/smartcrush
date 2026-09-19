import json
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite


SCHEMA = """
CREATE TABLE IF NOT EXISTS netflow_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,
    chain TEXT NOT NULL,
    net_flow_1h REAL,
    net_flow_24h REAL,
    net_flow_7d REAL,
    net_flow_30d REAL,
    trader_count INTEGER,
    market_cap REAL,
    timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_netflow_token_time
    ON netflow_snapshots(token, chain, timestamp);

CREATE TABLE IF NOT EXISTS screener_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT,
    name TEXT,
    chain TEXT NOT NULL,
    token_address TEXT,
    volume_24h REAL,
    trader_count INTEGER,
    market_cap REAL,
    price REAL,
    token_age_days REAL,
    raw_json TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_screener_chain_time
    ON screener_snapshots(chain, timestamp);

CREATE TABLE IF NOT EXISTS api_call_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    credits INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    response_ms REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_calls_time
    ON api_call_log(timestamp);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _first(row: Mapping[str, Any], *keys: str) -> Any:
    for key in keys:
        value = row.get(key)
        if value is not None:
            return value
    return None


class Database:
    def __init__(self, path: str | Path):
        self.path = Path(path).expanduser()

    async def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.path) as connection:
            await connection.executescript(SCHEMA)
            await connection.execute("PRAGMA journal_mode=WAL")
            await connection.commit()

    async def log_api_call(
        self, endpoint: str, credits: int, response_ms: float
    ) -> None:
        async with aiosqlite.connect(self.path) as connection:
            await connection.execute(
                """
                INSERT INTO api_call_log(endpoint, credits, timestamp, response_ms)
                VALUES (?, ?, ?, ?)
                """,
                (endpoint, credits, _now(), response_ms),
            )
            await connection.commit()

    async def save_netflow_snapshots(
        self, rows: Sequence[Mapping[str, Any]]
    ) -> None:
        if not rows:
            return
        timestamp = _now()
        values = [
            (
                str(_first(row, "token_symbol", "symbol", "token") or "unknown"),
                str(_first(row, "chain", "blockchain") or "unknown"),
                _first(row, "net_flow_1h_usd", "net_flow_1h"),
                _first(row, "net_flow_24h_usd", "net_flow_24h"),
                _first(row, "net_flow_7d_usd", "net_flow_7d"),
                _first(row, "net_flow_30d_usd", "net_flow_30d"),
                _first(row, "trader_count", "smart_money_trader_count"),
                _first(row, "market_cap_usd", "market_cap"),
                timestamp,
            )
            for row in rows
        ]
        async with aiosqlite.connect(self.path) as connection:
            await connection.executemany(
                """
                INSERT INTO netflow_snapshots(
                    token, chain, net_flow_1h, net_flow_24h, net_flow_7d,
                    net_flow_30d, trader_count, market_cap, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                values,
            )
            await connection.commit()

    async def save_screener_snapshots(
        self, rows: Sequence[Mapping[str, Any]], chain: str = "robinhood"
    ) -> None:
        if not rows:
            return
        timestamp = _now()
        values = [
            (
                _first(row, "token_symbol", "symbol", "token"),
                _first(row, "token_name", "name"),
                str(_first(row, "chain", "blockchain") or chain),
                _first(row, "token_address", "address"),
                _first(row, "volume_24h_usd", "volume_24h", "volume"),
                _first(row, "trader_count", "traders_24h"),
                _first(row, "market_cap_usd", "market_cap"),
                _first(row, "price_usd", "price"),
                _first(row, "token_age_days", "age_days"),
                json.dumps(dict(row), default=str, separators=(",", ":")),
                timestamp,
            )
            for row in rows
        ]
        async with aiosqlite.connect(self.path) as connection:
            await connection.executemany(
                """
                INSERT INTO screener_snapshots(
                    token, name, chain, token_address, volume_24h,
                    trader_count, market_cap, price, token_age_days,
                    raw_json, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                values,
            )
            await connection.commit()

