from dataclasses import replace

import pytest

from app.engine.exits import exit_reason, handle_guide_exit
from app.engine.models import Context, Position, Print, State

NOW = "2026-09-18T12:00:00+00:00"


def position(**kwargs):
    return replace(Position("p", "kitchen", "0xt", "LEAF", 100, 100,
                            "2026-09-18T11:00:00+00:00", "print", "cat",
                            last_price=1, source_balance=1000), **kwargs)


@pytest.mark.parametrize("pos,ctx,word", [
    (position(), Context(guide_reduction_pct=40), "walked"),
    (position(), Context(guide_sold_flat=True), "walked"),
    (position(), Context(smart_trader_net_flow_usd=-1), "storm"),
    (position(), Context(smart_holders_down=True), "holders"),
    (position(opened_at="2026-09-01T00:00:00+00:00"), Context(), "time"),
    (position(last_price=.85), Context(), "loss"),
    (position(lane="forage", opened_at="2026-09-17T00:00:00+00:00"), Context(), "time"),
    (position(lane="forage", last_price=.90), Context(), "loss"),
    (position(lane="forage", last_price=1.10, peak_return_pct=26), Context(), "gave"),
    (position(lane="forage"), Context(guide_sold_any=True), "spat"),
    (position(lane="forage"), Context(smart_trader_net_flow_usd=100, fresh_wallets_net_flow_usd=60), "fresh"),
    (position(lane="forage"), Context(smart_trader_net_flow_usd=100, exchange_net_flow_usd=200), "exchanges"),
])
def test_exit_rules(pos, ctx, word):
    assert word in exit_reason(pos, ctx, NOW).lower()


def test_locked_position_only_keeps_forage_loss_stop():
    p = position(lane="forage", locked_by_user=True, opened_at="2026-08-01T00:00:00+00:00")
    assert exit_reason(p, Context(guide_sold_any=True, smart_trader_net_flow_usd=-1), NOW) is None
    p.last_price = .89
    assert "loss" in exit_reason(p, Context(), NOW)


def test_sell_immediately_exits_without_refresh_and_cancels_pending():
    pos = position()
    state = State(positions=[pos], cash=9900, pending=[{"print": {"cat_id":"cat","token_address":"0xt"}}])
    sell = Print("sell", "cat", "0xt", "LEAF", NOW, side="sell", token_amount=400)
    handle_guide_exit(state, sell, NOW)
    assert state.positions == [] and not state.pending
    assert state.cash == 10000


def test_separate_partial_sells_accumulate():
    pos = position()
    state = State(positions=[pos], cash=9900)
    for i in range(2):
        handle_guide_exit(state, Print(str(i), "cat", "0xt", "LEAF", NOW, side="sell", token_amount=200), NOW)
    assert not state.positions

