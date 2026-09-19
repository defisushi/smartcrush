from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/api/game", tags=["Copycats"])


class Action(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: str = Field(max_length=30)
    payload: dict = Field(default_factory=dict)


def same_origin(request: Request):
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") != str(request.base_url).rstrip("/"):
        raise HTTPException(403, "This meadow action must come from the app.")


@router.get("")
async def state(request: Request):
    async with request.app.state.game.lock:
        return await request.app.state.game.snapshot()


@router.post("/refresh")
async def refresh(request: Request, discover: bool = False):
    same_origin(request)
    return await request.app.state.game.poll(force=True, discover=discover)


@router.post("/action")
async def action(request: Request, body: Action):
    same_origin(request)
    try:
        return await request.app.state.game.action(body.kind, body.payload)
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/cat/{cat_id}/advanced")
async def advanced(request: Request, cat_id: str):
    try:
        game = request.app.state.game
        async with game.lock:
            cat = game.cat(cat_id)
            return {"cat": asdict(cat), "hunts": [e for e in game.state.events if e["print"]["cat_id"] == cat_id][-10:]}
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
