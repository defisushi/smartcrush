import asyncio
import copy
import json
from dataclasses import asdict
from datetime import timedelta
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.copycats_nansen import COSTS, NansenReader, SpotClient, labels, map_trades
from app.db import Database
from app.engine.models import Print, moment, utcnow
from app.engine.policy import CHAIN
from app.game import Game
from app.game_store import GameStore
from app.main import app
from app.mock_nansen import fixture
from app.nansen_client import NansenError


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "game.db"))
    monkeypatch.setenv("MOCK_NANSEN", "true")
    monkeypatch.setenv("COPYCATS_BACKGROUND", "false")
    monkeypatch.setenv("NANSEN_API_KEY", "test-server-key")
    get_settings.cache_clear()
    with TestClient(app) as client:
        yield client
    get_settings.cache_clear()


def action(client, kind, **payload):
    return client.post("/api/game/action", json={"kind": kind, "payload": payload})


def test_mock_boots_real_ledger_without_spending(client):
    state = client.get("/api/game").json()
    assert state["mode"] == "mock" and state["chain"] == CHAIN
    assert len(state["cats"]) == 8 and len(state["positions"]) == 1
    assert state["positions"][0]["lane"] == "kitchen"
    assert state["cash"] == 9500 and state["equity"] == 10000
    assert state["ignored_count"] > len(state["events"])
    assert state["credits_hour"] == 0
    assert "test-server-key" not in json.dumps(state)
    assert all("address" not in cat for cat in state["cats"])


def test_manual_forage_and_duplicate_request_are_safe(client):
    state = client.get("/api/game").json()
    event = next(e for e in state["events"] if e["classification"]["lane"] == "forage")
    denied = action(client, "eat", event_id=event["id"], intent="eat")
    assert denied.status_code == 400
    eaten = action(client, "eat", event_id=event["id"], intent="gamble")
    assert eaten.status_code == 200 and eaten.json()["cash"] == 9250
    duplicate = action(client, "eat", event_id=event["id"], intent="gamble")
    assert duplicate.status_code == 400
    assert client.get("/api/game").json()["cash"] == 9250


def test_related_recruitment_and_three_cat_limit(client):
    cats = client.get("/api/game").json()["cats"]
    fig = next(c for c in cats if c["name"] == "Fig")
    mallow = next(c for c in cats if c["name"] == "Mallow")
    clover = next(c for c in cats if c["name"] == "Clover")
    assert action(client, "adopt", cat_id=fig["id"]).status_code == 400
    assert action(client, "adopt", cat_id=mallow["id"]).status_code == 200
    assert action(client, "adopt", cat_id=clover["id"]).status_code == 400


def test_failed_action_rolls_back_partial_profile_edits(client):
    cat=client.get("/api/game").json()["cats"][0]
    assert action(client,"cat",cat_id=cat["id"],name="Partial edit",follow_mode="invalid").status_code==400
    assert client.get("/api/game").json()["cats"][0]["name"]==cat["name"]


def test_backpack_put_back_restores_cash_and_updates_event(client):
    state = client.get("/api/game").json()
    result = action(client, "put_back", position_id=state["positions"][0]["id"])
    assert result.status_code == 200
    assert result.json()["cash"] == 10000 and result.json()["positions"] == []
    assert any(e["status"] == "closed" for e in result.json()["events"])


def test_lock_requires_server_elapsed_hold_and_recodes(client):
    p = client.get("/api/game").json()["positions"][0]
    token = action(client, "lock_begin", position_id=p["id"]).json()["token"]
    assert action(client, "lock", position_id=p["id"], token=token).status_code == 400
    token = action(client, "lock_begin", position_id=p["id"]).json()["token"]
    game = client.app.state.game
    identity, started = game.lock_intents[token]
    game.lock_intents[token] = (identity, started - 2)
    result = action(client, "lock", position_id=p["id"], token=token).json()
    assert result["positions"][0]["locked_by_user"]
    assert result["positions"][0]["lane"] == "forage"


def test_settings_adjust_cash_without_erasing_history(client):
    state = action(client, "settings", paper_equity=12000, poll_seconds=120).json()
    assert state["cash"] == 11500 and state["equity"] == 12000
    assert len(state["positions"]) == 1 and len(state["recent_fills"]) == 2
    assert action(client, "settings", forage_budget=.5).status_code == 400
    assert action(client, "settings", poll_seconds=5).status_code == 400


def test_modes_are_isolated_and_preserved(client):
    original = client.get("/api/game").json()
    live = action(client, "mode", mode="live").json()
    assert live["cash"] == 10000 and not live["cats"] and not live["positions"]
    mock = action(client, "mode", mode="mock").json()
    assert mock["positions"] == original["positions"] and mock["cash"] == original["cash"]


def test_legacy_multichain_routes_unavailable_and_csrf_rejected(client):
    assert client.post("/api/smart-money/netflow", json={"chains":["ethereum"]}).status_code in {404,405}
    assert client.post("/api/game/action", headers={"Origin":"https://outside.example"}, json={"kind":"mode","payload":{"mode":"live"}}).status_code == 403


def test_dex_mapper_two_legs_and_exact_labels():
    assert labels("30D Smart Trader") == ["30D Smart Trader"]
    assert labels("Smart HL Perps Trader") == []
    raw = fixture("dex-trades.json")
    raw["data"][0]["token_sold_symbol"] = "FERN"
    raw["data"][0]["token_sold_address"] = "0xanother"
    foreign = copy.deepcopy(raw["data"][0]); foreign["chain"] = "base"
    raw["data"].append(foreign)
    prints, guides = map_trades(raw)
    tx = [p for p in prints if p.tx_hash == "mock-meadow-meal"]
    assert len(tx) == 2 and tx[0].id != tx[1].id
    assert {p.side for p in tx} == {"buy","sell"}
    assert all(p.chain == "robinhood" for p in prints)
    assert tx[0].price_usd_at_print == 1


def test_blank_display_labels_require_single_category_provenance():
    raw = fixture("dex-trades.json")
    for row in raw["data"]:
        row["trader_address_label"] = "High Balance"
    assert map_trades(raw)[1] == {}
    assert map_trades(raw, filter_labels=["Fund", "90D Smart Trader"])[1] == {}
    prints, guides = map_trades(raw, filter_labels=["90D Smart Trader"])
    assert prints and all(v == ["90D Smart Trader"] for v in guides.values())


def test_allowlist_blocks_unsupported_calls_before_network():
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: pytest.fail("Unexpected network call"))) as http:
            client = SpotClient("key", http_client=http)
            for path, body in [
                ("/api/v1/smart-money/perp-trades", {"chains":[CHAIN]}),
                ("/api/v1/agent/fast", {"chain":CHAIN}),
                ("/api/v1/token-screener", {"chains":["base"]}),
                ("/api/v1/tgm/holders", {"chain":CHAIN,"premium_labels":True}),
            ]:
                with pytest.raises(NansenError):
                    await client._post(path, body)
    asyncio.run(run())


def test_cached_reader_keeps_raw_fallback_and_counts_credits(tmp_path):
    calls = []
    fail = False
    def handler(request):
        calls.append(request)
        assert request.headers["apikey"] == "private-test-key"
        assert json.loads(request.content)["chains"] == ["robinhood"]
        return httpx.Response(401, json={"message":"fog"}) if fail else httpx.Response(200,json={"data":[],"unexpected_future_field":42})
    async def run():
        nonlocal fail
        db = Database(tmp_path / "cache.db"); await db.initialize()
        store = GameStore(db.path); await store.initialize()
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler),base_url="https://api.nansen.ai") as http:
            client = SpotClient("private-test-key", http_client=http,call_logger=db.log_api_call)
            reader = NansenReader(client,store)
            body={"chains":[CHAIN]}; path="/api/v1/smart-money/dex-trades"
            first=await reader.request(path,body,90,"test")
            second=await reader.request(path,body,90,"test")
            assert len(calls)==1 and not second.stale
            assert await store.credits_hour()==5
            await store.cache_put("test",first.data,0)
            fail=True
            stale=await reader.request(path,body,90,"test")
            assert stale.stale and stale.data["unexpected_future_field"]==42
            assert reader.fog and await store.credits_hour()==5
    asyncio.run(run())


def test_pending_job_survives_restart_and_failed_hold_never_fills(tmp_path):
    async def run():
        db=Database(tmp_path/"persist.db");await db.initialize()
        store=GameStore(db.path)
        config=SimpleNamespace(MOCK_NANSEN=True,CREDIT_BUDGET_HOUR=100)
        async with SpotClient("") as client:
            game=Game(store,client,config);await game.initialize()
            cat=game.state.cats[0]
            p=Print("new-print",cat.id,"0x000000000000000000000000000000000000f001","LEAF",utcnow(),notional_usd=2000,price_usd_at_print=1)
            result=await game.evaluatePrint(p)
            assert result.pending and not game.state.positions
            await store.save("mock",game.state)
            second=Game(store,client,config);await second.initialize()
            assert second.state.pending[0]["print"]["id"]==p.id
            p.observed_at=(moment(utcnow())-timedelta(minutes=25)).isoformat()
            async def sold(*args,**kwargs):return 0,utcnow()
            second.reader.balance=sold
            result=await second.evaluatePrint(p,confirming=True)
            assert result.lane=="ignore" and not second.state.positions
    asyncio.run(run())


def test_buyer_comparison_requests_sell_only_addresses_too(tmp_path):
    sides = []
    def handler(request):
        side = json.loads(request.content)["buy_or_sell"]
        sides.append(side)
        data = [{"address":"0xbuyer","bought_volume_usd":20}] if side == "BUY" else [
            {"address":"0xseller1","sold_volume_usd":20},
            {"address":"0xseller2","sold_volume_usd":10},
        ]
        return httpx.Response(200, json={"data":data,"pagination":{"is_last_page":True}})
    async def run():
        db=Database(tmp_path/"buyers.db");await db.initialize()
        store=GameStore(db.path);await store.initialize()
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler),base_url="https://api.nansen.ai") as http:
            reader=NansenReader(SpotClient("key",http_client=http,call_logger=db.log_api_call),store)
            assert await reader.buyers("0xtoken",utcnow()) == (1,2)
            assert sides == ["BUY","SELL"]
            assert await store.credits_hour()==2
    asyncio.run(run())


def test_restart_archives_previous_practice_without_touching_live(client):
    result=action(client,"restart_practice")
    assert result.status_code==200 and not result.json()["positions"]
    assert result.json()["cash"]==10000
    import sqlite3
    with sqlite3.connect(client.app.state.game.store.path) as db:
        assert db.execute("SELECT COUNT(*) FROM copycats_archives").fetchone()[0]==1


def test_unknown_balance_pagination_never_means_sold_flat(tmp_path):
    async def run():
        db=Database(tmp_path/"unknown.db");await db.initialize()
        store=GameStore(db.path);await store.initialize()
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r:httpx.Response(200,json={"data":[],"pagination":None})),base_url="https://api.nansen.ai") as http:
            from app.mock_nansen import seed_cats
            reader=NansenReader(SpotClient("key",http_client=http),store)
            assert await reader.balance(seed_cats(utcnow())[0],"0xtoken") == (None,None)
    asyncio.run(run())
