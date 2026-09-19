from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class FlexibleModel(BaseModel):
    """Base model that forwards newly introduced Nansen fields unchanged."""

    model_config = ConfigDict(extra="allow")


class Pagination(FlexibleModel):
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=100, ge=1, le=1000)


class OrderBy(FlexibleModel):
    field: str
    direction: Literal["ASC", "DESC"] = "DESC"


class SmartMoneyRequest(FlexibleModel):
    chains: list[str] | None = None
    include_smart_money_labels: list[str] | None = None
    filters: dict[str, Any] | None = None
    pagination: Pagination | None = None
    order_by: list[OrderBy] | None = None

    def to_nansen_payload(self) -> dict[str, Any]:
        payload = self.model_dump(exclude_none=True, exclude_unset=True)
        labels = payload.pop("include_smart_money_labels", None)
        if labels:
            payload.setdefault("filters", {})["include_smart_money_labels"] = labels
        return payload


class TokenQueryRequest(FlexibleModel):
    filters: dict[str, Any] | None = None
    pagination: Pagination | None = None
    order_by: list[OrderBy] | None = None


class ProfilerTradesRequest(FlexibleModel):
    chain: str | None = None
    filters: dict[str, Any] | None = None
    pagination: Pagination | None = None
    order_by: list[OrderBy] | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    api_key_configured: bool
    api_key_validity: Literal["valid", "invalid", "not_checked"]
    credit_balance: float | None = None
    database: Literal["ready"] = "ready"

