from typing import Any

from fastapi import APIRouter, Request

from app.routers.helpers import extract_rows, get_database, get_nansen_client
from app.services.token_registry import get_robinhood_memes

router = APIRouter(prefix="/api/screener", tags=["screener"])


@router.get("/robinhood-memes")
async def robinhood_memes(request: Request) -> Any:
    response = await get_robinhood_memes(get_nansen_client(request))
    await get_database(request).save_screener_snapshots(extract_rows(response))
    return response

