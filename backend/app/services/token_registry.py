from typing import Any

from app.nansen_client import NansenClient


TOKEN_UNIVERSE: dict[str, dict[str, Any]] = {
    "BTC": {"chains": ["bitcoin"], "addresses": {}, "type": "native"},
    "ETH": {"chains": ["ethereum"], "addresses": {}, "type": "native"},
    "SOL": {"chains": ["solana"], "addresses": {}, "type": "native"},
    "HYPE": {
        "chains": ["hyperevm", "hyperliquid"],
        "addresses": {},
        "type": "native",
    },
    "UNI": {
        "chains": ["ethereum"],
        "addresses": {
            "ethereum": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
        },
        "type": "erc20",
    },
}


async def get_robinhood_memes(client: NansenClient) -> Any:
    """Fetch the 20 most active Robinhood-chain tokens launched in the last 90 days."""

    return await client.get_token_screener(
        {
            "chains": ["robinhood"],
            "filters": {"token_age_days": {"max": 90}},
            "order_by": [
                {"field": "volume_24h_usd", "direction": "DESC"},
                {"field": "trader_count", "direction": "DESC"},
            ],
            "pagination": {"page": 1, "per_page": 20},
        }
    )

