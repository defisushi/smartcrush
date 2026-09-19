"""Entirely fictional Robinhood practice fixtures. No API calls, ever."""
import copy
import json
from datetime import timedelta
from pathlib import Path

from app.copycats_nansen import Cached
from app.engine.models import Cat, Context, State, moment, utcnow
from app.engine.policy import CHAIN

FIXTURES = Path(__file__).parent / "fixtures"


def fixture(name):
    return json.loads((FIXTURES / name).read_text())


def seed_cats(now):
    names = [("Miso", "90D Smart Trader"), ("Pip", "30D Smart Trader"),
             ("Mallow", "Fund"), ("Clover", "180D Smart Trader"),
             ("Nori", "Smart Trader"), ("Button", "30D Smart Trader"),
             ("Fig", "90D Smart Trader"), ("Pebble", "Fund")]
    cats = []
    for i, (name, label) in enumerate(names, 1):
        address = f"0x{0xca00 + i:040x}"
        cat = Cat(address, address, name, persona="owl" if label == "Fund" else "raccoon" if label.startswith("30D") else "fox",
                  labels=[label], adopted=i <= 2, win_rate_90d=[.68,.61,.72,.64,.66,.57,.70,.63][i-1],
                  realized_pnl_usd=18420 + i * 1125, traded_times=74+i*3, traded_token_count=16,
                  top_tokens=["LEAF", "FERN", "ACORN"], top_token_profit_share=.40,
                  last_scored_at=now, last_seen_at=now, relations_checked=True)
        if i == 7:
            cat.related_addresses = [f"0x{0xca01:040x}"]
        cats.append(cat)
    return cats


class MockReader:
    def __init__(self, state: State):
        self.state = state
        self.fog = None

    async def dex(self, page=1, *, filter_labels=None, trader_addresses=None):
        raw = fixture("dex-trades.json")
        anchor = moment(self.state.scenario_started_at)
        for row in raw["data"]:
            offset = moment(row["block_timestamp"]) - moment("2026-09-18T01:00:00+00:00")
            row["block_timestamp"] = (anchor + offset).isoformat()
        # Repeated tiny crumbs prove that most prints stay quiet; raw records use
        # the same documented schema as the live reader.
        dust = next(r for r in raw["data"] if r["transaction_hash"] == "mock-dust")
        for i in range(7):
            clone = copy.deepcopy(dust)
            clone["transaction_hash"] = f"mock-dust-{i}"
            raw["data"].append(clone)
        return Cached(raw, utcnow())

    async def score(self, cat, now):
        cat.last_scored_at = now

    async def relations(self, cat):
        cat.relations_checked = True

    async def token(self, token, *, enrich=True):
        row = next((r for r in fixture("screener.json")["data"] if r["token_address"] == token), {})
        age = row.get("token_age_days")
        if age == 0 and row.get("token_age_hours"):
            age = row["token_age_hours"] / 24
        c = Context(price_usd=row.get("price_usd"), price_updated_at=utcnow(),
                    token_age_days=age, market_cap_usd=row.get("market_cap_usd"),
                    liquidity_usd=row.get("liquidity"), sector="meme" if token.endswith(("f002","f005")) else "other",
                    spam=not row)
        if enrich:
            key = "calm" if token.endswith("f001") else "storm" if token.endswith("f004") else "forage"
            flow = fixture("flow.json")[key]["data"][0]
            for field in Context.__dataclass_fields__:
                if field in flow:
                    setattr(c, field, flow[field])
        return c

    async def buyers(self, token, now):
        return (4, 1) if token.endswith("f001") else (1, 2)

    async def balance(self, cat, token, *, confirmation=False):
        return (2000 if token.endswith("f001") else 5000), utcnow()
