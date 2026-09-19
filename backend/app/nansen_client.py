import asyncio
import inspect
import logging
import time
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

import httpx

logger = logging.getLogger(__name__)

Payload = Mapping[str, Any]
CallLogger = Callable[[str, int, float], Awaitable[None] | None]


class NansenError(Exception):
    """Base exception for Nansen client failures."""


class NansenConfigurationError(NansenError):
    """Raised when a request is attempted without an API key."""


class NansenAPIError(NansenError):
    def __init__(
        self, status_code: int, message: str, response_data: Any | None = None
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.response_data = response_data


class NansenClient:
    """Asynchronous client for the Nansen API.

    Each public endpoint accepts a JSON-compatible mapping. Keyword arguments are
    merged into that mapping, which keeps the client forward-compatible with new
    Nansen filters while still providing explicit, discoverable endpoint methods.
    """

    MAX_ATTEMPTS = 3
    RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

    CREDIT_COSTS = {
        "/api/v1/smart-money/netflow": 5,
        "/api/v1/smart-money/dex-trades": 5,
        "/api/v1/smart-money/holdings": 5,
        "/api/v1/smart-money/historical-holdings": 5,
        "/api/v1/tgm/token-screener": 1,
        "/api/v1/tgm/flow-intelligence": 5,
        "/api/v1/tgm/flows": 5,
        "/api/v1/tgm/holders": 1,
        "/api/v1/tgm/who-bought-sold": 5,
        "/api/v1/tgm/dex-trades": 5,
        "/api/v1/tgm/token-information": 1,
        "/api/v1/tgm/indicators": 1,
        "/api/v1/tgm/token-ohlcv": 5,
        "/api/v1/profiler/address/current-balance": 1,
        "/api/v1/profiler/address/historical-balances": 5,
        "/api/v1/profiler/address/pnl-summary": 1,
        "/api/v1/profiler/address/pnl": 5,
        "/api/v1/profiler/dex-trades": 5,
        "/api/v1/profiler/address/related-wallets": 1,
        "/api/v1/profiler/address/counterparties": 1,
        "/api/v1/profiler/address/labels": 1,
        "/api/v1/tgm/perp-screener": 1,
        "/api/v1/tgm/perp-positions": 5,
        "/api/v1/tgm/perp-trades": 5,
        "/api/v1/smart-money/perp-trades": 5,
        "/api/v1/perp-leaderboard": 5,
        "/api/v1/profiler/perp-positions": 5,
        "/api/v1/profiler/perp-trades": 5,
        "/api/v1beta1/tgm/historical-who-bought-sold": 25,
        "/api/v1beta1/tgm/historical-token-flow-summary": 25,
        "/api/v1beta1/tgm/historical-top-holders": 25,
        "/api/v1beta1/token-screener/historical": 25,
        "/api/v1beta1/smart-money/historical-token-balances": 25,
    }

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.nansen.ai",
        *,
        timeout: float = 30.0,
        call_logger: CallLogger | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.call_logger = call_logger
        self.last_api_key_validity: str = "not_checked"
        self.credit_balance: float | None = None
        self._owns_client = http_client is None
        self._client = http_client or httpx.AsyncClient(
            base_url=self.base_url,
            headers={"apikey": self.api_key, "accept": "application/json"},
            timeout=timeout,
        )

    async def __aenter__(self) -> "NansenClient":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    @staticmethod
    def _error_message(response: httpx.Response, data: Any) -> str:
        if isinstance(data, Mapping):
            for key in ("message", "error", "detail"):
                if data.get(key):
                    return str(data[key])
        return response.text or f"Nansen returned HTTP {response.status_code}"

    @staticmethod
    def _retry_delay(response: httpx.Response | None, attempt: int) -> float:
        if response is not None:
            retry_after = response.headers.get("retry-after")
            if retry_after:
                try:
                    return min(float(retry_after), 30.0)
                except ValueError:
                    pass
        return float(2**attempt)

    async def _record_call(
        self, path: str, credits: int, response_ms: float
    ) -> None:
        if self.call_logger is None:
            return
        try:
            result = self.call_logger(path, credits, response_ms)
            if inspect.isawaitable(result):
                await result
        except Exception:
            logger.exception("Failed to persist Nansen API call metadata")

    def _read_response_metadata(self, response: httpx.Response) -> None:
        for header in (
            "x-credit-balance",
            "x-credits-remaining",
            "credits-remaining",
        ):
            value = response.headers.get(header)
            if value is not None:
                try:
                    self.credit_balance = float(value)
                except ValueError:
                    pass
                break

    async def _post(self, path: str, payload: Payload | None = None) -> Any:
        if not self.api_key:
            raise NansenConfigurationError(
                "NANSEN_API_KEY is not configured. Add it to backend/.env."
            )

        body = dict(payload or {})
        credit_cost = self.CREDIT_COSTS.get(path, 0)
        last_transport_error: httpx.RequestError | None = None

        for attempt in range(self.MAX_ATTEMPTS):
            started = time.perf_counter()
            response: httpx.Response | None = None
            try:
                response = await self._client.post(
                    path,
                    json=body,
                    headers={"apikey": self.api_key, "accept": "application/json"},
                )
                elapsed_ms = (time.perf_counter() - started) * 1000
                used_credits = credit_cost if response.is_success else 0
                await self._record_call(path, used_credits, elapsed_ms)
                self._read_response_metadata(response)

                try:
                    data = response.json()
                except ValueError:
                    data = {"message": response.text}

                if response.is_success:
                    self.last_api_key_validity = "valid"
                    logger.info(
                        "Nansen request endpoint=%s credits=%s response_ms=%.1f",
                        path,
                        credit_cost,
                        elapsed_ms,
                    )
                    return data

                if response.status_code in {401, 403}:
                    self.last_api_key_validity = "invalid"

                if (
                    response.status_code in self.RETRYABLE_STATUS_CODES
                    and attempt < self.MAX_ATTEMPTS - 1
                ):
                    await asyncio.sleep(self._retry_delay(response, attempt))
                    continue

                raise NansenAPIError(
                    response.status_code,
                    self._error_message(response, data),
                    data,
                )
            except httpx.RequestError as exc:
                last_transport_error = exc
                elapsed_ms = (time.perf_counter() - started) * 1000
                await self._record_call(path, 0, elapsed_ms)
                if attempt < self.MAX_ATTEMPTS - 1:
                    await asyncio.sleep(self._retry_delay(response, attempt))
                    continue

        raise NansenError(f"Nansen request failed: {last_transport_error}")

    @staticmethod
    def _payload(payload: Payload | None, kwargs: Mapping[str, Any]) -> dict[str, Any]:
        result = dict(payload or {})
        result.update(kwargs)
        return result

    async def get_smart_money_netflow(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/smart-money/netflow", self._payload(payload, kwargs))

    async def get_smart_money_dex_trades(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/smart-money/dex-trades", self._payload(payload, kwargs))

    async def get_smart_money_holdings(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/smart-money/holdings", self._payload(payload, kwargs))

    async def get_smart_money_historical_holdings(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/smart-money/historical-holdings", self._payload(payload, kwargs))

    async def get_token_screener(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/token-screener", self._payload(payload, kwargs))

    async def get_flow_intelligence(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/flow-intelligence", self._payload(payload, kwargs))

    async def get_token_flows(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/flows", self._payload(payload, kwargs))

    async def get_token_holders(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/holders", self._payload(payload, kwargs))

    async def get_who_bought_sold(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/who-bought-sold", self._payload(payload, kwargs))

    async def get_token_dex_trades(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/dex-trades", self._payload(payload, kwargs))

    async def get_token_information(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/token-information", self._payload(payload, kwargs))

    async def get_token_indicators(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/indicators", self._payload(payload, kwargs))

    async def get_token_ohlcv(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/token-ohlcv", self._payload(payload, kwargs))

    async def get_address_balance(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/profiler/address/current-balance", self._payload(payload, kwargs))

    async def get_address_historical_balances(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/profiler/address/historical-balances", self._payload(payload, kwargs))

    async def get_address_pnl_summary(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/profiler/address/pnl-summary", self._payload(payload, kwargs))

    async def get_address_pnl(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/profiler/address/pnl", self._payload(payload, kwargs))

    async def get_address_dex_trades(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/profiler/dex-trades", self._payload(payload, kwargs))

    async def get_address_related_wallets(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/profiler/address/related-wallets", self._payload(payload, kwargs))

    async def get_address_counterparties(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/profiler/address/counterparties", self._payload(payload, kwargs))

    async def get_address_labels(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/profiler/address/labels", self._payload(payload, kwargs))

    async def get_perp_screener(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/perp-screener", self._payload(payload, kwargs))

    async def get_perp_positions(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/perp-positions", self._payload(payload, kwargs))

    async def get_perp_trades(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/tgm/perp-trades", self._payload(payload, kwargs))

    async def get_smart_money_perp_trades(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/smart-money/perp-trades", self._payload(payload, kwargs))

    async def get_perp_leaderboard(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/perp-leaderboard", self._payload(payload, kwargs))

    async def get_address_perp_positions(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/profiler/perp-positions", self._payload(payload, kwargs))

    async def get_address_perp_trades(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1/profiler/perp-trades", self._payload(payload, kwargs))

    async def get_historical_who_bought_sold(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1beta1/tgm/historical-who-bought-sold", self._payload(payload, kwargs))

    async def get_historical_flow_summary(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1beta1/tgm/historical-token-flow-summary", self._payload(payload, kwargs))

    async def get_historical_top_holders(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1beta1/tgm/historical-top-holders", self._payload(payload, kwargs))

    async def get_historical_token_screener(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1beta1/token-screener/historical", self._payload(payload, kwargs))

    async def get_historical_smart_money_balances(self, payload: Payload | None = None, **kwargs: Any) -> Any:
        return await self._post("/api/v1beta1/smart-money/historical-token-balances", self._payload(payload, kwargs))
