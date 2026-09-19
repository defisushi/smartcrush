from .hard_gates import backpack_gate, hard_gates, intended_size, lane_gates, price_move
from .models import Cat, Classification, Context, Print, State, moment
from .policy import KITCHEN_LABELS, POLICY
from .sentences import sentence


def classify_lane(p: Print, cat: Cat, c: Context, state: State, now: str) -> Classification:
    def result(lane, reasons, failures=None, pending=False):
        return Classification(p.id, lane, reasons, failures or [], pending,
                              c.related_wallet_risk, price_move(p, c),
                              0 if lane == "ignore" else intended_size(p, cat, lane, state))

    hard = hard_gates(p, cat, c, state)
    if hard:
        return result("ignore", hard)
    failures = lane_gates(p, cat, c, state, "kitchen")
    if not KITCHEN_LABELS.intersection(cat.labels):
        failures.append("A 30D specialist brings mushrooms, not Kitchen meals.")
    score_age = (moment(now) - moment(cat.last_scored_at)).total_seconds() if cat.last_scored_at else float("inf")
    if cat.win_rate_90d is None or cat.win_rate_90d < POLICY.min_win_rate or not cat.realized_pnl_usd or cat.realized_pnl_usd <= 0 or score_age > 86400:
        failures.append("This cat needs a fresh, passing 90-day score.")
    if not cat.relations_checked:
        failures.append("This cat's related-wallet check is still missing.")
    if c.token_age_days is None or c.token_age_days < POLICY.kitchen_min_age_days:
        failures.append("The token is younger than seven days or its age is unknown.")
    if c.market_cap_usd is None or c.market_cap_usd < POLICY.kitchen_min_market_cap:
        failures.append("Market cap is below the Kitchen floor or unknown.")
    smart = c.smart_trader_net_flow_usd
    if smart is None or smart <= 0:
        failures.append("Smart flow is not positive.")
    if c.smart_trader_wallet_count is None or c.smart_trader_wallet_count < POLICY.min_smart_wallets:
        failures.append("Fewer than three smart wallets are joining in.")
    for value, title in [(c.top_pnl_net_flow_usd, "Top traders"), (c.whale_net_flow_usd, "Whales")]:
        if value is None or (value < 0 and abs(value) > max(smart or 0, 0)):
            failures.append(f"{title} are dumping, or their flow is unknown.")
    if c.exchange_net_flow_usd is None or c.exchange_net_flow_usd > max(abs(smart or 0), 0) * POLICY.exchange_flow_ratio:
        failures.append("Exchanges are being fed, or their flow is unknown.")
    if c.fresh_wallets_net_flow_usd is None or c.fresh_wallets_net_flow_usd > abs(smart or 0) * POLICY.fresh_flow_ratio:
        failures.append("Fresh wallets dominate the bid, or their flow is unknown.")
    if not ((c.unique_smart_buyers is not None and c.unique_smart_sellers is not None and c.unique_smart_buyers >= c.unique_smart_sellers) or c.independent_buyers >= 2):
        failures.append("Independent smart buying has not been confirmed.")
    if c.guide_full_book:
        failures.append("This looks like a full-book all-in.")

    hold_age = (moment(c.hold_checked_at) - moment(p.observed_at)).total_seconds() if c.hold_checked_at else 0
    confirmed = c.hold_confirmed is True and hold_age >= POLICY.hold_minutes * 60
    if not failures:
        risk = backpack_gate(p, cat, c, state, "kitchen", now)
        if risk:
            return result("ignore", [risk])  # Full Kitchen budgets do not leak into Forage.
        return result("kitchen", [sentence(cat, c, "kitchen", [], not confirmed)], pending=not confirmed)

    forage_failures = lane_gates(p, cat, c, state, "forage")
    if cat.persona == "owl" and not state.settings.owls_may_forage:
        forage_failures.append("Owls stay in the Kitchen unless you allow them to forage.")
    if cat.persona not in {"owl", "fox", "raccoon"}:
        forage_failures.append("This cat does not know the Robinhood habitat.")
    risk = backpack_gate(p, cat, c, state, "forage", now)
    if risk:
        forage_failures.append(risk)
    if forage_failures:
        return result("ignore", forage_failures, failures)
    reasons = [sentence(cat, c, "forage", failures, False)]
    if price_move(p, c) is None:
        reasons.append("Stale print: the guide’s original price is unknown.")
    return result("forage", reasons, failures)

