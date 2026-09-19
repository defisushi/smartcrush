import json
from dataclasses import asdict
from pathlib import Path

import aiosqlite

from app.engine.models import Cat, Position, State
from app.engine.policy import Settings


class GameStore:
    """Single-writer aggregate commits cash, positions, events and fills atomically.

    Mock and live-read accounts are separate rows. API cache and wallet registry
    survive restart. Existing dashboard tables are never dropped or overwritten.
    """

    def __init__(self, path: str | Path):
        self.path = str(path)

    async def initialize(self):
        async with aiosqlite.connect(self.path) as db:
            await db.executescript("""
                CREATE TABLE IF NOT EXISTS copycats_state (
                    mode TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS copycats_seen_wallets (
                    mode TEXT NOT NULL, address TEXT NOT NULL, payload TEXT NOT NULL,
                    PRIMARY KEY(mode, address));
                CREATE TABLE IF NOT EXISTS copycats_cache (
                    key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS copycats_archives (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT NOT NULL,
                    archived_at TEXT NOT NULL, payload TEXT NOT NULL);
            """)
            await db.commit()

    async def load(self, mode: str) -> State | None:
        async with aiosqlite.connect(self.path) as db:
            row = await (await db.execute("SELECT payload FROM copycats_state WHERE mode=?", (mode,))).fetchone()
        if not row:
            return None
        data = json.loads(row[0])
        data["settings"] = Settings(**data["settings"])
        data["cats"] = [Cat(**c) for c in data["cats"]]
        data["positions"] = [Position(**p) for p in data["positions"]]
        return State(**data)

    async def save(self, mode: str, state: State):
        async with aiosqlite.connect(self.path) as db:
            await db.execute("BEGIN IMMEDIATE")
            await db.execute("INSERT OR REPLACE INTO copycats_state VALUES (?, ?)",
                             (mode, json.dumps(asdict(state), allow_nan=False)))
            await db.executemany("INSERT OR REPLACE INTO copycats_seen_wallets VALUES (?, ?, ?)",
                                 [(mode, c.address, json.dumps(asdict(c))) for c in state.cats])
            await db.commit()

    async def cache_get(self, key: str):
        async with aiosqlite.connect(self.path) as db:
            row = await (await db.execute("SELECT payload, fetched FROM copycats_cache WHERE key=?", (key,))).fetchone()
        return (json.loads(row[0]), row[1]) if row else None

    async def archive(self, mode: str, state: State, now: str):
        async with aiosqlite.connect(self.path) as db:
            await db.execute("INSERT INTO copycats_archives(mode,archived_at,payload) VALUES (?,?,?)",
                             (mode, now, json.dumps(asdict(state), allow_nan=False)))
            await db.commit()

    async def cache_put(self, key: str, payload, fetched: float):
        async with aiosqlite.connect(self.path) as db:
            await db.execute("INSERT OR REPLACE INTO copycats_cache VALUES (?, ?, ?)", (key, json.dumps(payload), fetched))
            await db.commit()

    async def credits_hour(self) -> int:
        async with aiosqlite.connect(self.path) as db:
            row = await (await db.execute("SELECT COALESCE(SUM(credits),0) FROM api_call_log WHERE julianday(timestamp) >= julianday('now','-1 hour')")).fetchone()
        return int(row[0])
