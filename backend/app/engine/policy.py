from dataclasses import dataclass, field


CHAIN = "robinhood"
LABELS = {"Fund", "Smart Trader", "30D Smart Trader", "90D Smart Trader", "180D Smart Trader"}
KITCHEN_LABELS = LABELS - {"30D Smart Trader"}
DENYLIST = {CHAIN: {"USDC", "USDT", "DAI", "USD1", "USDG", "USDE", "FDUSD", "PYUSD", "USDS", "TUSD", "FRAX", "SOL", "WSOL", "ETH", "WETH", "BNB", "WBNB"}}


@dataclass(frozen=True)
class Policy:
    equity: float = 10_000
    kitchen_budget: float = .80
    forage_budget: float = .15
    kitchen_single: float = .10
    forage_single: float = .025
    cat_cap: float = .25
    sleeve_cap: float = .30
    max_cats: int = 3
    max_forage: int = 3
    daily_kitchen: int = 2
    daily_forage: int = 1
    kitchen_liquidity_multiple: int = 80
    forage_liquidity_multiple: int = 20
    kitchen_slippage_pct: float = 1
    forage_slippage_pct: float = 3
    kitchen_extension_pct: float = 4
    forage_extension_pct: float = 12
    dust_usd: float = 500
    kitchen_min_age_days: int = 7
    kitchen_min_market_cap: float = 2_000_000
    min_win_rate: float = .55
    min_smart_wallets: int = 3
    fresh_flow_ratio: float = .5
    exchange_flow_ratio: float = 1
    hold_minutes: int = 20
    kitchen_hours: int = 14 * 24
    forage_hours: int = 36
    kitchen_loss_pct: float = -15
    forage_loss_pct: float = -10
    giveback_peak_pct: float = 25
    giveback_exit_pct: float = 10
    guide_reduction_pct: float = 30
    poll_seconds: int = 90
    token_cache_seconds: int = 600
    score_cache_seconds: int = 43_200
    holders_cache_seconds: int = 900
    # Explicit implementation choices where the brief leaves a threshold open.
    min_guide_trades: int = 10
    min_guide_tokens: int = 3
    max_top_token_profit_share: float = .90
    sleepy_days: int = 7
    retire_days: int = 14


POLICY = Policy()


@dataclass
class Settings:
    paper_equity: float = POLICY.equity
    kitchen_budget: float = POLICY.kitchen_budget
    forage_budget: float = POLICY.forage_budget
    poll_seconds: int = POLICY.poll_seconds
    auto_kitchen: bool = True
    owls_may_forage: bool = False
    storm_override: bool = False

