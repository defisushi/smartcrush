import asyncio
import sqlite3
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import Database
from app.main import app
from app.nansen_client import NansenClient
from app.services.token_registry import get_robinhood_memes


def test_nansen_client_posts_auth_and_payload() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["apikey"] = request.headers.get("apikey")
        seen["body"] = request.read()
        return httpx.Response(
            200,
            json={"data": [{"token_symbol": "ETH"}]},
            headers={"x-credits-remaining": "99"},
        )

    async def run() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(
            transport=transport, base_url="https://api.nansen.ai"
        ) as http_client:
            client = NansenClient("test-key", http_client=http_client)
            result = await client.get_smart_money_netflow(
                {"chains": ["ethereum"]}
            )
            assert result["data"][0]["token_symbol"] == "ETH"
            assert client.last_api_key_validity == "valid"
            assert client.credit_balance == 99

    asyncio.run(run())
    assert seen["path"] == "/api/v1/smart-money/netflow"
    assert seen["apikey"] == "test-key"
    assert seen["body"] == b'{"chains":["ethereum"]}'


def test_nansen_client_retries_rate_limits() -> None:
    attempts = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            return httpx.Response(
                429,
                json={"message": "slow down"},
                headers={"retry-after": "0"},
            )
        return httpx.Response(200, json={"data": []})

    async def run() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(
            transport=transport, base_url="https://api.nansen.ai"
        ) as http_client:
            client = NansenClient("test-key", http_client=http_client)
            assert await client.get_token_screener() == {"data": []}

    asyncio.run(run())
    assert attempts == 3


def test_database_initializes_and_persists(tmp_path: Path) -> None:
    database_path = tmp_path / "nested" / "nansen.db"

    async def run() -> None:
        database = Database(database_path)
        await database.initialize()
        await database.log_api_call("/test", 1, 12.5)
        await database.save_netflow_snapshots(
            [
                {
                    "token_symbol": "ETH",
                    "chain": "ethereum",
                    "net_flow_24h_usd": 123.45,
                }
            ]
        )

    asyncio.run(run())
    with sqlite3.connect(database_path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        assert {
            "netflow_snapshots",
            "screener_snapshots",
            "api_call_log",
        }.issubset(tables)
        assert connection.execute(
            "SELECT COUNT(*) FROM netflow_snapshots"
        ).fetchone() == (1,)
        assert connection.execute(
            "SELECT credits FROM api_call_log"
        ).fetchone() == (1,)


def test_robinhood_meme_screener_payload() -> None:
    class FakeClient:
        payload: dict[str, object] | None = None

        async def get_token_screener(self, payload):  # type: ignore[no-untyped-def]
            self.payload = payload
            return {"data": []}

    async def run() -> None:
        client = FakeClient()
        result = await get_robinhood_memes(client)  # type: ignore[arg-type]
        assert result == {"data": []}
        assert client.payload is not None
        assert client.payload["chains"] == ["robinhood"]
        assert client.payload["filters"] == {"token_age_days": {"max": 90}}
        assert client.payload["pagination"] == {"page": 1, "per_page": 20}

    asyncio.run(run())


def test_health_starts_without_spending_credits(
    tmp_path: Path, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setenv("DB_PATH", str(tmp_path / "health.db"))
    monkeypatch.setenv("NANSEN_API_KEY", "")
    get_settings.cache_clear()
    try:
        with TestClient(app) as client:
            response = client.get("/api/health")
            assert response.status_code == 200
            assert response.json() == {
                "status": "ok",
                "api_key_configured": False,
                "api_key_validity": "not_checked",
                "credit_balance": None,
                "database": "ready",
            }
            dashboard = client.get("/")
            assert dashboard.status_code == 200
            assert "Copycats" in dashboard.text
    finally:
        get_settings.cache_clear()
