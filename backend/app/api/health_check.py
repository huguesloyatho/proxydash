"""
Health check API for checking URL availability
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Optional
import asyncio
import aiohttp
from datetime import datetime
import ssl

from app.api.deps import get_current_user

router = APIRouter(prefix="/health-check", tags=["health-check"])


class URLCheckRequest(BaseModel):
    urls: List[str]
    timeout: Optional[int] = 5  # Default 5 seconds timeout


class URLStatus(BaseModel):
    url: str
    is_up: bool
    status_code: Optional[int] = None
    response_time_ms: Optional[int] = None
    error: Optional[str] = None


class URLCheckResponse(BaseModel):
    results: Dict[str, URLStatus]
    checked_at: str


async def check_url(session: aiohttp.ClientSession, url: str, timeout: int) -> URLStatus:
    """Check if a URL is accessible"""
    start_time = datetime.now()

    try:
        # Create SSL context that doesn't verify certificates (for self-signed)
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        async with session.get(
            url,
            timeout=aiohttp.ClientTimeout(total=timeout),
            ssl=ssl_context,
            allow_redirects=True,
        ) as response:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)

            # Consider 2xx, 3xx, and 401/403 as "up" (the service is responding)
            is_up = response.status < 500

            return URLStatus(
                url=url,
                is_up=is_up,
                status_code=response.status,
                response_time_ms=response_time,
                error=None if is_up else f"HTTP {response.status}"
            )
    except asyncio.TimeoutError:
        return URLStatus(
            url=url,
            is_up=False,
            status_code=None,
            response_time_ms=timeout * 1000,
            error="Timeout"
        )
    except aiohttp.ClientConnectorError as e:
        return URLStatus(
            url=url,
            is_up=False,
            status_code=None,
            response_time_ms=None,
            error=f"Connection error: {str(e)[:50]}"
        )
    except Exception as e:
        return URLStatus(
            url=url,
            is_up=False,
            status_code=None,
            response_time_ms=None,
            error=str(e)[:100]
        )


@router.post("/check", response_model=URLCheckResponse)
async def check_urls(
    request: URLCheckRequest,
    current_user=Depends(get_current_user)
):
    """
    Check the availability of multiple URLs.
    Returns the status of each URL (up/down, response time, etc.)
    """
    if not request.urls:
        return URLCheckResponse(
            results={},
            checked_at=datetime.utcnow().isoformat()
        )

    # Limit the number of URLs to check at once
    urls_to_check = request.urls[:50]  # Max 50 URLs at a time

    # Create a session for all requests
    connector = aiohttp.TCPConnector(limit=20, force_close=True)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Check all URLs concurrently
        tasks = [check_url(session, url, request.timeout) for url in urls_to_check]
        results = await asyncio.gather(*tasks)

    # Build response dict
    results_dict = {result.url: result for result in results}

    return URLCheckResponse(
        results=results_dict,
        checked_at=datetime.utcnow().isoformat()
    )


@router.get("/check-single")
async def check_single_url(
    url: str,
    timeout: int = 5,
    current_user=Depends(get_current_user)
):
    """
    Check the availability of a single URL.
    """
    connector = aiohttp.TCPConnector(force_close=True)
    async with aiohttp.ClientSession(connector=connector) as session:
        result = await check_url(session, url, timeout)

    return {
        "url": url,
        "is_up": result.is_up,
        "status_code": result.status_code,
        "response_time_ms": result.response_time_ms,
        "error": result.error,
        "checked_at": datetime.utcnow().isoformat()
    }
