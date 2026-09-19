import asyncio
import logging
from dataclasses import asdict
from datetime import timedelta
from uuid import uuid4

from app.copycats_nansen import NansenReader, SpotClient, map_trades, persona
from app.engine.classify import classify_lane
from app.engine.exits import exit_reason, handle_guide_exit
from app.engine.hard_gates import equity, hard_gates, lane_gates, storm
from app.engine.models import Cat, Context, Print, State, moment, utcnow
from app.engine.paper_broker import close_position, lock_position, open_position
from app.engine.policy import CHAIN, KITCHEN_LABELS, POLICY, Settings
from app.game_store import GameStore
from app.mock_nansen import MockReader, seed_cats
from app.nansen_client import NansenError

log = logging.getLogger(__name__)


def recruit_problem(cat: Cat, state: State) -> str | None:
    if cat.status != "active":
        return "This cat is resting or retired."
    if not cat.last_scored_at or (moment(utcnow()) - moment(cat.last_scored_at)).total_seconds() > 86400:
        return "A fresh score is still needed."
    if cat.realized_pnl_usd is None or cat.realized_pnl_usd <= 0:
        return "Waiting for a positive track record."
    if cat.win_rate_90d is None or cat.win_rate_90d < POLICY.min_win_rate:
        return "This cat's recent streak needs time to recover."
    if cat.traded_times < POLICY.min_guide_trades or cat.traded_token_count < POLICY.min_guide_tokens:
        return "Not enough varied hunts yet."
    if cat.top_token_profit_share is not None and cat.top_token_profit_share > POLICY.max_top_token_profit_share:
        return "One token accounts for almost all of this cat's wins."
    if not cat.relations_checked:
        return "The related-wallet check is still incomplete."
    for other in state.cats:
        if other.adopted and other.id != cat.id and (other.address in cat.related_addresses or cat.address in other.related_addresses):
            return f"Related to {other.name}. Their paws are not independent."
    if not cat.adopted and sum(c.adopted for c in state.cats) >= POLICY.max_cats:
        return "Your three cozy spots are taken."
    return None


class Game:
    def __init__(self, store: GameStore, client: SpotClient, config):
        self.store, self.client, self.config = store, client, config
        self.mode = "mock" if config.MOCK_NANSEN else "live"
        self.state = State()
        self.reader = None
        self.lock = asyncio.Lock()
        self.last_attempt = 0.0
        self.lock_intents: dict[str, tuple[str, float]] = {}

    async def initialize(self):
        await self.store.initialize()
        await self.load_mode(self.mode)

    async def load_mode(self, mode):
        self.mode = mode
        state = await self.store.load(mode)
        if state is None:
            state = State()
            if mode == "mock":
                state.cats = seed_cats(utcnow())
        self.state = state
        self.reader = MockReader(state) if mode == "mock" else NansenReader(self.client, self.store, self.config.CREDIT_BUDGET_HOUR)
        self.last_attempt = 0
        await self.store.save(mode, self.state)

    def cat(self, cat_id):
        cat = next((c for c in self.state.cats if c.id == cat_id), None)
        if cat is None:
            raise ValueError("That cat wandered out of view.")
        return cat

    def context(self, token):
        return Context(**self.state.tokens.get(token, {}))

    def ignore(self, p, reasons):
        if p.id not in self.state.seen:
            self.state.seen.append(p.id)
        self.state.ignored_count += 1
        self.state.ignored.append({"print": asdict(p), "lane": "ignore", "reasons": reasons})
        self.state.ignored = self.state.ignored[-500:]

    def add_event(self, p, classification, c, status):
        item = {"id": p.id, "print": asdict(p), "classification": asdict(classification),
                "context": asdict(c), "status": status}
        old = next((e for e in self.state.events if e["id"] == p.id), None)
        if old:
            old.update(item)
        else:
            self.state.events.append(item)
        self.state.events = self.state.events[-300:]
        return item

    async def evaluatePrint(self, p: Print, *, confirming=False):
        """One pipeline for a new print, a scheduled confirmation, or manual recheck.

        Game's async lock protects this method plus the aggregate SQLite commit.
        Sells bypass entry gates and run before any token enrichment.
        """
        now = utcnow()
        if p.chain != CHAIN:
            return None
        if not confirming and p.id in self.state.seen:
            return None
        if p.side == "sell":
            handle_guide_exit(self.state, p, now)
            self.state.seen.append(p.id)
            return None
        cat = self.cat(p.cat_id)
        if not cat.adopted or cat.status != "active" or (p.notional_usd is not None and p.notional_usd < POLICY.dust_usd):
            self.ignore(p, ["Dust, or cat not active and adopted."])
            return None
        # Cheap screener gates first. Expensive optional holders/netflow/indicators
        # are not needed by the v1 strategy and are never polled here.
        cheap = await self.reader.token(p.token_address, enrich=False)
        if hard_gates(p, cat, cheap, self.state) or lane_gates(p, cat, cheap, self.state, "forage"):
            result = classify_lane(p, cat, cheap, self.state, now)
            self.ignore(p, result.reasons)
            if confirming:
                self.add_event(p, result, cheap, "left")
            return result
        c = await self.reader.token(p.token_address)
        c.unique_smart_buyers, c.unique_smart_sellers = await self.reader.buyers(p.token_address, now)
        similar = [e for e in self.state.events if e["print"]["token_address"] == p.token_address
                   and e.get("status") not in {"left", "skipped"}
                   and abs((moment(p.observed_at) - moment(e["print"]["observed_at"])).total_seconds()) <= 86400]
        participating = {p.cat_id} | {e["print"]["cat_id"] for e in similar}
        independent = []
        for identity in sorted(participating):
            other = self.cat(identity)
            if other.adopted and other.status == "active" and other.relations_checked:
                if not any(x.address in other.related_addresses or other.address in x.related_addresses for x in independent):
                    independent.append(other)
                else:
                    c.related_wallet_risk = True
        c.independent_buyers = len(independent)
        c.independent_kitchen_buyers = sum(bool(KITCHEN_LABELS.intersection(x.labels)) and
                                          (x.win_rate_90d or 0) >= POLICY.min_win_rate and (x.realized_pnl_usd or 0) > 0 for x in independent)
        age = (moment(now) - moment(p.observed_at)).total_seconds()
        if age >= POLICY.hold_minutes * 60:
            amount, at = await self.reader.balance(cat, p.token_address, confirmation=True)
            c.guide_balance, c.hold_checked_at = amount, at
            if amount is not None:
                c.hold_confirmed = amount > 0
        # Any already-observed sell after this buy kills the pending meal. The
        # batch is sorted chronologically, with sell legs before buy legs.
        c.round_trip = any(e["print"]["token_address"] == p.token_address and e["print"]["cat_id"] == p.cat_id
                           and e.get("status") == "left" and moment(e["print"]["observed_at"]) >= moment(p.observed_at)
                           for e in self.state.events)
        self.state.tokens[p.token_address] = asdict(c)
        result = classify_lane(p, cat, c, self.state, now)
        if not confirming:
            self.state.seen.append(p.id)
        if result.lane == "ignore":
            self.ignore(p, result.reasons)
            if confirming:
                self.add_event(p, result, c, "left")
            return result
        status = "pending" if result.pending else "ready"
        event = self.add_event(p, result, c, status)
        if result.pending:
            if not any(job["print"]["id"] == p.id for job in self.state.pending):
                due = max(moment(now), moment(p.observed_at) + timedelta(minutes=POLICY.hold_minutes)) + timedelta(seconds=1)
                self.state.pending.append({"print": asdict(p), "due": due.isoformat()})
        elif result.lane == "kitchen" and self.state.settings.auto_kitchen and cat.follow_mode != "watching" and not storm(c) and not any(storm(self.context(pos.token_address)) for pos in self.state.positions):
            open_position(self.state, p, cat, c, result, now, automatic=True)
            event["status"] = "eaten"
        return result

    async def poll(self, *, force=False, discover=False):
        import time
        async with self.lock:
            # Refresh respects the same 90-second cache as the worker.
            if time.monotonic() - self.last_attempt < 5:
                return await self.snapshot()
            self.last_attempt = time.monotonic()
            self.state.fog = None
            self.reader.fog = None
            now = utcnow()
            try:
                batches = []
                adopted = [cat for cat in self.state.cats if cat.adopted]
                tracking = {cat.address for cat in adopted} | {self.cat(pos.source_cat_id).address for pos in self.state.positions}
                # Initial recruitment rotates one category per patrol (5 credits),
                # rather than spending 25 credits to fan out every heartbeat.
                categories = ["90D Smart Trader", "Fund", "30D Smart Trader", "180D Smart Trader", "Smart Trader"]
                category_filter = None
                if self.mode == "live" and (not tracking or discover):
                    category_filter = [categories[self.state.discovery_step % len(categories)]]
                pages = 1 if category_filter else 3
                for page in range(1, pages + 1):
                    reply = await self.reader.dex(page, filter_labels=category_filter,
                                                  trader_addresses=list(tracking) if not category_filter else None)
                    batch, guides = map_trades(reply.data, filter_labels=category_filter,
                                               known_labels={c.address: c.labels for c in self.state.cats})
                    batches.extend(batch)
                    for address, found in guides.items():
                        cat = next((c for c in self.state.cats if c.address == address), None)
                        if not cat:
                            cat = Cat(address, address, self.generated_name(address), persona=persona(found), labels=found)
                            self.state.cats.append(cat)
                        observations = [p.observed_at for p in batch if p.cat_id == address]
                        if observations:
                            cat.last_seen_at = max([cat.last_seen_at] + observations, key=moment)
                        cat.labels = found
                        cat.persona = persona(found)
                    if reply.stale:
                        break
                    pagination = reply.data.get("pagination") if isinstance(reply.data, dict) else None
                    if not isinstance(pagination, dict) or pagination.get("is_last_page") is not False:
                        break
                    if page == 3:
                        self.state.fog = "A busy meadow: only the newest 300 swaps were checked."
                if category_filter:
                    self.state.discovery_step += 1
                # Sells for existing positions must be handled before score/flow
                # calls. New prints then run in chronological order.
                for p in sorted(batches, key=lambda x: (moment(x.observed_at), x.side != "sell")):
                    if p.side == "sell" and p.id not in self.state.seen:
                        await self.evaluatePrint(p)
                candidates = sorted(self.state.cats, key=lambda c: (not c.adopted, -(moment(c.last_seen_at).timestamp())))
                scored = 0
                for cat in candidates:
                    due = not cat.last_scored_at or (moment(now)-moment(cat.last_scored_at)).total_seconds() >= POLICY.score_cache_seconds
                    if due and (cat.adopted or scored < 8):
                        try:
                            await self.reader.score(cat, now)
                            await self.reader.relations(cat)
                            scored += 1
                            self.retirement_check(cat, now)
                        except NansenError:
                            continue
                for p in sorted(batches, key=lambda x: moment(x.observed_at)):
                    if p.side == "buy":
                        # Historical buy followed by sell in this 24h batch must
                        # never be opened even if balance has subsequently recovered.
                        if any(s.side == "sell" and s.cat_id == p.cat_id and s.token_address == p.token_address and moment(s.observed_at) >= moment(p.observed_at) for s in batches):
                            if p.id not in self.state.seen:
                                self.ignore(p, ["The cat sold after this buy. Same-window round trip."])
                            continue
                        try:
                            await self.evaluatePrint(p)
                        except NansenError:
                            continue  # Missing reads are retried, never deduplicated away.
                for job in list(self.state.pending):
                    if moment(job["due"]) <= moment(now):
                        try:
                            p = Print(**job["print"])
                            result = await self.evaluatePrint(p, confirming=True)
                            if result and result.pending:
                                job["due"] = (moment(now) + timedelta(minutes=10)).isoformat()
                            elif job in self.state.pending:
                                self.state.pending.remove(job)
                        except NansenError:
                            continue
            except NansenError:
                pass
            # Exits still run when the heartbeat fails, using persisted marks.
            for position in list(self.state.positions):
                c = self.context(position.token_address)
                try:
                    fresh = await self.reader.token(position.token_address)
                    if fresh.price_usd is not None and fresh.price_usd > 0:
                        position.last_price = fresh.price_usd
                        position.price_updated_at = fresh.price_updated_at
                    amount, at = await self.reader.balance(self.cat(position.source_cat_id), position.token_address)
                    if amount is not None:
                        fresh.guide_balance = amount
                        position.cat_still_holding = amount > 0
                        fresh.guide_sold_flat = amount <= 0
                        if position.source_balance:
                            fresh.guide_reduction_pct = max(0, (1 - amount / position.source_balance) * 100)
                        elif amount > 0:
                            position.source_balance = amount
                    c = fresh
                    self.state.tokens[position.token_address] = asdict(c)
                except NansenError:
                    pass
                reason = exit_reason(position, c, now)
                if reason:
                    close_position(self.state, position, position.last_price, reason, now)
            self.state.last_poll_at = now
            self.state.fog = self.reader.fog or self.state.fog
            await self.store.save(self.mode, self.state)
            return await self.snapshot()

    @staticmethod
    def generated_name(address):
        names = ["Miso", "Clover", "Pip", "Nori", "Mallow", "Fig", "Button", "Pebble", "Fern", "Biscuit", "Sesame", "Tofu"]
        import hashlib
        n = int(hashlib.sha256(address.encode()).hexdigest()[:8], 16)
        return f"{names[n % len(names)]} {n % 97 + 1}"

    @staticmethod
    def retirement_check(cat, now):
        if cat.status == "retired":
            return
        idle_days = (moment(now) - moment(cat.last_seen_at)).total_seconds() / 86400
        weak = cat.win_rate_90d is not None and cat.win_rate_90d < POLICY.min_win_rate
        weak = weak or cat.realized_pnl_usd is not None and cat.realized_pnl_usd <= 0
        cat.weak_scores = cat.weak_scores + 1 if weak else 0
        if cat.weak_scores >= 4 or idle_days >= POLICY.retire_days:
            cat.status = "retired"
        elif weak or idle_days >= POLICY.sleepy_days:
            cat.status = "sleepy"
        else:
            cat.status = "active"

    async def snapshot(self):
        data = asdict(self.state)
        # Full addresses/metrics are accessed through explicit advanced endpoints.
        data.pop("seen")
        data.pop("tokens")
        data.pop("pending")
        data.pop("fills")
        data.pop("ignored")
        data["mode"] = self.mode
        data["chain"] = CHAIN
        data["equity"] = round(equity(self.state), 2)
        data["credits_hour"] = await self.store.credits_hour()
        data["api_key_configured"] = bool(self.client.api_key)
        data["policy"] = asdict(POLICY)
        data["weather"] = "fog" if self.state.fog else "storm" if any(storm(self.context(p.token_address)) for p in self.state.positions) else "rain" if self.state.tokens else "quiet"
        for cat in data["cats"]:
            real = self.cat(cat["id"])
            cat["recruit_problem"] = recruit_problem(real, self.state)
            cat.pop("address")
            cat.pop("related_addresses")
        # id values for live cats are wallet addresses internally, but the UI
        # only uses these in data attributes; displayed addresses remain advanced.
        data["events"] = sorted(data["events"], key=lambda e: moment(e["print"]["observed_at"]), reverse=True)
        data["recent_fills"] = self.state.fills[-10:][::-1]
        return data

    async def action(self, kind: str, payload: dict):
        import copy
        async with self.lock:
            before = copy.deepcopy(self.state)
            before_mode, before_reader = self.mode, self.reader
            try:
                return await self._action_unlocked(kind, payload)
            except Exception:
                self.state, self.mode, self.reader = before, before_mode, before_reader
                if isinstance(self.reader, MockReader):
                    self.reader.state = self.state
                raise

    async def _action_unlocked(self, kind: str, payload: dict):
        now = utcnow()
        if kind == "adopt":
            cat = self.cat(payload["cat_id"])
            if cat.adopted:
                raise ValueError("This cat already lives here.")
            if self.mode == "live":
                await self.reader.score(cat, now)
                await self.reader.relations(cat)
            problem = recruit_problem(cat, self.state)
            if problem:
                raise ValueError(problem)
            cat.adopted = True
        elif kind == "cat":
            cat = self.cat(payload["cat_id"])
            if "name" in payload:
                name = str(payload["name"]).strip()
                if not 1 <= len(name) <= 24:
                    raise ValueError("Cat names need 1–24 characters.")
                cat.name = name
            if "follow_mode" in payload:
                if payload["follow_mode"] not in {"watching", "nibble", "clingy"}:
                    raise ValueError("Choose watching, nibble, or clingy.")
                cat.follow_mode = payload["follow_mode"]
            if payload.get("release"):
                cat.adopted = False
        elif kind in {"eat", "skip"}:
            event = next((e for e in self.state.events if e["id"] == payload["event_id"]), None)
            if event is None or event["status"] != "ready":
                raise ValueError("This food is no longer ready to eat.")
            if kind == "skip":
                event["status"] = "skipped"
            else:
                p = Print(**event["print"])
                cat = self.cat(p.cat_id)
                c = await self.reader.token(p.token_address)
                previous = Context(**event["context"])
                c.unique_smart_buyers, c.unique_smart_sellers = await self.reader.buyers(p.token_address, now)
                for field in ["independent_buyers", "independent_kitchen_buyers", "related_wallet_risk"]:
                    setattr(c, field, getattr(previous, field))
                amount, at = await self.reader.balance(cat, p.token_address, confirmation=True)
                c.guide_balance, c.hold_checked_at = amount, at
                c.hold_confirmed = amount > 0 if amount is not None else None
                result = classify_lane(p, cat, c, self.state, now)
                if any(storm(self.context(pos.token_address)) for pos in self.state.positions) and not self.state.settings.storm_override:
                    raise ValueError("Storm weather. New eats are paused until it clears.")
                if result.lane != event["classification"]["lane"]:
                    raise ValueError("The food changed since you opened it. Refresh the meadow.")
                if result.lane == "forage" and payload.get("intent") != "gamble":
                    raise ValueError("This mushroom needs a deliberate Gamble.")
                open_position(self.state, p, cat, c, result, now)
                event["status"] = "eaten"
        elif kind == "put_back":
            position = next((p for p in self.state.positions if p.id == payload["position_id"]), None)
            if not position:
                raise ValueError("That food has already been put back.")
            close_position(self.state, position, position.last_price, "You put it back.", now)
        elif kind == "lock_begin":
            import time
            position = next((p for p in self.state.positions if p.id == payload["position_id"]), None)
            if not position:
                raise ValueError("That food is no longer in the backpack.")
            token = str(uuid4())
            self.lock_intents[token] = (position.id, time.monotonic())
            return {"token": token}
        elif kind == "lock":
            import time
            intent = self.lock_intents.pop(payload.get("token"), None)
            if not intent or intent[0] != payload["position_id"] or not 1.2 <= time.monotonic()-intent[1] <= 30:
                raise ValueError("Hold a little longer to disagree with your cat.")
            position = next((p for p in self.state.positions if p.id == intent[0]), None)
            if not position:
                raise ValueError("That food has already left.")
            lock_position(position)
        elif kind == "settings":
            allowed = Settings.__dataclass_fields__
            changes = {k: v for k, v in payload.items() if k in allowed}
            new = Settings(**{**asdict(self.state.settings), **changes})
            if not 100 <= new.paper_equity <= 1_000_000 or not 90 <= new.poll_seconds <= 3600:
                raise ValueError("Use $100–$1,000,000 and a 90–3600 second patrol.")
            if not 0 <= new.kitchen_budget <= .80 or not 0 <= new.forage_budget <= .15 or new.kitchen_budget+new.forage_budget > .95 + 1e-9:
                raise ValueError("Kitchen can use up to 80%; Forage up to 15%.")
            for key in ["auto_kitchen", "owls_may_forage", "storm_override"]:
                if not isinstance(getattr(new, key), bool):
                    raise ValueError("Toggle values must be true or false.")
            if new.paper_equity != self.state.settings.paper_equity:
                delta = new.paper_equity - self.state.settings.paper_equity
                if self.state.cash + delta < 0:
                    raise ValueError("Put some food back before removing that much practice money.")
                self.state.cash += delta
                self.state.fills.append({"id": str(uuid4()), "side": "deposit" if delta > 0 else "withdrawal", "lane": "account",
                                         "token_symbol": "Cash pocket", "usd": abs(delta), "at": now,
                                         "reason": "Practice money adjustment", "price_basis": "Paper cash only"})
            self.state.settings = new
        elif kind == "restart_practice":
            if self.mode != "mock":
                raise ValueError("Only the fictional practice meadow can restart here.")
            await self.store.archive(self.mode, self.state, now)
            self.state = State(cats=seed_cats(now))
            self.reader = MockReader(self.state)
            self.last_attempt = 0
        elif kind == "mode":
            mode = payload.get("mode")
            if mode not in {"mock", "live"}:
                raise ValueError("Choose practice fixtures or live Nansen reads.")
            if mode == "live" and not self.client.api_key:
                raise ValueError("Add NANSEN_API_KEY on the server before using live reads.")
            await self.load_mode(mode)
        else:
            raise ValueError("That meadow action is not available.")
        await self.store.save(self.mode, self.state)
        return await self.snapshot()


    async def worker(self):
        while True:
            started = asyncio.get_running_loop().time()
            try:
                await self.poll()
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Copycats patrol failed")
                self.state.fog = "The radio fogged over. Your saved backpack is safe."
            elapsed = asyncio.get_running_loop().time() - started
            await asyncio.sleep(max(1, self.state.settings.poll_seconds - elapsed))
