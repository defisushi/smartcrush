from typing import Any

from fastapi import APIRouter, Request

from app.models import SmartMoneyRequest
from app.routers.helpers import extract_rows, get_database, get_nansen_client

router = APIRouter(prefix="/api/smart-money", tags=["smart-money"])


@router.post("/netflow")
async def smart_money_netflow(
    request: Request, body: SmartMoneyRequest | None = None
) -> Any:
    payload = body.to_nansen_payload() if body else {}
    response = await get_nansen_client(request).get_smart_money_netflow(payload)
    await get_database(request).save_netflow_snapshots(extract_rows(response))
    return response


@router.post("/dex-trades")
async def smart_money_dex_trades(
    request: Request, body: SmartMoneyRequest | None = None
) -> Any:
    payload = body.to_nansen_payload() if body else {}
    return await get_nansen_client(request).get_smart_money_dex_trades(payload)

