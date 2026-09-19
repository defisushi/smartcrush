from typing import Any

from fastapi import APIRouter, Query, Request

from app.models import ProfilerTradesRequest
from app.routers.helpers import get_nansen_client

router = APIRouter(prefix="/api/profiler", tags=["profiler"])


@router.get("/{address}/summary")
async def address_summary(
    address: str,
    request: Request,
    chain: str | None = Query(default=None),
) -> Any:
    payload: dict[str, Any] = {"address": address}
    if chain:
        payload["chain"] = chain
    return await get_nansen_client(request).get_address_pnl_summary(payload)


@router.post("/{address}/trades")
async def address_trades(
    address: str,
    request: Request,
    body: ProfilerTradesRequest | None = None,
) -> Any:
    payload = body.model_dump(exclude_none=True, exclude_unset=True) if body else {}
    payload["address"] = address
    return await get_nansen_client(request).get_address_dex_trades(payload)

