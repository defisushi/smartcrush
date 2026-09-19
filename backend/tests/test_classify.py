import json
from dataclasses import replace
from pathlib import Path

import pytest

from app.engine.classify import classify_lane
from app.engine.models import Cat, Context, Print, Position, State
from app.engine.paper_broker import open_position, close_position, lock_position
from app.engine.policy import Settings

NOW = "2026-09-18T01:00:00+00:00"


def sample():
    cat = Cat("cat-1", "0xguide", "Miso", labels=["90D Smart Trader"], adopted=True,
              win_rate_90d=.68, realized_pnl_usd=4200, traded_times=45,
              traded_token_count=8, relations_checked=True, last_scored_at=NOW)
    p = Print("print-1", cat.id, "0xtoken", "LEAF", "2026-09-18T00:30:00+00:00",
              notional_usd=2000, price_usd_at_print=1, token_amount=2000)
    c = Context(price_usd=1.02, price_updated_at=NOW, token_age_days=120,
                market_cap_usd=5_000_000, liquidity_usd=200_000,
                smart_trader_net_flow_usd=100_000, smart_trader_wallet_count=3,
                top_pnl_net_flow_usd=20_000, whale_net_flow_usd=0,
                exchange_net_flow_usd=0, fresh_wallets_net_flow_usd=10_000,
                unique_smart_buyers=3, unique_smart_sellers=1,
                hold_confirmed=True, hold_checked_at=NOW, guide_balance=2000)
    return cat, p, c, State(cats=[cat])


CASES = json.loads((Path(__file__).parents[1] / "app/fixtures/classifications.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_fixture_classification(case):
    cat, p, c, state = sample()
    cat = replace(cat, **case.get("cat", {}))
    p = replace(p, **case.get("print", {}))
    c = replace(c, **case.get("context", {}))
    result = classify_lane(p, cat, c, state, NOW)
    assert result.lane == case["expected"]
    if case["name"] == "unknown_price_move":
        assert any("stale print" in r.lower() for r in result.reasons)


def test_kitchen_waits_twenty_minutes_even_with_second_buyer():
    cat, p, c, state = sample()
    c = replace(c, hold_confirmed=None, independent_kitchen_buyers=2)
    result = classify_lane(p, cat, c, state, NOW)
    assert result.pending and result.lane == "kitchen"
    with pytest.raises(ValueError):
        open_position(state, p, cat, c, result, NOW)


def test_forage_budget_blocks_whole_nibble():
    cat, p, c, state = sample()
    state.settings.forage_budget = .02
    c.token_age_days = 1
    result = classify_lane(p, cat, c, state, NOW)
    assert result.lane == "ignore"
    assert "budget" in " ".join(result.reasons).lower()


def test_paper_ledger_idempotent_and_cash_conserved():
    cat, p, c, state = sample()
    r = classify_lane(p, cat, c, state, NOW)
    position = open_position(state, p, cat, c, r, NOW)
    assert state.cash == 9500 and position.cost_usd == 500
    with pytest.raises(ValueError):
        open_position(state, p, cat, c, r, NOW)
    close_position(state, position, 1.02, "Put back", NOW)
    assert state.cash == pytest.approx(10000)
    assert len(state.fills) == 2 and state.positions == []


def test_watching_cannot_fill_and_forage_cannot_auto_fill():
    cat, p, c, state = sample()
    cat.follow_mode = "watching"
    r = classify_lane(p, cat, c, state, NOW)
    with pytest.raises(ValueError):
        open_position(state, p, cat, c, r, NOW)
    cat.follow_mode = "clingy"
    c.token_age_days = 1
    r = classify_lane(p, cat, c, state, NOW)
    assert r.intended_usd == 250
    with pytest.raises(ValueError):
        open_position(state, p, cat, c, r, NOW, automatic=True)


def test_fill_revalidates_budget_after_another_entry():
    cat, p, c, state = sample()
    r = classify_lane(p, cat, c, state, NOW)
    state.cash = 10
    with pytest.raises(ValueError):
        open_position(state, p, cat, c, r, NOW)


def test_lock_recodes_to_forage_and_keeps_cash():
    cat, p, c, state = sample()
    pos = open_position(state, p, cat, c, classify_lane(p, cat, c, state, NOW), NOW)
    lock_position(pos)
    assert pos.locked_by_user and pos.lane == "forage" and state.cash == 9500

