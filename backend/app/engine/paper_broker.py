from uuid import uuid4

from .classify import classify_lane
from .models import Cat, Classification, Context, Position, Print, State


def open_position(state: State, p: Print, cat: Cat, c: Context, classification: Classification,
                  now: str, *, automatic: bool = False) -> Position:
    if any(f.get("source_print_id") == p.id and f["side"] == "buy" for f in state.fills):
        raise ValueError("This meal is already accounted for.")
    current = classify_lane(p, cat, c, state, now)
    if current.lane != classification.lane or current.lane == "ignore" or current.pending:
        raise ValueError(current.reasons[0])
    if abs(current.intended_usd - classification.intended_usd) > .01:
        raise ValueError("The nibble size changed. Check this meal again.")
    if cat.follow_mode == "watching" or current.intended_usd <= 0:
        raise ValueError("Watching cats do not eat. Choose nibble in their profile first.")
    if automatic and (current.lane != "kitchen" or not state.settings.auto_kitchen):
        raise ValueError("Forage always needs a deliberate Gamble.")
    assert c.price_usd and c.price_usd > 0
    amount = current.intended_usd
    position = Position(str(uuid4()), current.lane, p.token_address, p.token_symbol,
                        amount / c.price_usd, amount, now, p.id, cat.id,
                        sector=c.sector, last_price=c.price_usd, price_updated_at=c.price_updated_at,
                        source_balance=c.guide_balance, source_observed_at=p.observed_at,
                        cat_still_holding=c.hold_confirmed)
    state.cash = round(state.cash - amount, 8)
    state.positions.append(position)
    state.fills.append({"id": str(uuid4()), "side": "buy", "lane": current.lane,
                        "position_id": position.id, "source_print_id": p.id,
                        "token_symbol": p.token_symbol, "qty": position.qty,
                        "price": c.price_usd, "usd": amount, "at": now,
                        "reason": "Kitchen served itself" if automatic else "Eat with them" if current.lane == "kitchen" else "Gamble",
                        "price_basis": "last polled screener price; no execution fee or slippage model"})
    return position


def close_position(state: State, position: Position, price: float, reason: str, now: str) -> None:
    if position not in state.positions:
        return
    if price <= 0:
        position.exit_pending = reason
        return
    proceeds = position.qty * price
    state.cash = round(state.cash + proceeds, 8)
    state.fills.append({"id": str(uuid4()), "side": "sell", "lane": position.lane,
                        "position_id": position.id, "source_print_id": position.source_print_id,
                        "token_symbol": position.token_symbol, "qty": position.qty,
                        "price": price, "usd": proceeds, "at": now, "reason": reason,
                        "price_basis": "last polled price", "price_updated_at": position.price_updated_at})
    state.positions.remove(position)
    for event in state.events:
        if event["id"] == position.source_print_id and event.get("status") == "eaten":
            event["status"] = "closed"


def lock_position(position: Position) -> None:
    # Explicit override can take Forage above its cap. Future entries remain blocked.
    position.lane = "forage"
    position.locked_by_user = True


class LiveSwapExecutor:
    def execute(self, *_args, **_kwargs):
        raise NotImplementedError("Copycats v1 has a stuffed practice backpack only.")
