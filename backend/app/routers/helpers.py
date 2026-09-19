from collections.abc import Mapping
from typing import Any

from fastapi import Request

from app.db import Database
from app.nansen_client import NansenClient


def get_nansen_client(request: Request) -> NansenClient:
    return request.app.state.nansen_client


def get_database(request: Request) -> Database:
    return request.app.state.database


def extract_rows(response: Any) -> list[Mapping[str, Any]]:
    """Find tabular rows in common Nansen response envelopes."""

    if isinstance(response, list):
        return [row for row in response if isinstance(row, Mapping)]
    if not isinstance(response, Mapping):
        return []

    for key in ("data", "results", "items", "rows"):
        value = response.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, Mapping)]
        if isinstance(value, Mapping):
            nested = extract_rows(value)
            if nested:
                return nested
    return []

