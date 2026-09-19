from .models import Cat, Context, Print, State, moment
from .policy import CHAIN, DENYLIST, POLICY


def equity(state: State) -> float:
    return state.cash + sum(p.qty * p.last_price for p in state.positions)


def intended_size(p: Print, cat: Cat, lane: str, state: State, *, gate=False) -> float:
    if cat.follow_mode == "watching" and not gate:
        return 0
    fraction = 1 if cat.follow_mode == "clingy" and lane == "kitchen" else .25
    cap = POLICY.kitchen_single if lane == "kitchen" else POLICY.forage_single
    guide_size = p.notional_usd if p.notional_usd is not None else POLICY.dust_usd
    return round(min(max(equity(state), 0) * cap, guide_size * fraction), 2)


def price_move(p: Print, c: Context) -> float | None:
    if c.price_usd is None or not p.price_usd_at_print or p.price_usd_at_print <= 0:
        return None
    return (c.price_usd / p.price_usd_at_print - 1) * 100


def storm(c: Context) -> bool:
    smart = c.smart_trader_net_flow_usd
    exchange = c.exchange_net_flow_usd
    return (smart is not None and smart < 0) or (
        smart is not None and exchange is not None and exchange > max(abs(smart), 0) * POLICY.exchange_flow_ratio
    )


def hard_gates(p: Print, cat: Cat, c: Context, state: State) -> list[str]:
    failures = []
    if p.chain != CHAIN or CHAIN not in cat.chain_hints:
        failures.append("Outside the Robinhood meadow.")
    if not p.is_dex_swap or p.side not in {"buy", "sell"}:
        failures.append("A transfer is not a meal.")
    if not cat.adopted or cat.status != "active":
        failures.append("This cat is resting, retired, or not in your crew.")
    if p.token_symbol.upper() in DENYLIST[CHAIN]:
        failures.append("Stablecoins and gas stay out of the food bowl.")
    if p.notional_usd is not None and p.notional_usd < POLICY.dust_usd:
        failures.append("Too small a crumb. Guide buys must be at least $500.")
    if c.spam:
        failures.append("This looks like junk. Leave it.")
    if c.round_trip or c.hold_confirmed is False or c.guide_sold_flat:
        failures.append("Cat already spat it out. Leave it.")
    if c.related_wallet_risk:
        failures.append("Related paws do not count as independent confirmation.")
    if c.stale:
        failures.append("The radio fogged over. Waiting for fresh checks.")
    if storm(c) and not state.settings.storm_override:
        failures.append("Storm weather: smart money is leaving or exchanges are being fed.")
    if c.price_usd is None or c.price_usd <= 0:
        failures.append("No usable price for the practice backpack.")
    return failures


def lane_gates(p: Print, cat: Cat, c: Context, state: State, lane: str) -> list[str]:
    failures = []
    kitchen = lane == "kitchen"
    size = intended_size(p, cat, lane, state, gate=True)
    multiple = POLICY.kitchen_liquidity_multiple if kitchen else POLICY.forage_liquidity_multiple
    if c.liquidity_usd is None or c.liquidity_usd < size * multiple:
        failures.append(f"Liquidity is too shallow for this {lane} nibble.")
    cap = POLICY.kitchen_slippage_pct if kitchen else POLICY.forage_slippage_pct
    if c.slippage_pct is not None and c.slippage_pct > cap:
        failures.append(f"Estimated slippage exceeds the {cap:g}% limit.")
    move = price_move(p, c)
    extension = POLICY.kitchen_extension_pct if kitchen else POLICY.forage_extension_pct
    if (move is None and kitchen) or (move is not None and abs(move) > extension + 1e-8):
        failures.append(f"Cannot get near their price: {extension:g}% is the {lane} limit.")
    return failures


def backpack_gate(p: Print, cat: Cat, c: Context, state: State, lane: str, now: str) -> str | None:
    size = intended_size(p, cat, lane, state, gate=True)
    eq = equity(state)
    kitchen = lane == "kitchen"
    if size <= 0 or size > state.cash + 1e-8:
        return "Not enough room in the cash pocket."
    # Use max(cost, market value): both sunk capital and appreciated exposure count.
    exposure = lambda pos: max(pos.cost_usd, pos.qty * pos.last_price)
    if any(pos.chain == p.chain and pos.token_address == p.token_address for pos in state.positions):
        return "This food is already in the backpack."
    lane_exposure = sum(exposure(pos) for pos in state.positions if pos.lane == lane)
    budget = state.settings.kitchen_budget if kitchen else state.settings.forage_budget
    if lane_exposure + size > eq * budget + 1e-8:
        return f"The {lane.title()} budget is full."
    if sum(exposure(pos) for pos in state.positions if pos.source_cat_id == cat.id) + size > eq * POLICY.cat_cap + 1e-8:
        return "This cat has brought enough food for now."
    if sum(exposure(pos) for pos in state.positions if pos.chain == p.chain and pos.sector == c.sector) + size > eq * POLICY.sleeve_cap + 1e-8:
        return "The Robinhood sector sleeve is full."
    if not kitchen and sum(pos.lane == "forage" for pos in state.positions) >= POLICY.max_forage:
        return "Three mushrooms are enough. Put one back first."
    daily_limit = POLICY.daily_kitchen if kitchen else POLICY.daily_forage
    entries = sum(f["side"] == "buy" and f["lane"] == lane and moment(f["at"]).date() == moment(now).date() for f in state.fills)
    if entries >= daily_limit:
        return f"Today's {lane.title()} entries are used up."
    return None

