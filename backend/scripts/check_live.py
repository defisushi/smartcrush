"""A single 5-credit Robinhood DEX read; no poller, trading or account changes.

Run from backend/: .venv/bin/python -m scripts.check_live
Prints coverage counts only. Raw response is persisted in the private API cache.
"""
import asyncio
import json

from app.config import get_settings
from app.copycats_nansen import NansenReader, SpotClient, map_trades
from app.db import Database
from app.game_store import GameStore
from app.nansen_client import NansenError


async def main():
    config = get_settings()
    if not config.NANSEN_API_KEY:
        print(json.dumps({"ok": False, "reason": "No server key configured"}))
        return
    db = Database(config.DB_PATH)
    await db.initialize()
    store = GameStore(db.path)
    await store.initialize()
    async with SpotClient(config.NANSEN_API_KEY, timeout=8, call_logger=db.log_api_call) as client:
        client.MAX_ATTEMPTS = 1
        reader = NansenReader(client, store)
        try:
            category = ["90D Smart Trader"]
            reply = await reader.dex(filter_labels=category)
            prints, guides = map_trades(reply.data, filter_labels=category)
            print(json.dumps({"ok": not reply.stale, "chain": "robinhood", "mapped_prints": len(prints),
                              "labeled_guides": len(guides), "cached_at": reply.fetched_at,
                              "stale": reply.stale, "credits_this_hour": await store.credits_hour()}))
        except NansenError as exc:
            print(json.dumps({"ok": False, "reason": str(exc)}))


if __name__ == "__main__":
    asyncio.run(main())
