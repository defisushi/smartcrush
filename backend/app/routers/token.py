from typing import Any

from fastapi import APIRouter, Request

from app.models import TokenQueryRequest
from app.routers.helpers import get_nansen_client

router = APIRouter(prefix="/api/token", tags=["token"])


@router.get("/{chain}/{address}/info")
async def token_information(chain: str, address: str, request: Request) -> Any:
    return await get_nansen_client(request).get_token_information(
        {"chain": chain, "token_address": address}
    )


@router.post("/{chain}/{address}/flows")
async def token_flows(
    chain: str,
    address: str,
    request: Request,
    body: TokenQueryRequest | None = None,
) -> Any:
    payload = body.model_dump(exclude_none=True, exclude_unset=True) if body else {}
    payload.update({"chain": chain, "token_address": address})
    return await get_nansen_client(request).get_token_flows(payload)


@router.post("/{chain}/{address}/holders")
async def token_holders(
    chain: str,
    address: str,
    request: Request,
    body: TokenQueryRequest | None = None,
) -> Any:
    payload = body.model_dump(exclude_none=True, exclude_unset=True) if body else {}
    payload.update({"chain": chain, "token_address": address})
    return await get_nansen_client(request).get_token_holders(payload)

