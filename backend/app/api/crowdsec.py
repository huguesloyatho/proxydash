"""
CrowdSec API endpoints for the dashboard.
Provides access to CrowdSec metrics, decisions, alerts and bouncers.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import httpx
import asyncio

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, Widget

router = APIRouter(prefix="/crowdsec", tags=["crowdsec"])


async def get_crowdsec_config(db: Session, user: User) -> dict:
    """
    Get CrowdSec configuration from a crowdsec widget.
    Returns the first configured crowdsec widget config.
    """
    widget = db.query(Widget).filter(
        Widget.widget_type == "crowdsec",
        Widget.user_id == user.id
    ).first()

    if not widget or not widget.config:
        return None

    return widget.config


async def call_crowdsec_api(
    config: dict,
    endpoint: str,
    method: str = "GET",
    params: dict = None
) -> dict:
    """
    Call the CrowdSec Local API.
    """
    api_url = config.get("api_url", "").rstrip("/")
    api_key = config.get("api_key", "")

    if not api_url or not api_key:
        raise HTTPException(status_code=400, detail="CrowdSec API URL or key not configured")

    headers = {
        "X-Api-Key": api_key,
        "Content-Type": "application/json"
    }

    url = f"{api_url}{endpoint}"

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            if method == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers, params=params)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported method: {method}")

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 403:
                raise HTTPException(status_code=403, detail="Invalid CrowdSec API key")
            elif response.status_code == 404:
                return []
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"CrowdSec API error: {response.text}"
                )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="CrowdSec API timeout")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach CrowdSec API: {str(e)}")


@router.get("/bouncers")
async def get_bouncers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of registered bouncers.
    """
    config = await get_crowdsec_config(db, current_user)
    if not config:
        raise HTTPException(status_code=404, detail="No CrowdSec widget configured")

    bouncers = await call_crowdsec_api(config, "/v1/bouncers")
    return {"bouncers": bouncers}


@router.get("/decisions")
async def get_decisions(
    limit: int = 50,
    ip: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get active decisions (bans).
    """
    config = await get_crowdsec_config(db, current_user)
    if not config:
        raise HTTPException(status_code=404, detail="No CrowdSec widget configured")

    params = {}
    if ip:
        params["ip"] = ip

    decisions = await call_crowdsec_api(config, "/v1/decisions", params=params)

    # Limit results
    if isinstance(decisions, list):
        decisions = decisions[:limit]

    return {"decisions": decisions or [], "count": len(decisions or [])}


@router.delete("/decisions/{decision_id}")
async def delete_decision(
    decision_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a specific decision (unban).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    config = await get_crowdsec_config(db, current_user)
    if not config:
        raise HTTPException(status_code=404, detail="No CrowdSec widget configured")

    result = await call_crowdsec_api(config, f"/v1/decisions/{decision_id}", method="DELETE")
    return {"success": True, "result": result}


@router.get("/alerts")
async def get_alerts(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get recent alerts.
    """
    config = await get_crowdsec_config(db, current_user)
    if not config:
        raise HTTPException(status_code=404, detail="No CrowdSec widget configured")

    alerts = await call_crowdsec_api(config, "/v1/alerts")

    # Sort by ID descending and limit
    if isinstance(alerts, list):
        alerts = sorted(alerts, key=lambda x: x.get("id", 0), reverse=True)[:limit]

    return {"alerts": alerts or [], "count": len(alerts or [])}


@router.get("/metrics")
async def get_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get CrowdSec metrics summary.
    Note: This endpoint requires machine authentication, not bouncer key.
    We'll parse the cscli metrics output instead via SSH if configured.
    """
    config = await get_crowdsec_config(db, current_user)
    if not config:
        raise HTTPException(status_code=404, detail="No CrowdSec widget configured")

    # For metrics, we need to either:
    # 1. Use SSH to run cscli metrics
    # 2. Parse the prometheus endpoint
    # 3. Aggregate from decisions/alerts

    # Let's aggregate from decisions and alerts for now
    try:
        decisions = await call_crowdsec_api(config, "/v1/decisions")
        alerts = await call_crowdsec_api(config, "/v1/alerts")

        # Count by origin
        origin_counts = {}
        action_counts = {}
        country_counts = {}

        for decision in (decisions or []):
            origin = decision.get("origin", "unknown")
            action = decision.get("type", "unknown")

            origin_counts[origin] = origin_counts.get(origin, 0) + 1
            action_counts[action] = action_counts.get(action, 0) + 1

        for alert in (alerts or []):
            source = alert.get("source", {})
            country = source.get("cn", "unknown")
            country_counts[country] = country_counts.get(country, 0) + 1

        # Count scenarios from alerts
        scenario_counts = {}
        for alert in (alerts or []):
            scenario = alert.get("scenario", "unknown")
            scenario_counts[scenario] = scenario_counts.get(scenario, 0) + 1

        return {
            "total_decisions": len(decisions or []),
            "total_alerts": len(alerts or []),
            "by_origin": origin_counts,
            "by_action": action_counts,
            "by_country": country_counts,
            "by_scenario": dict(sorted(scenario_counts.items(), key=lambda x: x[1], reverse=True)[:10])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")


@router.get("/widget-data")
async def get_widget_data(
    widget_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all data for the CrowdSec widget in a single call.
    """
    # Get config from specific widget or first crowdsec widget
    if widget_id:
        widget = db.query(Widget).filter(
            Widget.id == widget_id,
            Widget.user_id == current_user.id
        ).first()
    else:
        widget = db.query(Widget).filter(
            Widget.widget_type == "crowdsec",
            Widget.user_id == current_user.id
        ).first()

    if not widget or not widget.config:
        return {
            "error": "No CrowdSec widget configured",
            "bouncers": [],
            "decisions": [],
            "alerts": [],
            "metrics": {}
        }

    config = widget.config

    # Fetch all data in parallel
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            api_url = config.get("api_url", "").rstrip("/")
            api_key = config.get("api_key", "")

            headers = {
                "X-Api-Key": api_key,
                "Content-Type": "application/json"
            }

            # Parallel requests
            decisions_task = client.get(f"{api_url}/v1/decisions", headers=headers)
            alerts_task = client.get(f"{api_url}/v1/alerts", headers=headers)

            responses = await asyncio.gather(
                decisions_task,
                alerts_task,
                return_exceptions=True
            )

            decisions = []
            alerts = []

            if not isinstance(responses[0], Exception) and responses[0].status_code == 200:
                decisions = responses[0].json() or []

            if not isinstance(responses[1], Exception) and responses[1].status_code == 200:
                alerts = responses[1].json() or []

            # Sort alerts by ID descending
            alerts = sorted(alerts, key=lambda x: x.get("id", 0), reverse=True)

            # Calculate metrics
            origin_counts = {}
            country_counts = {}
            scenario_counts = {}

            for decision in decisions:
                origin = decision.get("origin", "unknown")
                origin_counts[origin] = origin_counts.get(origin, 0) + 1

            for alert in alerts:
                source = alert.get("source", {})
                country = source.get("cn", "unknown")
                country_counts[country] = country_counts.get(country, 0) + 1

                scenario = alert.get("scenario", "unknown")
                scenario_counts[scenario] = scenario_counts.get(scenario, 0) + 1

            # Limit returned data
            max_decisions = config.get("max_decisions", 20)
            max_alerts = config.get("max_alerts", 20)

            return {
                "decisions": decisions[:max_decisions],
                "decisions_count": len(decisions),
                "alerts": alerts[:max_alerts],
                "alerts_count": len(alerts),
                "metrics": {
                    "total_decisions": len(decisions),
                    "total_alerts": len(alerts),
                    "by_origin": origin_counts,
                    "by_country": dict(sorted(country_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
                    "by_scenario": dict(sorted(scenario_counts.items(), key=lambda x: x[1], reverse=True)[:10])
                }
            }

    except httpx.TimeoutException:
        return {"error": "CrowdSec API timeout", "bouncers": [], "decisions": [], "alerts": [], "metrics": {}}
    except httpx.RequestError as e:
        return {"error": f"Cannot reach CrowdSec API: {str(e)}", "bouncers": [], "decisions": [], "alerts": [], "metrics": {}}
    except Exception as e:
        return {"error": str(e), "bouncers": [], "decisions": [], "alerts": [], "metrics": {}}
