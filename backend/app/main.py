import logging
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import Database
from app.models import HealthResponse
from app.nansen_client import (
    NansenAPIError,
    NansenClient,
    NansenConfigurationError,
    NansenError,
)
from app.routers import game as game_router
from app.routers.helpers import get_database, get_nansen_client
from app.copycats_nansen import SpotClient
from app.game_store import GameStore
from app.game import Game

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    database = Database(settings.DB_PATH)
    await database.initialize()
    client = SpotClient(
        api_key=settings.NANSEN_API_KEY,
        base_url=settings.NANSEN_BASE_URL,
        call_logger=database.log_api_call,
    )
    app.state.settings = settings
    app.state.database = database
    app.state.nansen_client = client
    game = Game(GameStore(database.path), client, settings)
    await game.initialize()
    app.state.game = game
    if game.mode == "mock":
        await game.poll()
    worker = asyncio.create_task(game.worker()) if settings.COPYCATS_BACKGROUND else None
    try:
        yield
    finally:
        if worker:
            worker.cancel()
            try:
                await worker
            except asyncio.CancelledError:
                pass
        await client.aclose()


app = FastAPI(
    title="Copycats · Robinhood meadow",
    version="1.0.0",
    description="Robinhood-chain spot observations and a persistent paper backpack.",
    lifespan=lifespan,
)

# Legacy generic proxy modules are retained on disk for the existing project,
# but are intentionally not mounted: every active route is Robinhood-only.
app.include_router(game_router.router)


@app.exception_handler(NansenConfigurationError)
async def configuration_error_handler(
    _request: Request, exc: NansenConfigurationError
) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.exception_handler(NansenAPIError)
async def nansen_api_error_handler(
    _request: Request, exc: NansenAPIError
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.message,
            "upstream_status": exc.status_code,
            "upstream_response": exc.response_data,
        },
    )


@app.exception_handler(NansenError)
async def nansen_error_handler(_request: Request, exc: NansenError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/api/health", response_model=HealthResponse, tags=["system"])
async def health(request: Request) -> HealthResponse:
    client = get_nansen_client(request)
    get_database(request)  # Lifespan initialization guarantees the DB is ready.
    return HealthResponse(
        api_key_configured=bool(client.api_key),
        api_key_validity=client.last_api_key_validity,
        credit_balance=client.credit_balance,
    )


frontend_directory = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_directory.is_dir():
    app.mount(
        "/",
        StaticFiles(directory=frontend_directory, html=True),
        name="frontend",
    )
