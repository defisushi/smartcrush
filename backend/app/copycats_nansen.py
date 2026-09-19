"""Verified REST mappings, checked against docs.nansen.ai on 2026-09-18.

Documentation pages: api/smart-money/dex-trades; api/profiler/address-pnl-and-
trade-performance, address-related-wallets, address-current-balances;
api/token-god-mode/token-screener, flow-intelligence, who-bought-sold,
token-information. All list `robinhood` in the relevant chain enums.

DEX trades have *two token legs*, not a `side` field. Map bought/sold legs from
token_bought_*/token_sold_*, trade_value_usd, trader_address(_label),
block_timestamp, transaction_hash. Price at print is value / leg token amount.
PnL is a root object: win_rate (0..1), realized_pnl_usd, traded_times,
traded_token_count, top5_tokens[]. No invented winRate or trade_count fields.
Balances use token_amount, not balance. Related wallets use address + order.
Who-bought-sold defaults to BUY: explicitly request BOTH BUY and SELL cohorts
in two cached calls, then count unique positive-volume addresses in each. Never
assume a buyer_count response or infer all sellers from the BUY-only cohort.
Token information has nested token_details / spot_metrics and NO price_usd.
Use the screener for marks; token information is supplemental only.
The current screener schema no longer documents hide_spam_tokens. Do not send
that unsupported filter; apply local junk rules and never invent spam status.
Unknown response fields stay in the server-side raw cache/log, not in rules.

Observed live 2026-09-18: trader_address_label is often blank / "High Balance",
even when include_smart_money_labels is supplied. Display names are not reliable
category tags. A singleton documented category filter is valid provenance for
that category; never infer a category from a multi-label union query. Existing
cats retain their previously verified category. This avoids premium labels.
"""
import hashlib
import json
import logging
import math
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from app.engine.models import Cat, Context, Print, utcnow
from app.engine.policy import CHAIN, DENYLIST, LABELS, POLICY
from app.game_store import GameStore
from app.nansen_client import NansenClient, NansenError

log = logging.getLogger(__name__)

COSTS = {
    "/api/v1/smart-money/dex-trades": 5,
    "/api/v1/smart-money/netflow": 5,
    "/api/v1/smart-money/holdings": 5,
    "/api/v1/token-screener": 1,
    "/api/v1/tgm/flow-intelligence": 1,
    "/api/v1/tgm/who-bought-sold": 1,
    "/api/v1/tgm/holders": 5,
    "/api/v1/tgm/token-information": 1,
    "/api/v1/tgm/indicators": 5,
    "/api/v1/profiler/address/pnl-summary": 1,
    "/api/v1/profiler/address/related-wallets": 1,
    "/api/v1/profiler/address/current-balance": 1,
    "/api/v1/profiler/address/historical-balances": 1,
}


def number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def rows(data: Any) -> list[dict]:
    if isinstance(data, dict):
        data = data.get("data")
    return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []


def complete_page(data: Any) -> bool:
    pagination = data.get("pagination") if isinstance(data, dict) else None
    return isinstance(pagination, dict) and pagination.get("is_last_page") is True


def labels(text: Any) -> list[str]:
    import re
    if not isinstance(text, str):
        return []
    # A 30D label must not accidentally match the substring `Smart Trader`.
    return list(dict.fromkeys(re.findall(r"(?<![\w])(?:180D Smart Trader|90D Smart Trader|30D Smart Trader|Smart Trader|Fund)(?![\w])", text)))


def persona(found: list[str]) -> str:
    return "owl" if "Fund" in found else "raccoon" if set(found) == {"30D Smart Trader"} else "fox"


def map_trades(payload: Any, *, filter_labels: list[str] | None = None,
               known_labels: dict[str, list[str]] | None = None) -> tuple[list[Print], dict[str, list[str]]]:
    prints, guides = [], {}
    for row in rows(payload):
        if row.get("chain") != CHAIN or not isinstance(row.get("trader_address"), str):
            continue
        address = row["trader_address"].lower()
        found = labels(row.get("trader_address_label"))
        verified = (known_labels or {}).get(address, [])
        if filter_labels and len(filter_labels) == 1 and filter_labels[0] in LABELS:
            verified = list(set(verified) | {filter_labels[0]})
        found = list(set(found) | set(verified))
        if not found:
            continue
        guides[address] = found
        at = row.get("block_timestamp")
        if not isinstance(at, str):
            continue
        try:
            datetime.fromisoformat(at.replace("Z", "+00:00"))
        except ValueError:
            continue
        for side, leg in [("buy", "bought"), ("sell", "sold")]:
            token = row.get(f"token_{leg}_address")
            symbol = row.get(f"token_{leg}_symbol")
            if not isinstance(token, str) or not isinstance(symbol, str) or symbol.upper() in DENYLIST[CHAIN]:
                continue
            value = number(row.get("trade_value_usd"))
            amount = number(row.get(f"token_{leg}_amount"))
            tx = row.get("transaction_hash")
            # Two legs in the same transaction remain separate prints; the token
            # is included so a token-to-token swap cannot hide its sell exit.
            identity = f"{CHAIN}|{tx or address+'|'+at+'|'+str(value)}|{address}|{token.lower()}|{side}"
            prints.append(Print(hashlib.sha256(identity.encode()).hexdigest()[:28], address,
                                token.lower(), symbol[:32], at, side=side, tx_hash=tx,
                                notional_usd=value, token_amount=amount,
                                price_usd_at_print=value / amount if value and amount and amount > 0 else None))
    return prints, guides


class SpotClient(NansenClient):
    CREDIT_COSTS = COSTS
    MAX_ATTEMPTS = 2

    async def _post(self, path, payload=None):
        body = dict(payload or {})
        if path not in COSTS:
            raise NansenError("This endpoint is outside Copycats spot scope.")
        if body.get("premium_labels") is True:
            raise NansenError("Premium labels are disabled.")
        if "chains" in body:
            if body["chains"] != [CHAIN]:
                raise NansenError("Only the Robinhood meadow is enabled.")
        elif body.get("chain") != CHAIN:
            raise NansenError("Only the Robinhood meadow is enabled.")
        return await super()._post(path, body)


@dataclass
class Cached:
    data: Any
    fetched_at: str
    stale: bool = False


class NansenReader:
    def __init__(self, client: SpotClient, store: GameStore, hourly_budget: int = 350):
        self.client, self.store = client, store
        self.hourly_budget = hourly_budget
        self.fog: str | None = None
        self.failed_until: dict[str, float] = {}

    async def request(self, path: str, body: dict, ttl: int, key: str | None = None) -> Cached:
        key = key or path + json.dumps(body, sort_keys=True)
        cache = await self.store.cache_get(key)
        now = time.time()
        if cache and now - cache[1] < ttl:
            return Cached(cache[0], datetime.fromtimestamp(cache[1], timezone.utc).isoformat())
        try:
            if self.failed_until.get(key, 0) > now:
                raise NansenError("This radio channel is cooling down.")
            if await self.store.credits_hour() + COSTS[path] > self.hourly_budget:
                raise NansenError("The hourly credit allowance is used up.")
            data = await self.client._post(path, body)
            log.debug("Nansen raw endpoint=%s json=%s", path, json.dumps(data))
            await self.store.cache_put(key, data, now)
            return Cached(data, datetime.fromtimestamp(now, timezone.utc).isoformat())
        except NansenError as exc:
            self.failed_until[key] = now + 90
            self.fog = "The radio fogged over. Last saved observations are still here."
            log.warning("Nansen read failed endpoint=%s error=%s", path, exc)
            if cache:
                return Cached(cache[0], datetime.fromtimestamp(cache[1], timezone.utc).isoformat(), True)
            raise

    async def dex(self, page=1, *, filter_labels=None, trader_addresses=None):
        filters = {"include_smart_money_labels": filter_labels or sorted(LABELS)}
        if trader_addresses:
            filters["trader_address"] = sorted(set(trader_addresses))
        return await self.request("/api/v1/smart-money/dex-trades", {
            "chains": [CHAIN], "filters": filters,
            "pagination": {"page": page, "per_page": 100},
            "order_by": [{"field": "block_timestamp", "direction": "DESC"}],
        }, 90)

    async def score(self, cat: Cat, now: str):
        end = datetime.fromisoformat(now)
        pnl = await self.request("/api/v1/profiler/address/pnl-summary", {
            "chain": CHAIN, "address": cat.address,
            "date": {"from": (end - timedelta(days=90)).isoformat(), "to": now},
        }, POLICY.score_cache_seconds, f"pnl:{cat.address}")
        if pnl.stale:
            return
        data = pnl.data if isinstance(pnl.data, dict) else {}
        cat.win_rate_90d = number(data.get("win_rate"))
        if cat.win_rate_90d is not None and not 0 <= cat.win_rate_90d <= 1:
            cat.win_rate_90d = None
        cat.realized_pnl_usd = number(data.get("realized_pnl_usd"))
        cat.traded_times = int(number(data.get("traded_times")) or 0)
        cat.traded_token_count = int(number(data.get("traded_token_count")) or 0)
        tops = data.get("top5_tokens")
        if isinstance(tops, list):
            tops = [t for t in tops if isinstance(t, dict) and t.get("chain") == CHAIN]
            cat.top_tokens = [str(t["token_symbol"]) for t in tops if t.get("token_symbol")]
            profits = [max(number(t.get("realized_pnl")) or 0, 0) for t in tops]
            cat.top_token_profit_share = max(profits) / sum(profits) if sum(profits) > 0 else None
        cat.last_scored_at = pnl.fetched_at

    async def relations(self, cat: Cat):
        related = await self.request("/api/v1/profiler/address/related-wallets", {
            "chain": CHAIN, "address": cat.address, "pagination": {"page": 1, "per_page": 1000},
        }, POLICY.score_cache_seconds, f"relations:{cat.address}")
        data = related.data
        complete = isinstance(data, dict) and isinstance(data.get("data"), list) and complete_page(data)
        cat.relations_checked = complete and not related.stale
        cat.related_addresses = [str(r["address"]).lower() for r in rows(data)
                                 if r.get("chain") == CHAIN and r.get("address") and number(r.get("order")) == 1]

    async def token(self, token: str, *, enrich=True) -> Context:
        screen = await self.request("/api/v1/token-screener", {
            "chains": [CHAIN], "timeframe": "24h", "filters": {"token_address": token},
            "pagination": {"page": 1, "per_page": 10},
        }, POLICY.token_cache_seconds, f"screen:{token}")
        row = next((r for r in rows(screen.data) if r.get("chain") == CHAIN and str(r.get("token_address", "")).lower() == token), {})
        age = number(row.get("token_age_days"))
        if (age is None or age == 0) and number(row.get("token_age_hours")) is not None:
            age = number(row["token_age_hours"]) / 24
        c = Context(price_usd=number(row.get("price_usd")), price_updated_at=screen.fetched_at,
                    token_age_days=age, market_cap_usd=number(row.get("market_cap_usd")),
                    liquidity_usd=number(row.get("liquidity")), stale=screen.stale,
                    spam=not row or any(x in str(row.get("token_symbol", "")).lower() for x in ["http", ".com", "claim", "airdrop"]))
        if not enrich:
            return c
        flow = await self.request("/api/v1/tgm/flow-intelligence", {
            "chain": CHAIN, "token_address": token, "timeframe": "1d",
        }, POLICY.token_cache_seconds, f"flow:{token}")
        flow_row = next(iter(rows(flow.data)), {})
        for field in ["smart_trader_net_flow_usd", "smart_trader_wallet_count", "top_pnl_net_flow_usd",
                      "whale_net_flow_usd", "exchange_net_flow_usd", "fresh_wallets_net_flow_usd"]:
            setattr(c, field, number(flow_row.get(field)))
        info = await self.request("/api/v1/tgm/token-information", {
            "chain": CHAIN, "token_address": token, "timeframe": "1d",
        }, POLICY.token_cache_seconds, f"info:{token}")
        info_data = info.data.get("data", {}) if isinstance(info.data, dict) else {}
        if isinstance(info_data, dict):
            details = info_data.get("token_details")
            metrics = info_data.get("spot_metrics")
            details = details if isinstance(details, dict) else {}
            metrics = metrics if isinstance(metrics, dict) else {}
            if c.market_cap_usd is None:
                c.market_cap_usd = number(details.get("market_cap_usd"))
            if c.liquidity_usd is None:
                c.liquidity_usd = number(metrics.get("liquidity_usd"))
        c.stale = c.stale or flow.stale or info.stale
        return c

    async def buyers(self, token: str, now: str) -> tuple[int | None, int | None]:
        end = datetime.fromisoformat(now)
        counts = []
        for side, volume in [("BUY", "bought_volume_usd"), ("SELL", "sold_volume_usd")]:
            reply = await self.request("/api/v1/tgm/who-bought-sold", {
                "chain": CHAIN, "token_address": token, "buy_or_sell": side,
                "date": {"from": (end - timedelta(hours=12)).isoformat(), "to": now},
                "filters": {"include_smart_money_labels": sorted(LABELS)},
                "pagination": {"page": 1, "per_page": 1000},
            }, 600, f"participants:{side}:{token}")
            data = reply.data
            if reply.stale or not isinstance(data, dict) or not complete_page(data):
                return None, None  # Truncated lists do not prove buyers >= sellers.
            cohort = {r["address"].lower() for r in rows(data) if isinstance(r.get("address"), str) and (number(r.get(volume)) or 0) > 0}
            counts.append(len(cohort))
        return counts[0], counts[1]

    async def balance(self, cat: Cat, token: str, *, confirmation=False) -> tuple[float | None, str | None]:
        reply = await self.request("/api/v1/profiler/address/current-balance", {
            "chain": CHAIN, "address": cat.address, "hide_spam_token": True,
            "filters": {"token_address": token}, "pagination": {"page": 1, "per_page": 100},
        }, 90 if confirmation else 600, f"balance:{cat.address}:{token}")
        if reply.stale:
            return None, None
        for r in rows(reply.data):
            if r.get("chain") == CHAIN and str(r.get("token_address", "")).lower() == token:
                return number(r.get("token_amount")), reply.fetched_at
        if isinstance(reply.data, dict) and isinstance(reply.data.get("data"), list) and complete_page(reply.data):
            return 0, reply.fetched_at
        return None, None
