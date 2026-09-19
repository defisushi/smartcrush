from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

from .policy import CHAIN, Settings


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def moment(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


Lane = Literal["kitchen", "forage", "ignore"]


@dataclass
class Cat:
    id: str
    address: str
    name: str
    persona: str = "fox"
    labels: list[str] = field(default_factory=list)
    chain_hints: list[str] = field(default_factory=lambda: [CHAIN])
    follow_mode: str = "nibble"
    status: str = "active"
    adopted: bool = False
    win_rate_90d: float | None = None
    realized_pnl_usd: float | None = None
    traded_times: int = 0
    traded_token_count: int = 0
    top_tokens: list[str] = field(default_factory=list)
    top_token_profit_share: float | None = None
    related_addresses: list[str] = field(default_factory=list)
    relations_checked: bool = False
    last_scored_at: str | None = None
    last_seen_at: str = field(default_factory=utcnow)
    weak_scores: int = 0


@dataclass
class Print:
    id: str
    cat_id: str
    token_address: str
    token_symbol: str
    observed_at: str
    side: str = "buy"
    chain: str = CHAIN
    tx_hash: str | None = None
    notional_usd: float | None = None
    price_usd_at_print: float | None = None
    token_amount: float | None = None
    is_dex_swap: bool = True


@dataclass
class Context:
    price_usd: float | None = None
    price_updated_at: str | None = None
    token_age_days: float | None = None
    market_cap_usd: float | None = None
    liquidity_usd: float | None = None
    slippage_pct: float | None = None
    spam: bool = False
    sector: str = "other"
    smart_trader_net_flow_usd: float | None = None
    smart_trader_wallet_count: int | None = None
    top_pnl_net_flow_usd: float | None = None
    whale_net_flow_usd: float | None = None
    exchange_net_flow_usd: float | None = None
    fresh_wallets_net_flow_usd: float | None = None
    unique_smart_buyers: int | None = None
    unique_smart_sellers: int | None = None
    independent_buyers: int = 1
    independent_kitchen_buyers: int = 1
    related_wallet_risk: bool = False
    hold_confirmed: bool | None = None
    hold_checked_at: str | None = None
    guide_balance: float | None = None
    guide_reduction_pct: float | None = None
    guide_sold_any: bool = False
    guide_sold_flat: bool = False
    guide_full_book: bool = False
    round_trip: bool = False
    smart_holders_down: bool = False
    stale: bool = False


@dataclass
class Classification:
    print_id: str
    lane: Lane
    reasons: list[str]
    failed_kitchen_rules: list[str] = field(default_factory=list)
    pending: bool = False
    related_wallet_risk: bool = False
    price_move_since_print_pct: float | None = None
    intended_usd: float = 0


@dataclass
class Position:
    id: str
    lane: str
    token_address: str
    token_symbol: str
    qty: float
    cost_usd: float
    opened_at: str
    source_print_id: str
    source_cat_id: str
    chain: str = CHAIN
    sector: str = "other"
    cat_still_holding: bool | None = True
    locked_by_user: bool = False
    last_price: float = 0
    price_updated_at: str | None = None
    peak_return_pct: float = 0
    source_balance: float | None = None
    source_observed_at: str | None = None
    guide_sold_amount: float = 0
    exit_pending: str | None = None


@dataclass
class State:
    settings: Settings = field(default_factory=Settings)
    cash: float = 10_000
    cats: list[Cat] = field(default_factory=list)
    positions: list[Position] = field(default_factory=list)
    fills: list[dict] = field(default_factory=list)
    events: list[dict] = field(default_factory=list)
    seen: list[str] = field(default_factory=list)
    pending: list[dict] = field(default_factory=list)
    tokens: dict[str, dict] = field(default_factory=dict)
    ignored_count: int = 0
    ignored: list[dict] = field(default_factory=list)
    last_poll_at: str | None = None
    fog: str | None = None
    mock_step: int = 0
    discovery_step: int = 0
    scenario_started_at: str = field(default_factory=utcnow)
