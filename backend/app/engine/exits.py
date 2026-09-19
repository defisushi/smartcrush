from .models import Context, Position, Print, State, moment
from .paper_broker import close_position
from .policy import POLICY


def exit_reason(p: Position, c: Context, now: str) -> str | None:
    returns = (p.qty * p.last_price / p.cost_usd - 1) * 100 if p.cost_usd else 0
    p.peak_return_pct = max(p.peak_return_pct, returns)
    kitchen = p.lane == "kitchen"
    stop = POLICY.kitchen_loss_pct if kitchen else POLICY.forage_loss_pct
    if returns <= stop + 1e-8:
        return f"The {abs(stop):g}% loss stop tucked this away."
    if p.locked_by_user:
        return None
    age = (moment(now) - moment(p.opened_at)).total_seconds() / 3600
    if kitchen:
        if c.guide_sold_flat or (c.guide_reduction_pct is not None and c.guide_reduction_pct >= POLICY.guide_reduction_pct):
            return "Cat walked away from at least 30% of the meal."
        if c.smart_trader_net_flow_usd is not None and c.smart_trader_net_flow_usd < 0:
            return "Smart flow turned into a storm."
        if c.smart_holders_down:
            return "Smart holders are putting food back."
        if age >= POLICY.kitchen_hours:
            return "Kitchen time stop: this meal is 14 days old."
    else:
        if c.guide_sold_any or c.guide_sold_flat or (c.guide_reduction_pct or 0) > 0:
            return "Cat spat out some of this mushroom."
        if age >= POLICY.forage_hours:
            return "Forage time stop: 36 hours is bedtime."
        if p.peak_return_pct >= POLICY.giveback_peak_pct and returns <= POLICY.giveback_exit_pct + 1e-8:
            return "This mushroom gave back its glow."
        smart = c.smart_trader_net_flow_usd
        if smart is not None:
            if c.fresh_wallets_net_flow_usd is not None and c.fresh_wallets_net_flow_usd > abs(smart) * POLICY.fresh_flow_ratio:
                return "Fresh wallets now dominate this mushroom."
            if c.exchange_net_flow_usd is not None and c.exchange_net_flow_usd > abs(smart) * POLICY.exchange_flow_ratio:
                return "The exchanges are being fed. Put this mushroom back."
    return p.exit_pending


def handle_guide_exit(state: State, trade: Print, now: str) -> None:
    if trade.side != "sell":
        return
    # Sells are processed before buy hard gates: dust sells, sleeping/retired cats
    # and adverse weather still trigger risk exits.
    state.pending = [job for job in state.pending if not (
        job["print"]["cat_id"] == trade.cat_id and job["print"]["token_address"] == trade.token_address)]
    for event in state.events:
        if event["print"]["cat_id"] == trade.cat_id and event["print"]["token_address"] == trade.token_address and event.get("status") in {"pending", "ready"}:
            event["status"] = "left"
            event["classification"]["lane"] = "ignore"
            event["classification"]["reasons"] = ["Cat already spat it out. Leave it."]
    for p in list(state.positions):
        if p.chain != trade.chain or p.token_address != trade.token_address or p.source_cat_id != trade.cat_id:
            continue
        if moment(trade.observed_at) < moment(p.source_observed_at or p.opened_at):
            continue
        p.guide_sold_amount += trade.token_amount or 0
        reduction = p.guide_sold_amount / p.source_balance * 100 if p.source_balance else None
        p.cat_still_holding = False if reduction is not None and reduction >= 100 else None
        c = Context(guide_sold_any=True, guide_reduction_pct=reduction,
                    guide_sold_flat=reduction is not None and reduction >= 100)
        reason = exit_reason(p, c, now)
        if reason:
            close_position(state, p, p.last_price, reason, now)
